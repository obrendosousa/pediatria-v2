// src/app/api/dashboard/metrics/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usa as mesmas variáveis de ambiente do cliente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Para APIs, pode precisar de service role key se necessário acessar dados protegidos
// Por enquanto, usa anon key
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // Últimos 30 dias por padrão
    const doctorId = searchParams.get('doctor_id'); // Opcional: filtrar por médico
    
    const daysAgo = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    const startDateISO = startDate.toISOString();

    // 1. Agendamentos do período
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*')
      .gte('start_time', startDateISO)
      .order('start_time', { ascending: false });

    if (appointmentsError) throw appointmentsError;

    // 2. Pacientes únicos
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, name, birth_date, created_at, biological_sex')
      .gte('created_at', startDateISO);

    if (patientsError) throw patientsError;

    // 3. Atendimentos (medical_records)
    const { data: medicalRecords, error: recordsError } = await supabase
      .from('medical_records')
      .select('*')
      .gte('created_at', startDateISO);

    if (recordsError) throw recordsError;

    // 4. Consultas do dia (para sidebar)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    const { data: todayAppointments } = await supabase
      .from('appointments')
      .select('id, start_time, patient_name, status, notes')
      .gte('start_time', todayISO)
      .lt('start_time', tomorrowISO)
      .order('start_time', { ascending: true });

    // === CÁLCULOS ===

    // Métricas básicas
    const scheduledCount = appointments?.length || 0;
    const confirmedCount = appointments?.filter(a => a.status === 'confirmed' || a.status === 'scheduled')?.length || 0;
    const attendedCount = medicalRecords?.length || 0;
    const missedCount = appointments?.filter(a => a.status === 'missed' || a.status === 'cancelled')?.length || 0;

    // Distribuição de gênero
    const maleCount = patients?.filter(p => p.biological_sex === 'M' || p.biological_sex === 'MALE')?.length || 0;
    const femaleCount = patients?.filter(p => p.biological_sex === 'F' || p.biological_sex === 'FEMALE')?.length || 0;
    const totalPatients = patients?.length || 0;

    // Novos vs Recorrentes
    const newPatients = patients?.filter(p => {
      const createdAt = new Date(p.created_at);
      return createdAt >= startDate;
    }).length || 0;
    const recurringPatients = totalPatients - newPatients;

    // Procedimentos
    const consultations = medicalRecords?.filter(r => r.diagnosis?.toLowerCase().includes('consulta') || !r.diagnosis)?.length || 0;
    const returns = medicalRecords?.filter(r => r.diagnosis?.toLowerCase().includes('retorno'))?.length || 0;
    const totalProcedures = medicalRecords?.length || 0;

    // Duração média de atendimento
    const durations = medicalRecords
      ?.filter(r => r.started_at && r.finished_at)
      .map(r => {
        const start = new Date(r.started_at!).getTime();
        const finish = new Date(r.finished_at!).getTime();
        return (finish - start) / (1000 * 60); // minutos
      }) || [];
    const avgDuration = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Distribuição etária
    const ageGroups: Record<string, number> = {};
    patients?.forEach(p => {
      if (p.birth_date) {
        const birth = new Date(p.birth_date);
        const age = Math.floor((new Date().getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        const group = Math.floor(age / 4) * 4; // Grupos de 4 anos (0-3, 4-7, etc)
        ageGroups[group] = (ageGroups[group] || 0) + 1;
      }
    });

    // Atendimentos ao longo do tempo (para gráfico de linha)
    const appointmentsByDate: Record<string, number> = {};
    appointments?.forEach(a => {
      const date = new Date(a.start_time).toLocaleDateString('pt-BR');
      appointmentsByDate[date] = (appointmentsByDate[date] || 0) + 1;
    });

    // Aniversariantes do dia
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    const birthdaysToday = patients?.filter(p => {
      if (!p.birth_date) return false;
      const birth = new Date(p.birth_date);
      return birth.getMonth() === todayMonth && birth.getDate() === todayDay;
    }).slice(0, 5) || [];

    return NextResponse.json({
      summary: {
        scheduled: scheduledCount,
        confirmed: confirmedCount,
        attended: attendedCount,
        missed: missedCount,
      },
      demographics: {
        total: totalPatients,
        male: { count: maleCount, percentage: totalPatients > 0 ? Math.round((maleCount / totalPatients) * 100) : 0 },
        female: { count: femaleCount, percentage: totalPatients > 0 ? Math.round((femaleCount / totalPatients) * 100) : 0 },
        new: { count: newPatients, percentage: totalPatients > 0 ? Math.round((newPatients / totalPatients) * 100) : 0 },
        recurring: { count: recurringPatients, percentage: totalPatients > 0 ? Math.round((recurringPatients / totalPatients) * 100) : 0 },
        ageDistribution: ageGroups,
      },
      procedures: {
        total: totalProcedures,
        consultations: { count: consultations, percentage: totalProcedures > 0 ? Math.round((consultations / totalProcedures) * 100) : 0 },
        returns: { count: returns, percentage: totalProcedures > 0 ? Math.round((returns / totalProcedures) * 100) : 0 },
      },
      performance: {
        avgDuration: avgDuration, // em minutos
      },
      timeline: {
        appointmentsByDate,
      },
      today: {
        appointments: todayAppointments || [],
        birthdays: birthdaysToday,
      },
    });
  } catch (error: any) {
    console.error('[Dashboard API Error]', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar métricas' },
      { status: 500 }
    );
  }
}
