'use client';

import { useEffect, useState } from 'react';
import { Plus, Target, Loader2 } from 'lucide-react';
import { ProntuarioScreenProps } from '@/types/prontuario';
import { useTherapeuticPlans } from '@/hooks/atendimento/useTherapeuticPlans';
import { RichTextEditor } from '@/components/medical-record/attendance/RichTextEditor';
import { useToast } from '@/contexts/ToastContext';

export function TherapeuticPlansList({ patientId }: ProntuarioScreenProps) {
  const { toast } = useToast();
  const { plans, isLoading, isSaving, fetchPlans, createPlan, updatePlanStatus } = useTherapeuticPlans();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => { fetchPlans(patientId); }, [patientId, fetchPlans]);

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Nome é obrigatório'); return; }
    await createPlan({ patient_id: patientId, doctor_id: null, title: title.trim(), description: description || null, status: 'active' });
    setTitle(''); setDescription(''); setShowForm(false);
    fetchPlans(patientId);
    toast.success('Plano criado!');
  };

  const handleToggleStatus = async (id: number, current: string) => {
    const next = current === 'active' ? 'completed' : 'active';
    await updatePlanStatus(id, next as 'active' | 'completed');
    fetchPlans(patientId);
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-500" /> Planos Terapêuticos
        </h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all">
          <Plus className="w-4 h-4" /> Novo Plano
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] rounded-xl p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase mb-1 block">Nome *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do plano terapêutico" className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase mb-1 block">Foco / Objetivo</label>
            <RichTextEditor value={description} onChange={setDescription} placeholder="Descreva o foco do tratamento..." />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg">Cancelar</button>
            <button onClick={handleCreate} disabled={isSaving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-[#71717a]">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum plano terapêutico registrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-slate-800 dark:text-[#fafafa]">{plan.title}</h3>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${plan.status === 'active' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {plan.status === 'active' ? 'ATIVO' : plan.status === 'completed' ? 'CONCLUÍDO' : 'CANCELADO'}
                  </span>
                  <button onClick={() => handleToggleStatus(plan.id, plan.status)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">
                    {plan.status === 'active' ? 'Concluir' : 'Reativar'}
                  </button>
                </div>
              </div>
              {plan.description && <div className="text-xs text-slate-600 dark:text-[#d4d4d8] prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: plan.description }} />}
              <p className="text-[10px] text-slate-400 mt-2">{new Date(plan.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
