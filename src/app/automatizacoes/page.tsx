'use client';

import { useState, useEffect } from 'react';
import { Zap, Plus, Calendar, RotateCcw, TrendingUp, Users, Clock, Hash } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AutomationRule } from '@/types';
import AutomationCard from '@/components/automation/AutomationCard';
import AutomationModal from '@/components/automation/AutomationModal';

type TabType = 'milestones' | 'appointment' | 'return';

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('milestones');
  const [milestoneAutomations, setMilestoneAutomations] = useState<AutomationRule[]>([]);
  const [appointmentAutomation, setAppointmentAutomation] = useState<AutomationRule | null>(null);
  const [returnAutomation, setReturnAutomation] = useState<AutomationRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<AutomationRule | null>(null);
  const [modalType, setModalType] = useState<'milestone' | 'appointment_reminder' | 'return_reminder'>('milestone');
  const [modalAgeMonths, setModalAgeMonths] = useState<number | undefined>();
  const [showCustomAgeInput, setShowCustomAgeInput] = useState(false);
  const [customAgeMonths, setCustomAgeMonths] = useState<number>(0);

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
    setShowCustomAgeInput(false);
  };

  const handleCreateCustomAge = () => {
    if (customAgeMonths > 0) {
      handleCreateMilestone(customAgeMonths);
      setCustomAgeMonths(0);
    }
  };

  const handleEdit = (automation: AutomationRule) => {
    setEditingAutomation(automation);
    setModalType(automation.type);
    setModalAgeMonths(automation.age_months || undefined);
    setIsModalOpen(true);
  };

  const handleDelete = async (automation: AutomationRule) => {
    if (!confirm(`Deseja realmente excluir a automação "${automation.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', automation.id);

      if (error) throw error;

      fetchAutomations();
    } catch (error) {
      console.error('Erro ao excluir automação:', error);
      alert('Erro ao excluir automação');
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
      alert('Erro ao alterar status da automação');
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

  const getStatsForAutomation = async (automation: AutomationRule) => {
    try {
      const { data: logs } = await supabase
        .from('automation_logs')
        .select('sent_at, patient_id')
        .eq('automation_rule_id', automation.id)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false });

      if (!logs) return { totalSent: 0 };

      const totalSent = logs.length;
      const lastSent = logs[0]?.sent_at;
      const uniquePatients = new Set(logs.map(l => l.patient_id).filter(Boolean)).size;

      return {
        totalSent,
        lastSent,
        patientsReached: uniquePatients
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return { totalSent: 0 };
    }
  };

  const milestoneAges = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24];

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] dark:bg-[#0b141a] overflow-hidden transition-colors duration-300">
      {/* Header */}
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

      {/* Tabs */}
      <div className="bg-white dark:bg-[#1e2028] border-b border-slate-200 dark:border-gray-800 px-8">
        <div className="flex gap-1">
          {[
            { id: 'milestones' as TabType, label: 'Marcos de Desenvolvimento', icon: TrendingUp },
            { id: 'appointment' as TabType, label: 'Lembrete de Consulta', icon: Calendar },
            { id: 'return' as TabType, label: 'Lembrete de Retorno', icon: RotateCcw },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors font-bold text-sm ${
                activeTab === tab.id
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
          </div>
        ) : (
          <>
            {/* Aba: Marcos de Desenvolvimento */}
            {activeTab === 'milestones' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">
                      Automações por Idade
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                      Configure mensagens automáticas quando pacientes completam determinada idade
                    </p>
                  </div>
                </div>

                {/* Input de idade personalizada */}
                <div className="mb-6 p-4 bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700">
                  {!showCustomAgeInput ? (
                    <button
                      onClick={() => setShowCustomAgeInput(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-[#2a2d36] hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-gray-700 rounded-lg text-sm font-medium text-slate-700 dark:text-gray-300 transition-colors"
                    >
                      <Hash className="w-4 h-4" />
                      Adicionar Idade Personalizada
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 mb-2">
                          Idade em Meses
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={customAgeMonths || ''}
                          onChange={(e) => setCustomAgeMonths(parseInt(e.target.value) || 0)}
                          placeholder="Ex: 120 (10 anos)"
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-lg text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                          autoFocus
                        />
                        {customAgeMonths > 0 && (
                          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                            {customAgeMonths} meses = {Math.floor(customAgeMonths / 12)} {Math.floor(customAgeMonths / 12) === 1 ? 'ano' : 'anos'} e {customAgeMonths % 12} {customAgeMonths % 12 === 1 ? 'mês' : 'meses'}
                          </p>
                        )}
                      </div>
                      <div className="flex items-end gap-2">
                        <button
                          onClick={handleCreateCustomAge}
                          disabled={customAgeMonths <= 0}
                          className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Criar
                        </button>
                        <button
                          onClick={() => {
                            setShowCustomAgeInput(false);
                            setCustomAgeMonths(0);
                          }}
                          className="px-4 py-2 bg-slate-100 dark:bg-[#2a2d36] text-slate-700 dark:text-gray-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Grid de idades */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
                  {milestoneAges.map(age => {
                    const automation = milestoneAutomations.find(a => a.age_months === age);
                    return (
                      <div
                        key={age}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          automation
                            ? automation.active
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-50 dark:bg-[#2a2d36] border-slate-300 dark:border-gray-700'
                            : 'bg-white dark:bg-[#1e2028] border-slate-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-700'
                        }`}
                        onClick={() => automation ? handleEdit(automation) : handleCreateMilestone(age)}
                      >
                        <div className="text-center">
                          <div className="text-2xl font-black text-slate-800 dark:text-gray-100 mb-1">
                            {age}
                          </div>
                          <div className="text-xs font-bold text-slate-500 dark:text-gray-400">
                            {age === 1 ? 'mês' : 'meses'}
                          </div>
                          {automation && (
                            <div className="mt-2 text-xs font-medium">
                              {automation.active ? (
                                <span className="text-emerald-600 dark:text-emerald-400">✓ Ativo</span>
                              ) : (
                                <span className="text-slate-400">Inativo</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Lista de automações criadas */}
                {milestoneAutomations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-4">
                      Automações Configuradas ({milestoneAutomations.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {milestoneAutomations
                        .sort((a, b) => (a.age_months || 0) - (b.age_months || 0))
                        .map(automation => (
                          <AutomationCard
                            key={automation.id}
                            automation={automation}
                            onEdit={() => handleEdit(automation)}
                            onDelete={() => handleDelete(automation)}
                            onToggle={() => handleToggle(automation)}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Aba: Lembrete de Consulta */}
            {activeTab === 'appointment' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">
                      Lembrete de Consulta
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                      Mensagem automática enviada 1 dia antes da consulta agendada
                    </p>
                  </div>
                  <button
                    onClick={handleCreateAppointmentReminder}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-none transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    {appointmentAutomation ? 'Editar' : 'Criar'} Automação
                  </button>
                </div>

                {appointmentAutomation ? (
                  <AutomationCard
                    automation={appointmentAutomation}
                    onEdit={() => handleEdit(appointmentAutomation)}
                    onDelete={() => handleDelete(appointmentAutomation)}
                    onToggle={() => handleToggle(appointmentAutomation)}
                  />
                ) : (
                  <div className="text-center py-12 bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-200 dark:border-gray-700">
                    <Calendar className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-gray-400">
                      Nenhuma automação configurada. Clique em "Criar Automação" para começar.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Aba: Lembrete de Retorno */}
            {activeTab === 'return' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">
                      Lembrete de Retorno
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                      Mensagem automática enviada 1 dia antes do retorno agendado
                    </p>
                  </div>
                  <button
                    onClick={handleCreateReturnReminder}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-none transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    {returnAutomation ? 'Editar' : 'Criar'} Automação
                  </button>
                </div>

                {returnAutomation ? (
                  <AutomationCard
                    automation={returnAutomation}
                    onEdit={() => handleEdit(returnAutomation)}
                    onDelete={() => handleDelete(returnAutomation)}
                    onToggle={() => handleToggle(returnAutomation)}
                  />
                ) : (
                  <div className="text-center py-12 bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-200 dark:border-gray-700">
                    <RotateCcw className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-gray-400">
                      Nenhuma automação configurada. Clique em "Criar Automação" para começar.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
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
    </div>
  );
}
