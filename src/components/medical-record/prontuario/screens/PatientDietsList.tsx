'use client';

import { useEffect, useState } from 'react';
import { Plus, UtensilsCrossed, Loader2, Trash2 } from 'lucide-react';
import { ProntuarioScreenProps } from '@/types/prontuario';
import { usePatientDiets } from '@/hooks/atendimento/usePatientDiets';
import { RichTextEditor } from '@/components/medical-record/attendance/RichTextEditor';
import { useToast } from '@/contexts/ToastContext';

export function PatientDietsList({ patientId }: ProntuarioScreenProps) {
  const { toast } = useToast();
  const { diets, isLoading, isSaving, fetchDiets, createDiet, deleteDiet } = usePatientDiets();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => { fetchDiets(patientId); }, [patientId, fetchDiets]);

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Título é obrigatório'); return; }
    await createDiet({ patient_id: patientId, doctor_id: null, title: title.trim(), content: content || null, notes: notes.trim() || null, diet_date: new Date().toISOString().split('T')[0] });
    setTitle(''); setContent(''); setNotes(''); setShowForm(false);
    fetchDiets(patientId);
    toast.success('Dieta criada!');
  };

  const handleDelete = async (id: number) => {
    await deleteDiet(id);
    fetchDiets(patientId);
    toast.success('Dieta removida');
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-orange-500" /> Dietas
        </h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all">
          <Plus className="w-4 h-4" /> Nova Dieta
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] rounded-xl p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase mb-1 block">Título *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome da dieta" className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase mb-1 block">Conteúdo</label>
            <RichTextEditor value={content} onChange={setContent} placeholder="Orientações nutricionais..." />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase mb-1 block">Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observações adicionais..." className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg">Cancelar</button>
            <button onClick={handleCreate} disabled={isSaving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {diets.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-[#71717a]">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma dieta registrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {diets.map(diet => (
            <div key={diet.id} className="bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-slate-800 dark:text-[#fafafa]">{diet.title}</h3>
                <button onClick={() => handleDelete(diet.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
              {diet.content && <div className="text-xs text-slate-600 dark:text-[#d4d4d8] prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: diet.content }} />}
              {diet.notes && <p className="text-xs text-slate-500 mt-2 italic">{diet.notes}</p>}
              <p className="text-[10px] text-slate-400 mt-2">{diet.diet_date ? new Date(diet.diet_date + 'T00:00:00').toLocaleDateString('pt-BR') : new Date(diet.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
