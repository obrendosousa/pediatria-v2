'use client';

import { useState, useEffect } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useAuth } from '@/contexts/AuthContext';
import { X, StickyNote, CheckSquare, Palette, Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

const supabase = createSchemaClient('atendimento');

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: Date;
  initialType: 'general' | 'sticky_note';
}

const COLORS = [
  { id: 'white', bg: 'bg-white dark:bg-[#1a1a22]', border: 'border-slate-200 dark:border-gray-600' },
  { id: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-200 dark:border-yellow-700/50' },
  { id: 'rose', bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-200 dark:border-rose-700/50' },
  { id: 'blue', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-700/50' },
  { id: 'purple', bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-700/50' },
  { id: 'green', bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-700/50' },
];

export default function CreateAtendimentoTaskModal({ isOpen, onClose, onSuccess, initialDate, initialType }: ModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [checklist, setChecklist] = useState<{ text: string; done: boolean }[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(''); setDescription(''); setChecklist([]); setNewItemText(''); setTime('');
      setDate(initialDate ? initialDate.toISOString().split('T')[0] : '');
      setSelectedColor(initialType === 'sticky_note' ? COLORS[1] : COLORS[0]);
    }
  }, [isOpen, initialDate, initialType]);

  const addChecklistItem = () => {
    if (!newItemText.trim()) return;
    setChecklist([...checklist, { text: newItemText, done: false }]);
    setNewItemText('');
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const payload = {
        user_id: user.id,
        title,
        description,
        type: initialType,
        status: 'pending',
        due_date: initialType === 'general' ? (date || null) : null,
        due_time: initialType === 'general' ? (time || null) : null,
        metadata: { color: selectedColor.id, checklist },
        chat_id: null,
      };

      const { error } = await supabase.from('tasks').insert(payload);
      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a1c23] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-slate-50 dark:bg-[#111118] p-4 border-b border-slate-100 dark:border-[#252530] flex justify-between items-center">
          <h3 className="font-bold text-slate-700 dark:text-[#fafafa] flex items-center gap-2">
            {initialType === 'general' ? <><CheckSquare className="w-5 h-5 text-blue-500" /> Nova Tarefa</> : <><StickyNote className="w-5 h-5 text-rose-500" /> Nova Nota</>}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Título</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#1a1a22] border border-slate-200 dark:border-[#252530] outline-none font-bold text-slate-700 dark:text-[#fafafa] focus:ring-2 focus:ring-blue-400 transition-all" placeholder="Título..." />
          </div>

          {initialType === 'general' && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#1a1a22] border border-slate-200 dark:border-[#252530] outline-none text-sm text-slate-600 dark:text-gray-300" />
              </div>
              <div className="w-1/3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Hora</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#1a1a22] border border-slate-200 dark:border-[#252530] outline-none text-sm text-slate-600 dark:text-gray-300" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Checklist (Opcional)</label>
            <div className="flex gap-2 mb-2">
              <input value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())} className="flex-1 p-2 rounded-lg bg-slate-50 dark:bg-[#1a1a22] border border-slate-200 dark:border-[#252530] text-sm outline-none text-slate-700 dark:text-gray-300" placeholder="Adicionar item..." />
              <button type="button" onClick={addChecklistItem} className="p-2 bg-slate-100 dark:bg-[#3d3d48] rounded-lg hover:bg-slate-200 dark:hover:bg-[#333338]"><Plus className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
              {checklist.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-xs bg-slate-50 dark:bg-[#1a1a22] p-2 rounded-lg">
                  <span className="text-slate-700 dark:text-gray-300">{item.text}</span>
                  <button type="button" onClick={() => setChecklist(checklist.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Detalhes Extras</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#1a1a22] border border-slate-200 dark:border-[#252530] outline-none text-sm text-slate-600 dark:text-gray-300 resize-none" placeholder="Anotações..." />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2"><Palette className="w-3 h-3" /> Cor</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c.id} type="button" onClick={() => setSelectedColor(c)} className={`w-8 h-8 rounded-full ${c.bg} border-2 ${selectedColor.id === c.id ? 'border-blue-500 scale-110' : `${c.border}`} transition-all shadow-sm`} />
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 flex justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  );
}
