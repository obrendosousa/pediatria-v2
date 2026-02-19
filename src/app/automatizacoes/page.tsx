'use client';

import { useState, useEffect } from 'react';
import { Zap, Plus, Calendar, RotateCcw, TrendingUp, Hash, CircleDashed } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { AutomationRule } from '@/types';
import AutomationCard from '@/components/automation/AutomationCard';
import AutomationModal from '@/components/automation/AutomationModal';
import AutomationOverviewCards from '@/components/automation/AutomationOverviewCards';
import AutomationNavRail, { AutomationSection } from '@/components/automation/AutomationNavRail';
import AutomationWorkspaceHeader from '@/components/automation/AutomationWorkspaceHeader';
import { useToast } from '@/contexts/ToastContext';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function AutomationsPage() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<AutomationSection>('milestones');
  const [confirmDelete, setConfirmDelete] = useState<AutomationRule | null>(null);
  const [milestoneAutomations, setMilestoneAutomations] = useState<AutomationRule[]>([]);
  const [appointmentAutomation, setAppointmentAutomation] = useState<AutomationRule | null>(null);
  const [returnAutomation, setReturnAutomation] = useState<AutomationRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<AutomationRule | null>(null);
  const [modalType, setModalType] = useState<'milestone' | 'appointment_reminder' | 'return_reminder'>('milestone');
  const [modalAgeMonths, setModalAgeMonths] = useState<number | undefined>();
  const [customAgeMonths, setCustomAgeMonths] = useState<number>(0);
  const [selectedMilestoneAge, setSelectedMilestoneAge] = useState<number>(1);

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
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMilestone = (ageMonths: number) => {
    setModalType('milestone');
    setModalAgeMonths(ageMonths);
    setEditingAutomation(null);
    setIsModalOpen(true);
    setSelectedMilestoneAge(ageMonths);
  };

  const handleCreateCustomAge = () => {
    if (customAgeMonths > 0) {
      const existingAutomation = milestoneAutomations.find(
        (automation) => automation.age_months === customAgeMonths
      );
      if (existingAutomation) {
        handleEdit(existingAutomation);
      } else {
        handleCreateMilestone(customAgeMonths);
      }
      setCustomAgeMonths(0);
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

  const milestoneAges = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24];
  const allMilestoneAges = Array.from(
    new Set([
      ...milestoneAges,
      ...milestoneAutomations
        .map((automation) => automation.age_months)
        .filter((age): age is number => typeof age === 'number'),
    ])
  ).sort((a, b) => a - b);

  const selectedMilestoneAutomation = milestoneAutomations.find(
    (automation) => automation.age_months === selectedMilestoneAge
  );

  const navItems = [
    {
      id: 'milestones' as const,
      label: 'Marcos de Desenvolvimento',
      description: 'Disparos baseados em idade para relacionamento continuo.',
      icon: TrendingUp,
      badge: `${milestoneAutomations.length} configurada${milestoneAutomations.length === 1 ? '' : 's'}`,
      activeCount: milestoneAutomations.filter((automation) => automation.active).length,
    },
    {
      id: 'appointment' as const,
      label: 'Lembrete de Consulta',
      description: 'Mensagem automatica no dia anterior ao agendamento.',
      icon: Calendar,
      badge: appointmentAutomation ? 'Configurada' : 'Nao configurada',
      activeCount: appointmentAutomation?.active ? 1 : 0,
    },
    {
      id: 'return' as const,
      label: 'Lembrete de Retorno',
      description: 'Reengajamento automatico para retornos ja agendados.',
      icon: RotateCcw,
      badge: returnAutomation ? 'Configurada' : 'Nao configurada',
      activeCount: returnAutomation?.active ? 1 : 0,
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] dark:bg-[#0b141a] overflow-hidden transition-colors duration-300">
      <div className="bg-white dark:bg-[#1e2028] px-8 py-5 border-b border-slate-200 dark:border-gray-800 flex justify-between items-center shrink-0 transition-colors">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <Zap className="w-6 h-6 text-rose-500" /> Automações de Mensagens
          </h1>
          <p className="text-sm text-slate-400 dark:text-gray-500 font-medium mt-1">
            Configure mensagens automáticas por idade, lembretes de consulta e retorno
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <AutomationOverviewCards
              milestoneAutomations={milestoneAutomations}
              appointmentAutomation={appointmentAutomation}
              returnAutomation={returnAutomation}
            />

            <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
              <AutomationNavRail
                items={navItems}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
              />

              <section className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028] p-5 lg:p-6 space-y-6">
                {activeSection === 'milestones' && (
                  <>
                    <AutomationWorkspaceHeader
                      title="Automações por idade"
                      description="Escolha uma faixa de idade para configurar o fluxo. O painel mostra claramente o que ja existe e o proximo passo."
                      action={
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={customAgeMonths || ''}
                            onChange={(e) => setCustomAgeMonths(parseInt(e.target.value, 10) || 0)}
                            placeholder="Idade em meses"
                            className="w-36 px-3 py-2 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                          <button
                            onClick={handleCreateCustomAge}
                            disabled={customAgeMonths <= 0}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Hash className="w-4 h-4" />
                            Nova idade
                          </button>
                        </div>
                      }
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
                      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/80 dark:bg-[#252833] p-4">
                        <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 dark:text-gray-500 mb-3">
                          Faixas sugeridas
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {allMilestoneAges.map((age) => {
                            const automation = milestoneAutomations.find((item) => item.age_months === age);
                            const isSelected = age === selectedMilestoneAge;
                            return (
                              <button
                                key={age}
                                onClick={() => setSelectedMilestoneAge(age)}
                                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                                  isSelected
                                    ? 'border-rose-300 dark:border-rose-700 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                                    : automation?.active
                                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                      : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200'
                                }`}
                              >
                                {age}m
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/80 dark:bg-[#252833] p-4">
                        <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 dark:text-gray-500 mb-3">
                          Detalhe da faixa selecionada
                        </p>
                        {selectedMilestoneAutomation ? (
                          <AutomationCard
                            automation={selectedMilestoneAutomation}
                            onEdit={() => handleEdit(selectedMilestoneAutomation)}
                            onDelete={() => handleDeleteClick(selectedMilestoneAutomation)}
                            onToggle={() => handleToggle(selectedMilestoneAutomation)}
                          />
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-600 bg-white dark:bg-[#1e2028] p-6 text-center">
                            <CircleDashed className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-slate-700 dark:text-gray-200 font-semibold">
                              Nenhuma automacao para {selectedMilestoneAge} {selectedMilestoneAge === 1 ? 'mes' : 'meses'}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 mb-4">
                              Crie agora um fluxo para manter relacionamento no marco certo.
                            </p>
                            <button
                              onClick={() => handleCreateMilestone(selectedMilestoneAge)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              Criar automacao
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-black text-slate-800 dark:text-gray-100 mb-3">
                        Todas as automacoes por idade ({milestoneAutomations.length})
                      </h3>
                      {milestoneAutomations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                          {milestoneAutomations
                            .slice()
                            .sort((a, b) => (a.age_months || 0) - (b.age_months || 0))
                            .map((automation) => (
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
                        <div className="text-sm text-slate-500 dark:text-gray-400 py-8 text-center">
                          Nenhuma automacao de marco configurada ainda.
                        </div>
                      )}
                    </div>
                  </>
                )}

                {activeSection === 'appointment' && (
                  <>
                    <AutomationWorkspaceHeader
                      title="Lembrete de consulta"
                      description="Automacao enviada um dia antes da consulta. Mantenha pacientes informados e reduza faltas."
                      action={
                        <button
                          onClick={handleCreateAppointmentReminder}
                          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          {appointmentAutomation ? 'Editar automacao' : 'Criar automacao'}
                        </button>
                      }
                    />

                    {appointmentAutomation ? (
                      <AutomationCard
                        automation={appointmentAutomation}
                        onEdit={() => handleEdit(appointmentAutomation)}
                        onDelete={() => handleDeleteClick(appointmentAutomation)}
                        onToggle={() => handleToggle(appointmentAutomation)}
                      />
                    ) : (
                      <div className="text-center py-12 bg-slate-50 dark:bg-[#252833] rounded-2xl border border-dashed border-slate-300 dark:border-gray-600">
                        <Calendar className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-slate-700 dark:text-gray-200 font-semibold">
                          Nenhum lembrete de consulta configurado
                        </p>
                        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 mb-4">
                          Crie uma automacao para enviar mensagem 1 dia antes da consulta.
                        </p>
                        <button
                          onClick={handleCreateAppointmentReminder}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Criar automacao
                        </button>
                      </div>
                    )}
                  </>
                )}

                {activeSection === 'return' && (
                  <>
                    <AutomationWorkspaceHeader
                      title="Lembrete de retorno"
                      description="Mensagens para consultas de retorno, disparadas no dia anterior ao compromisso."
                      action={
                        <button
                          onClick={handleCreateReturnReminder}
                          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          {returnAutomation ? 'Editar automacao' : 'Criar automacao'}
                        </button>
                      }
                    />

                    {returnAutomation ? (
                      <AutomationCard
                        automation={returnAutomation}
                        onEdit={() => handleEdit(returnAutomation)}
                        onDelete={() => handleDeleteClick(returnAutomation)}
                        onToggle={() => handleToggle(returnAutomation)}
                      />
                    ) : (
                      <div className="text-center py-12 bg-slate-50 dark:bg-[#252833] rounded-2xl border border-dashed border-slate-300 dark:border-gray-600">
                        <RotateCcw className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-slate-700 dark:text-gray-200 font-semibold">
                          Nenhum lembrete de retorno configurado
                        </p>
                        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 mb-4">
                          Crie uma automacao para reforcar o comparecimento em retornos.
                        </p>
                        <button
                          onClick={handleCreateReturnReminder}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Criar automacao
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        )}
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
    </div>
  );
}
