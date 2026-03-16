'use client';

import { useState, useEffect } from 'react';
import { X, Save, Clock, ChevronRight, ChevronLeft, CheckCircle2, Calendar } from 'lucide-react';
import { AutomationRule, AutomationMessage } from '@/types';
import MessageSequenceBuilder from './MessageSequenceBuilder';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { replaceVariables } from '@/utils/automationVariables';
import { Patient } from '@/types/patient';
import { useToast } from '@/contexts/ToastContext';

interface AutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  automation?: AutomationRule | null;
  type: 'milestone' | 'appointment_reminder' | 'return_reminder';
  ageMonths?: number;
}

export default function AutomationModal({
  isOpen,
  onClose,
  onSuccess,
  automation,
  type,
  ageMonths: initialAgeMonths
}: AutomationModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [triggerTime, setTriggerTime] = useState('08:00');
  const [ageMonths, setAgeMonths] = useState<number | ''>(initialAgeMonths || '');
  const [messages, setMessages] = useState<AutomationMessage[]>([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewPatient, setPreviewPatient] = useState<Patient | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      if (automation) {
        setName(automation.name);
        const time = automation.trigger_time || '08:00:00';
        setTriggerTime(time.substring(0, 5));
        setMessages(automation.message_sequence || []);
        setActive(automation.active);
        setAgeMonths(automation.age_months || '');
      } else {
        const age = initialAgeMonths || '';
        setAgeMonths(age);
        setName(type === 'milestone' && age ? `Marco de ${age} ${age === 1 ? 'mês' : 'meses'}` : '');
        setTriggerTime('08:00');
        setMessages([]);
        setActive(true);
      }

      loadPreviewPatient();
    }
  }, [isOpen, automation, type, initialAgeMonths]);

  // Atualiza nome automaticamente quando muda a idade (só para novos milestones)
  useEffect(() => {
    if (type === 'milestone' && !automation && ageMonths) {
      setName(`Marco de ${ageMonths} ${ageMonths === 1 ? 'mês' : 'meses'}`);
    }
  }, [ageMonths, type, automation]);

  const loadPreviewPatient = async () => {
    try {
      const { data } = await supabase
        .from('patients')
        .select('*')
        .not('birth_date', 'is', null)
        .limit(1)
        .maybeSingle();

      if (data) {
        setPreviewPatient(data as Patient);
      }
    } catch (error) {
      console.error('Erro ao carregar paciente de exemplo:', error);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Por favor, informe um nome para a automação');
      return;
    }

    if (type === 'milestone' && (!ageMonths || ageMonths <= 0)) {
      toast.error('Por favor, informe a idade em meses para o marco');
      return;
    }

    if (messages.length === 0) {
      toast.error('Por favor, adicione pelo menos uma mensagem');
      return;
    }

    for (const msg of messages) {
      if (!msg.content.trim()) {
        toast.error(`Por favor, preencha o conteúdo da mensagem ${messages.indexOf(msg) + 1}`);
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        type,
        active,
        trigger_time: triggerTime.length === 5 ? `${triggerTime}:00` : triggerTime,
        message_sequence: messages,
        age_months: type === 'milestone' ? (ageMonths || null) : null,
      };

      if (automation) {
        const { error } = await supabase
          .from('automation_rules')
          .update(payload)
          .eq('id', automation.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('automation_rules')
          .insert(payload);

        if (error) throw error;
      }

      onSuccess();
      onClose();
      toast.success(automation ? 'Automação atualizada!' : 'Automação criada!');
    } catch (error: unknown) {
      console.error('Erro ao salvar automação:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao salvar automação: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const steps = [
    { id: 1 as const, label: 'Configuração' },
    { id: 2 as const, label: 'Sequência' },
    { id: 3 as const, label: 'Revisão' },
  ];

  const isSetupStepValid = name.trim().length > 0 && triggerTime.length >= 4 &&
    (type !== 'milestone' || (typeof ageMonths === 'number' && ageMonths > 0));
  const isSequenceStepValid =
    messages.length > 0 && messages.every((message) => message.content.trim().length > 0);

  const handleNextStep = () => {
    if (step === 1 && !isSetupStepValid) {
      toast.error('Preencha todos os campos antes de continuar');
      return;
    }

    if (step === 2 && !isSequenceStepValid) {
      toast.error('Preencha todas as mensagens da sequência antes de continuar');
      return;
    }

    setStep((current) => (current < 3 ? ((current + 1) as 1 | 2 | 3) : current));
  };

  const handlePreviousStep = () => {
    setStep((current) => (current > 1 ? ((current - 1) as 1 | 2 | 3) : current));
  };

  const getPreviewText = (message: AutomationMessage): string => {
    if (message.type !== 'text') return message.caption || '';
    if (!previewPatient) return message.content;
    try {
      return replaceVariables(message.content, { patient: previewPatient });
    } catch (error) {
      console.error('Erro ao processar preview:', error);
      return message.content;
    }
  };

  const getTypeTitle = () => {
    if (type === 'milestone') return 'Marco de Idade';
    if (type === 'appointment_reminder') return 'Lembrete de Consulta';
    return 'Lembrete de Retorno';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white dark:bg-[#0a0a0c] rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-[#2e2e33]">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-[#fafafa]">
              {automation ? 'Editar Automação' : 'Nova Automação'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-[#a1a1aa] mt-1">
              {getTypeTitle()}
            </p>
            <div className="flex items-center gap-2 mt-4">
              {steps.map((item, index) => {
                const isDone = step > item.id;
                const isCurrent = step === item.id;
                return (
                  <div key={item.id} className="flex items-center gap-2">
                    <button
                      onClick={() => setStep(item.id)}
                      className={`h-8 px-3 rounded-full text-xs font-bold border transition-colors ${
                        isCurrent
                          ? 'bg-rose-600 text-white border-rose-600'
                          : isDone
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 dark:bg-[#18181b] text-slate-600 dark:text-[#d4d4d8] border-slate-200 dark:border-[#2e2e33]'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : item.label}
                    </button>
                    {index < steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-gray-600" />}
                  </div>
                );
              })}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-[#71717a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {step === 1 && (
            <>
              {type === 'milestone' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-[#d4d4d8] mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Idade do Marco (em meses)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={ageMonths}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAgeMonths(val === '' ? '' : parseInt(val, 10));
                    }}
                    placeholder="Ex: 1, 3, 6, 12"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e33] rounded-xl text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                  <p className="text-xs text-slate-500 dark:text-[#a1a1aa] mt-1">
                    Quando o bebê completar essa idade, a mensagem será disparada automaticamente.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-[#d4d4d8] mb-2">
                  Nome da Automação
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Mensagem de 3 meses"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e33] rounded-xl text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-[#d4d4d8] mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Horário de Disparo
                </label>
                <input
                  type="time"
                  value={triggerTime}
                  onChange={(e) => setTriggerTime(e.target.value)}
                  className="px-4 py-3 bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e33] rounded-xl text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
                <p className="text-xs text-slate-500 dark:text-[#a1a1aa] mt-1">
                  Horário em que as mensagens serão enviadas (padrão: 08:00)
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#2e2e33]">
                <div>
                  <div className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8]">
                    Status da Automação
                  </div>
                  <div className="text-xs text-slate-500 dark:text-[#a1a1aa] mt-1">
                    {active ? 'Automação ativa e será executada automaticamente' : 'Automação desativada'}
                  </div>
                </div>
                <button
                  onClick={() => setActive(!active)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    active
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-[#d4d4d8] hover:bg-slate-400 dark:hover:bg-slate-500'
                  }`}
                >
                  {active ? 'Ativa' : 'Desativada'}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-[#d4d4d8] mb-3">
                Sequência de Mensagens
              </label>
              <MessageSequenceBuilder
                messages={messages}
                onChange={setMessages}
                previewData={previewPatient}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-[#2e2e33] bg-slate-50 dark:bg-[#18181b]">
                <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-[#71717a] mb-2">
                  Resumo
                </p>
                <p className="text-sm text-slate-700 dark:text-gray-200"><strong>Nome:</strong> {name || '-'}</p>
                {type === 'milestone' && (
                  <p className="text-sm text-slate-700 dark:text-gray-200"><strong>Idade:</strong> {ageMonths} {ageMonths === 1 ? 'mês' : 'meses'}</p>
                )}
                <p className="text-sm text-slate-700 dark:text-gray-200"><strong>Horário:</strong> {triggerTime || '-'}</p>
                <p className="text-sm text-slate-700 dark:text-gray-200"><strong>Status:</strong> {active ? 'Ativa' : 'Desativada'}</p>
                <p className="text-sm text-slate-700 dark:text-gray-200"><strong>Mensagens:</strong> {messages.length}</p>
              </div>

              {previewPatient && messages.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#2e2e33]">
                  <div className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] mb-3">
                    Preview da sequência
                  </div>
                  <div className="space-y-2">
                    {messages.map((msg, index) => (
                      <div key={index} className="p-3 bg-white dark:bg-[#0a0a0c] rounded-lg border border-slate-200 dark:border-[#2e2e33]">
                        <div className="text-xs font-medium text-slate-500 dark:text-[#a1a1aa] mb-1">
                          {index + 1}. {msg.type === 'text' ? 'Texto' : msg.type === 'audio' ? 'Áudio' : msg.type === 'image' ? 'Imagem' : 'Documento'}
                        </div>
                        {msg.type === 'text' ? (
                          <div className="text-sm text-slate-700 dark:text-gray-200 whitespace-pre-wrap">
                            {getPreviewText(msg)}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-600 dark:text-[#a1a1aa]">
                            {msg.content ? (
                              <span className="text-emerald-600 dark:text-emerald-400">Arquivo carregado</span>
                            ) : (
                              <span className="text-slate-400">Arquivo não selecionado</span>
                            )}
                            {msg.caption && (
                              <div className="mt-1 text-slate-700 dark:text-gray-200">
                                Legenda: {replaceVariables(msg.caption, { patient: previewPatient })}
                              </div>
                            )}
                          </div>
                        )}
                        {msg.delay && msg.delay > 0 && (
                          <div className="text-xs text-slate-400 dark:text-[#71717a] mt-1">
                            Delay: {msg.delay}s
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-200 dark:border-[#2e2e33]">
          <div className="text-xs text-slate-500 dark:text-[#a1a1aa]">
            Etapa {step} de 3
          </div>
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={handlePreviousStep}
                className="px-4 py-3 bg-slate-100 dark:bg-[#18181b] text-slate-700 dark:text-[#d4d4d8] rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            )}

            {step < 3 && (
              <button
                onClick={handleNextStep}
                disabled={(step === 1 && !isSetupStepValid) || (step === 2 && !isSequenceStepValid)}
                className="px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 dark:bg-[#18181b] text-slate-700 dark:text-[#d4d4d8] rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>

            {step === 3 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar Automação'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
