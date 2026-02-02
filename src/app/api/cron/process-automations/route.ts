import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  getPatientsReachingMilestone, 
  getAppointmentsNeedingReminder, 
  getReturnsNeedingReminder,
  hasSentMilestoneAutomation,
  recordAutomationSent,
  getPatientWithRelations
} from '@/utils/automationUtils';
import { replaceVariables } from '@/utils/automationVariables';
import { AutomationRule, AutomationMessage } from '@/types';
import { Appointment } from '@/types/medical';
import { MedicalCheckout } from '@/types';

// Cliente Admin (Service Role) para bypassar RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    const results: any[] = [];

    // 1. Processar Marcos de Desenvolvimento (executa no horário configurado, padrão 08:00)
    const milestoneRules = await supabase
      .from('automation_rules')
      .select('*')
      .eq('type', 'milestone')
      .eq('active', true)
      .not('age_months', 'is', null);

    if (milestoneRules.error) throw milestoneRules.error;

    if (milestoneRules.data) {
      for (const rule of milestoneRules.data as AutomationRule[]) {
        const ruleTime = rule.trigger_time || '08:00:00';
        const ruleTimeFormatted = ruleTime.length === 5 ? `${ruleTime}:00` : ruleTime;
        const ruleTimeOnly = ruleTimeFormatted.substring(0, 5); // HH:MM
        
        // Verificar se é o horário de executar esta regra (com tolerância de 1 minuto)
        if (currentTime.startsWith(ruleTimeOnly)) {
          const patients = await getPatientsReachingMilestone(rule.age_months!);
          
          for (const patient of patients) {
            // Verificar se já foi enviado para este paciente neste marco
            const alreadySent = await hasSentMilestoneAutomation(
              rule.id,
              patient.id,
              rule.age_months!
            );

            if (alreadySent) {
              console.log(`[Automation] Já enviado para paciente ${patient.id} no marco ${rule.age_months} meses`);
              continue;
            }

            // Buscar ou criar chat para o paciente
            const cleanPhone = patient.phone.replace(/\D/g, '');
            let { data: chat } = await supabase
              .from('chats')
              .select('id')
              .eq('phone', cleanPhone)
              .maybeSingle();

            if (!chat) {
              const { data: newChat } = await supabase
                .from('chats')
                .insert({
                  phone: cleanPhone,
                  contact_name: patient.name,
                  status: 'ACTIVE',
                })
                .select()
                .single();
              chat = newChat;
            }

            if (!chat) {
              console.error(`[Automation] Erro ao criar/buscar chat para paciente ${patient.id}`);
              continue;
            }

            // Criar scheduled_messages para cada mensagem na sequência
            const patientData = await getPatientWithRelations(patient.id);
            let delaySeconds = 0;

            for (const message of rule.message_sequence as AutomationMessage[]) {
              const scheduledFor = new Date(now.getTime() + delaySeconds * 1000);
              
              let messageContent = message.content;
              let messageCaption = message.caption;

              // Processar variáveis no conteúdo
              if (message.type === 'text') {
                messageContent = replaceVariables(message.content, { patient: patientData || patient });
              } else if (message.caption) {
                messageCaption = replaceVariables(message.caption, { patient: patientData || patient });
              }

              const { error: scheduleError } = await supabase
                .from('scheduled_messages')
                .insert({
                  chat_id: chat.id,
                  item_type: 'adhoc',
                  title: `Automação: ${rule.name}`,
                  content: {
                    type: message.type,
                    content: messageContent,
                    caption: messageCaption,
                  },
                  scheduled_for: scheduledFor.toISOString(),
                  status: 'pending',
                  automation_rule_id: rule.id,
                });

              if (scheduleError) {
                console.error(`[Automation] Erro ao agendar mensagem:`, scheduleError);
              } else {
                // Registrar log
                await supabase.from('automation_logs').insert({
                  automation_rule_id: rule.id,
                  patient_id: patient.id,
                  status: 'pending',
                });

                // Registrar no histórico
                await recordAutomationSent(rule.id, patient.id, rule.age_months!);

                delaySeconds += message.delay || 2;
              }
            }

            results.push({
              type: 'milestone',
              rule: rule.name,
              patient: patient.name,
              age: rule.age_months,
              messages: rule.message_sequence.length,
            });
          }
        }
      }
    }

    // 2. Processar Lembretes de Consulta (executa diariamente)
    const appointmentRules = await supabase
      .from('automation_rules')
      .select('*')
      .eq('type', 'appointment_reminder')
      .eq('active', true)
      .limit(1)
      .maybeSingle();

    if (appointmentRules.data) {
      const rule = appointmentRules.data as AutomationRule;
      const appointments = await getAppointmentsNeedingReminder();

      for (const appointment of appointments) {
        if (!appointment.patient_id || !appointment.patient_phone) continue;

        const patient = await getPatientWithRelations(appointment.patient_id);
        if (!patient) continue;

        const cleanPhone = appointment.patient_phone.replace(/\D/g, '');
        let { data: chat } = await supabase
          .from('chats')
          .select('id')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (!chat) {
          const { data: newChat } = await supabase
            .from('chats')
            .insert({
              phone: cleanPhone,
              contact_name: patient.name,
              status: 'ACTIVE',
            })
            .select()
            .single();
          chat = newChat;
        }

        if (!chat) continue;

        // Criar scheduled_messages
        let delaySeconds = 0;
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const triggerTime = rule.trigger_time || '08:00:00';
        const [hours, minutes] = triggerTime.split(':').map(Number);
        tomorrow.setHours(hours || 8, minutes || 0, 0, 0);

        for (const message of rule.message_sequence as AutomationMessage[]) {
          const scheduledFor = new Date(tomorrow.getTime() + delaySeconds * 1000);
          
          let messageContent = message.content;
          let messageCaption = message.caption;

          if (message.type === 'text') {
            messageContent = replaceVariables(message.content, { 
              patient, 
              appointment: appointment as any 
            });
          } else if (message.caption) {
            messageCaption = replaceVariables(message.caption, { 
              patient, 
              appointment: appointment as any 
            });
          }

          await supabase.from('scheduled_messages').insert({
            chat_id: chat.id,
            item_type: 'adhoc',
            title: `Lembrete: ${rule.name}`,
            content: {
              type: message.type,
              content: messageContent,
              caption: messageCaption,
            },
            scheduled_for: scheduledFor.toISOString(),
            status: 'pending',
            automation_rule_id: rule.id,
          });

          await supabase.from('automation_logs').insert({
            automation_rule_id: rule.id,
            patient_id: patient.id,
            appointment_id: appointment.id,
            status: 'pending',
          });

          delaySeconds += message.delay || 2;
        }

        results.push({
          type: 'appointment_reminder',
          rule: rule.name,
          patient: patient.name,
          appointment: appointment.id,
        });
      }
    }

    // 3. Processar Lembretes de Retorno (executa diariamente)
    const returnRules = await supabase
      .from('automation_rules')
      .select('*')
      .eq('type', 'return_reminder')
      .eq('active', true)
      .limit(1)
      .maybeSingle();

    if (returnRules.data) {
      const rule = returnRules.data as AutomationRule;
      const returns = await getReturnsNeedingReminder();

      for (const checkout of returns) {
        if (!checkout.patient_id) continue;

        const patient = await getPatientWithRelations(checkout.patient_id);
        if (!patient || !patient.phone) continue;

        const cleanPhone = patient.phone.replace(/\D/g, '');
        let { data: chat } = await supabase
          .from('chats')
          .select('id')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (!chat) {
          const { data: newChat } = await supabase
            .from('chats')
            .insert({
              phone: cleanPhone,
              contact_name: patient.name,
              status: 'ACTIVE',
            })
            .select()
            .single();
          chat = newChat;
        }

        if (!chat) continue;

        // Criar scheduled_messages
        let delaySeconds = 0;
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const triggerTime = rule.trigger_time || '08:00:00';
        const [hours, minutes] = triggerTime.split(':').map(Number);
        tomorrow.setHours(hours || 8, minutes || 0, 0, 0);

        for (const message of rule.message_sequence as AutomationMessage[]) {
          const scheduledFor = new Date(tomorrow.getTime() + delaySeconds * 1000);
          
          let messageContent = message.content;
          let messageCaption = message.caption;

          if (message.type === 'text') {
            messageContent = replaceVariables(message.content, { 
              patient, 
              checkout 
            });
          } else if (message.caption) {
            messageCaption = replaceVariables(message.caption, { 
              patient, 
              checkout 
            });
          }

          await supabase.from('scheduled_messages').insert({
            chat_id: chat.id,
            item_type: 'adhoc',
            title: `Retorno: ${rule.name}`,
            content: {
              type: message.type,
              content: messageContent,
              caption: messageCaption,
            },
            scheduled_for: scheduledFor.toISOString(),
            status: 'pending',
            automation_rule_id: rule.id,
          });

          await supabase.from('automation_logs').insert({
            automation_rule_id: rule.id,
            patient_id: patient.id,
            status: 'pending',
          });

          delaySeconds += message.delay || 2;
        }

        results.push({
          type: 'return_reminder',
          rule: rule.name,
          patient: patient.name,
          checkout: checkout.id,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[Automation Cron] Erro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar automações' },
      { status: 500 }
    );
  }
}
