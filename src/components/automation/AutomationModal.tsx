'use client';

import { useState, useEffect } from 'react';
import { X, Save, Clock } from 'lucide-react';
import { AutomationRule, AutomationMessage } from '@/types';
import MessageSequenceBuilder from './MessageSequenceBuilder';
import { supabase } from '@/lib/supabase';
import { replaceVariables, AVAILABLE_VARIABLES } from '@/utils/automationVariables';
import { Patient } from '@/types/patient';

interface AutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  automation?: AutomationRule | null;
  type: 'milestone' | 'appointment_reminder' | 'return_reminder';
  ageMonths?: number; // Para tipo milestone
}

export default function AutomationModal({
  isOpen,
  onClose,
  onSuccess,
  automation,
  type,
  ageMonths
}: AutomationModalProps) {
  const [name, setName] = useState('');
  const [triggerTime, setTriggerTime] = useState('08:00');
  const [messages, setMessages] = useState<AutomationMessage[]>([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewPatient, setPreviewPatient] = useState<Patient | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (automation) {
        // Modo edição
        setName(automation.name);
        // Converter trigger_time de HH:MM:SS para HH:MM se necessário
        const time = automation.trigger_time || '08:00:00';
        setTriggerTime(time.substring(0, 5)); // Pega apenas HH:MM
        setMessages(automation.message_sequence || []);
        setActive(automation.active);
      } else {
        // Modo criação
        setName(type === 'milestone' ? `Marco de ${ageMonths} ${ageMonths === 1 ? 'mês' : 'meses'}` : '');
        setTriggerTime('08:00');
        setMessages([]);
        setActive(true);
      }
      
      // Carregar paciente de exemplo para preview
      loadPreviewPatient();
    }
  }, [isOpen, automation, type, ageMonths]);

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
      alert('Por favor, informe um nome para a automação');
      return;
    }

    if (messages.length === 0) {
      alert('Por favor, adicione pelo menos uma mensagem');
      return;
    }

    // Validar que todas as mensagens têm conteúdo
    for (const msg of messages) {
      if (!msg.content.trim()) {
        alert(`Por favor, preencha o conteúdo da mensagem ${messages.indexOf(msg) + 1}`);
        return;
      }
    }

    setSaving(true);

    try {
      const payload: any = {
        name: name.trim(),
        type,
        active,
        trigger_time: triggerTime.length === 5 ? `${triggerTime}:00` : triggerTime, // Garantir formato HH:MM:SS
        message_sequence: messages,
        age_months: type === 'milestone' ? (ageMonths || automation?.age_months) : null,
      };

      if (automation) {
        // Atualizar
        const { error } = await supabase
          .from('automation_rules')
          .update(payload)
          .eq('id', automation.id);

        if (error) throw error;
      } else {
        // Criar
        const { error } = await supabase
          .from('automation_rules')
          .insert(payload);

        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar automação:', error);
      alert(`Erro ao salvar automação: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white dark:bg-[#1e2028] rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-gray-100">
              {automation ? 'Editar Automação' : 'Nova Automação'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
              {type === 'milestone' && `Marco de ${ageMonths || automation?.age_months} ${(ageMonths || automation?.age_months) === 1 ? 'mês' : 'meses'}`}
              {type === 'appointment_reminder' && 'Lembrete de Consulta'}
              {type === 'return_reminder' && 'Lembrete de Retorno'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Nome */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2">
              Nome da Automação
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Mensagem de 3 meses"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          {/* Horário de disparo */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Horário de Disparo
            </label>
            <input
              type="time"
              value={triggerTime}
              onChange={(e) => setTriggerTime(e.target.value)}
              className="px-4 py-3 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
              Horário em que as mensagens serão enviadas (padrão: 08:00)
            </p>
          </div>

          {/* Construtor de mensagens */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">
              Sequência de Mensagens
            </label>
            <MessageSequenceBuilder
              messages={messages}
              onChange={setMessages}
              previewData={previewPatient}
            />
          </div>

          {/* Preview geral */}
          {previewPatient && messages.length > 0 && (
            <div className="p-4 bg-slate-50 dark:bg-[#2a2d36] rounded-xl border border-slate-200 dark:border-gray-700">
              <div className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">
                Preview (com dados de exemplo):
              </div>
              <div className="space-y-2">
                {messages.map((msg, index) => (
                  <div key={index} className="p-3 bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">
                      {index + 1}. {msg.type === 'text' ? 'Texto' : msg.type === 'audio' ? 'Áudio' : msg.type === 'image' ? 'Imagem' : 'Documento'}
                    </div>
                    {msg.type === 'text' ? (
                      <div className="text-sm text-slate-700 dark:text-gray-200 whitespace-pre-wrap">
                        {getPreviewText(msg)}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-600 dark:text-gray-400">
                        {msg.content ? (
                          <span className="text-emerald-600 dark:text-emerald-400">✓ Arquivo carregado</span>
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
                      <div className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                        Delay: {msg.delay}s
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ativar/Desativar */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#2a2d36] rounded-xl border border-slate-200 dark:border-gray-700">
            <div>
              <div className="text-sm font-bold text-slate-700 dark:text-gray-300">
                Status da Automação
              </div>
              <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                {active ? 'Automação ativa e será executada automaticamente' : 'Automação desativada'}
              </div>
            </div>
            <button
              onClick={() => setActive(!active)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                active
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-gray-300 hover:bg-slate-400 dark:hover:bg-slate-500'
              }`}
            >
              {active ? 'Ativa' : 'Desativada'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-100 dark:bg-[#2a2d36] text-slate-700 dark:text-gray-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Automação'}
          </button>
        </div>
      </div>
    </div>
  );
}
