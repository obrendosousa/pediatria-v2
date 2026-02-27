'use client';

import { useState, useEffect } from 'react';
import { Zap, Plus, Calendar, RotateCcw, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { AutomationRule } from '@/types';
import AutomationCard from '@/components/automation/AutomationCard';
import AutomationModal from '@/components/automation/AutomationModal';
import { useToast } from '@/contexts/ToastContext';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function AutomationsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'milestones' | 'appointment' | 'return'>('milestones');
  const [confirmDelete, setConfirmDelete] = useState<AutomationRule | null>(null);
  const [milestoneAutomations, setMilestoneAutomations] = useState<AutomationRule[]>([]);
  const [appointmentAutomation, setAppointmentAutomation] = useState<AutomationRule | null>(null);
  const [returnAutomation, setReturnAutomation] = useState<AutomationRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<AutomationRule | null>(null);
  const [modalType, setModalType] = useState<'milestone' | 'appointment_reminder' | 'return_reminder'>('milestone');
  const [modalAgeMonths, setModalAgeMonths] = useState<number | undefined>();
  const [isAgePromptOpen, setIsAgePromptOpen] = useState(false);
  const [agePromptValue, setAgePromptValue] = useState('');

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .order('age_months', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const milestones = data.filter(a => a.type === 'milestone') as AutomationRule[];
        const appointment = data.find(a => a.type === 'appointment_reminder') as AutomationRule | undefined;
        const returnReminder = data.find(a => a.type === 'return_reminder') as AutomationRule | undefined;

        setMilestoneAutomations(milestones);
        setAppointmentAutomation(appointment || null);
        setReturnAutomation(returnReminder || null);
      }
    } catch (error) {
      console.error('Erro ao buscar automações:', error);
      toast.error('Erro ao carregar automações');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMilestone = () => {
    setAgePromptValue('');
    setIsAgePromptOpen(true);
  };

  const submitMilestoneAge = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsedAge = parseInt(agePromptValue, 10);
    if (!isNaN(parsedAge) && parsedAge > 0) {
      setModalType('milestone');
      setModalAgeMonths(parsedAge);
      setEditingAutomation(null);
      setIsAgePromptOpen(false);
      setIsModalOpen(true);
    } else {
      toast.error('Idade inválida. Digite um número maior que zero.');
    }
  };

  const handleEdit = (automation: AutomationRule) => {
    setEditingAutomation(automation);
    setModalType(automation.type);
    setModalAgeMonths(automation.age_months || undefined);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (automation: AutomationRule) => {
    setConfirmDelete(automation);
  };

  const handleDeleteConfirm = async () => {
    const automation = confirmDelete;
    if (!automation) return;
    setConfirmDelete(null);
    try {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', automation.id);

      if (error) throw error;

      fetchAutomations();
      toast.success('Automação excluída com sucesso');
    } catch (error) {
      console.error('Erro ao excluir automação:', error);
      toast.error('Erro ao excluir automação');
    }
  };

  const handleToggle = async (automation: AutomationRule) => {
    try {
      const { error } = await supabase
        .from('automation_rules')
        .update({ active: !automation.active })
        .eq('id', automation.id);

      if (error) throw error;

      fetchAutomations();
      toast.success(`Automação ${!automation.active ? 'ativada' : 'desativada'}`);
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status da automação');
    }
  };

  const handleCreateAppointmentReminder = () => {
    setModalType('appointment_reminder');
    setEditingAutomation(appointmentAutomation);
    setIsModalOpen(true);
  };

  const handleCreateReturnReminder = () => {
    setModalType('return_reminder');
    setEditingAutomation(returnAutomation);
    setIsModalOpen(true);
  };

  const tabs = [
    { id: 'milestones', label: 'Marcos de Idade', icon: TrendingUp },
    { id: 'appointment', label: 'Lembrete de Consulta', icon: Calendar },
    { id: 'return', label: 'Lembrete de Retorno', icon: RotateCcw },
  ] as const;

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] dark:bg-[#0b141a] overflow-hidden transition-colors duration-300">
      {/* Header Premium */}
      <div className="bg-white dark:bg-[#1e2028] px-8 py-8 border-b border-slate-200 dark:border-gray-800 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center shrink-0 transition-colors relative overflow-hidden">
        {/* Decorative background elements in header */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-rose-500/5 to-orange-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

        <div className="z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200 dark:shadow-rose-900/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-gray-100 flex items-center gap-2">
                Automações de Mensagens
              </h1>
              <p className="text-sm text-slate-500 dark:text-gray-400 font-medium mt-1">
                Configure jornadas automáticas para reengajar seus pacientes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm font-semibold z-10">
          <div className="px-5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#252833] border border-slate-200 dark:border-gray-700 shadow-sm">
            <span className="text-slate-500 dark:text-gray-400 mr-3">Ativas</span>
            <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md">
              {milestoneAutomations.filter((a) => a.active).length +
                (appointmentAutomation?.active ? 1 : 0) +
                (returnAutomation?.active ? 1 : 0)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Modern Tabs */}
        <div className="px-8 pt-6 pb-2 z-10">
          <div className="flex flex-col sm:flex-row gap-2 p-1.5 bg-slate-200/50 dark:bg-[#1a1d24] rounded-2xl lg:w-fit border border-slate-200/50 dark:border-gray-800">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-bold transition-all duration-300 ${isActive
                    ? 'bg-white dark:bg-[#252833] text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-white/5'
                    }`}
                >
                  <tab.icon className={`w-4 h-4 ${isActive ? 'text-rose-500' : 'opacity-70'}`} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar relative">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6 lg:pb-12">

              {activeTab === 'milestones' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white dark:bg-[#1e2028] p-6 rounded-3xl border border-slate-200 dark:border-gray-700 shadow-sm">
                    <div className="max-w-2xl">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs font-bold mb-3">
                        <TrendingUp className="w-3.5 h-3.5" /> JORNADA DE PACIENTE
                      </div>
                      <h2 className="text-xl font-black text-slate-800 dark:text-gray-100 mb-2">Marcos de Idade</h2>
                      <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed">
                        Acompanhe o crescimento dos bebês e envie mensagens acolhedoras mês a mês.
                        O disparo ocorre automaticamente quando a criança completa a idade estipulada.
                      </p>
                    </div>
                    <button
                      onClick={handleCreateMilestone}
                      className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-200 dark:shadow-rose-900/20 hover:scale-105 active:scale-95 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Nova Automação
                    </button>
                  </div>

                  {milestoneAutomations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {milestoneAutomations.map((automation) => (
                        <AutomationCard
                          key={automation.id}
                          automation={automation}
                          onEdit={() => handleEdit(automation)}
                          onDelete={() => handleDeleteClick(automation)}
                          onToggle={() => handleToggle(automation)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 border-dashed rounded-[2rem] text-center">
                      <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-3xl flex items-center justify-center mb-6 -rotate-6">
                        <TrendingUp className="w-10 h-10 text-rose-500" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-gray-100 mb-3">Nenhuma automação configurada</h3>
                      <p className="text-slate-500 dark:text-gray-400 max-w-sm mb-8 text-sm leading-relaxed">Comece criando uma mensagem especial para quando o bebê completar 1 mês de vida para dar início a jornada.</p>
                      <button
                        onClick={handleCreateMilestone}
                        className="px-8 py-3.5 bg-slate-800 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-700 dark:hover:bg-gray-100 transition-colors shadow-lg shadow-slate-200 dark:shadow-none"
                      >
                        Criar primeira automação
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'appointment' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto mt-4">
                  <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold mb-4">
                      <Calendar className="w-3.5 h-3.5" /> PRÉ-CONSULTA
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-gray-100 mb-3">Lembretes de Consulta</h2>
                    <p className="text-slate-500 dark:text-gray-400 mx-auto max-w-xl text-sm leading-relaxed">
                      Evite faltas e confirme presenças enviando uma mensagem no dia anterior ao agendamento de forma 100% automática.
                    </p>
                  </div>

                  {appointmentAutomation ? (
                    <AutomationCard
                      automation={appointmentAutomation}
                      onEdit={() => handleEdit(appointmentAutomation)}
                      onDelete={() => handleDeleteClick(appointmentAutomation)}
                      onToggle={() => handleToggle(appointmentAutomation)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 border-dashed rounded-[2rem] text-center">
                      <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center mb-6">
                        <Calendar className="w-10 h-10 text-blue-500" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-gray-100 mb-3">Nenhum lembrete configurado</h3>
                      <p className="text-slate-500 dark:text-gray-400 max-w-sm mb-8 text-sm leading-relaxed">Mantenha sua agenda cheia avisando os pacientes sobre as consultas que terão no dia seguinte.</p>
                      <button
                        onClick={handleCreateAppointmentReminder}
                        className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200 dark:shadow-none hover:scale-105 active:scale-95"
                      >
                        <Plus className="w-4 h-4" /> Configurar Lembrete
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'return' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto mt-4">
                  <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-4">
                      <RotateCcw className="w-3.5 h-3.5" /> PÓS-CONSULTA
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-gray-100 mb-3">Lembretes de Retorno</h2>
                    <p className="text-slate-500 dark:text-gray-400 mx-auto max-w-xl text-sm leading-relaxed">
                      Garanta que os pacientes não esqueçam as consultas de revisão e acompanhamento que já estão marcadas para os próximos dias.
                    </p>
                  </div>

                  {returnAutomation ? (
                    <AutomationCard
                      automation={returnAutomation}
                      onEdit={() => handleEdit(returnAutomation)}
                      onDelete={() => handleDeleteClick(returnAutomation)}
                      onToggle={() => handleToggle(returnAutomation)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 border-dashed rounded-[2rem] text-center">
                      <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center mb-6">
                        <RotateCcw className="w-10 h-10 text-emerald-500" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-gray-100 mb-3">Nenhum lembrete configurado</h3>
                      <p className="text-slate-500 dark:text-gray-400 max-w-sm mb-8 text-sm leading-relaxed">Avisa os pacientes sobre seus retornos já agendados de forma automática no dia anterior ao retorno.</p>
                      <button
                        onClick={handleCreateReturnReminder}
                        className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 dark:shadow-none hover:scale-105 active:scale-95"
                      >
                        <Plus className="w-4 h-4" /> Configurar Retornos
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      <AutomationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAutomation(null);
        }}
        onSuccess={fetchAutomations}
        automation={editingAutomation}
        type={modalType}
        ageMonths={modalAgeMonths}
      />
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir automação"
        message={confirmDelete ? `Deseja realmente excluir a automação "${confirmDelete.name}"?` : ''}
        type="danger"
        confirmText="Excluir"
      />

      {isAgePromptOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-[#1e2028] rounded-3xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-gray-100 mb-2">Idade do Marco</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
              Para qual idade em meses deseja criar a automação?
            </p>
            <form onSubmit={submitMilestoneAge}>
              <input
                type="number"
                min="1"
                autoFocus
                value={agePromptValue}
                onChange={(e) => setAgePromptValue(e.target.value)}
                placeholder="Ex: 1, 3, 6 (em meses)"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 mb-6"
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAgePromptOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-[#2a2d36] text-slate-700 dark:text-gray-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!agePromptValue}
                  className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200 dark:shadow-none disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
