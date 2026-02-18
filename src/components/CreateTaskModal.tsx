'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { X, StickyNote, CheckSquare, Calendar, Palette, Loader2, Plus, Trash2, Clock } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: Date;
  initialType: 'general' | 'sticky_note';
}

const COLORS = [
  { id: 'white', bg: 'bg-white', border: 'border-slate-200' }, // Branco padrão para tarefas
  { id: 'yellow', bg: 'bg-yellow-100', border: 'border-yellow-200' },
  { id: 'rose', bg: 'bg-rose-100', border: 'border-rose-200' },
  { id: 'blue', bg: 'bg-blue-100', border: 'border-blue-200' },
  { id: 'purple', bg: 'bg-purple-100', border: 'border-purple-200' },
  { id: 'green', bg: 'bg-emerald-100', border: 'border-emerald-200' },
];

export default function CreateTaskModal({ isOpen, onClose, onSuccess, initialDate, initialType }: ModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState(''); // Novo: Horário
  const [selectedColor, setSelectedColor] = useState(COLORS[0]); // Padrão branco
  
  const [checklist, setChecklist] = useState<{text: string, done: boolean}[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if(isOpen) {
        setTitle(''); setDescription(''); setChecklist([]); setNewItemText(''); setTime('');
        setDate(initialDate ? initialDate.toISOString().split('T')[0] : '');
        // Se for nota, começa amarelo. Se for tarefa, começa branco.
        setSelectedColor(initialType === 'sticky_note' ? COLORS[1] : COLORS[0]);
    }
  }, [isOpen, initialDate, initialType]);

  const addChecklistItem = () => {
      if (!newItemText.trim()) return;
      setChecklist([...checklist, { text: newItemText, done: false }]);
      setNewItemText('');
  };

  const removeChecklistItem = (index: number) => {
      setChecklist(checklist.filter((_, i) => i !== index));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
        const payload = {
            title,
            description,
            type: initialType,
            status: 'pending',
            due_date: initialType === 'general' ? (date || null) : null,
            due_time: initialType === 'general' ? (time || null) : null, // Salva horário
            metadata: { 
                color: selectedColor.id,
                checklist: checklist 
            },
            chat_id: null
        };

        const { error } = await supabase.from('tasks').insert(payload);
        if (error) throw error;

        onSuccess();
        onClose();
    } catch (error: any) {
        toast.toast.error(`Erro: ${error.message}`);
    } finally {
        setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">
        
        <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                {initialType === 'general' ? <><CheckSquare className="w-5 h-5 text-indigo-500"/> Nova Tarefa</> : <><StickyNote className="w-5 h-5 text-rose-500"/> Nova Nota</>}
            </h3>
            <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
        </div>

        <form onSubmit={handleSubmit} className={`p-6 transition-colors duration-500 ${selectedColor.bg}`}>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-[10px] font-bold opacity-60 uppercase mb-1">Título</label>
                    <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 rounded-xl bg-white/60 border border-black/5 outline-none font-bold text-slate-700 focus:bg-white transition-all shadow-sm" placeholder="Título..." />
                </div>
                
                {/* Se for Tarefa: Data e Hora */}
                {initialType === 'general' && (
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold opacity-60 uppercase mb-1">Data</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 rounded-xl bg-white/60 border border-black/5 outline-none text-sm text-slate-600 focus:bg-white" />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-[10px] font-bold opacity-60 uppercase mb-1">Hora</label>
                            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full p-3 rounded-xl bg-white/60 border border-black/5 outline-none text-sm text-slate-600 focus:bg-white" />
                        </div>
                    </div>
                )}

                {/* Checklist Universal (Para Tarefas e Notas) */}
                <div>
                    <label className="block text-[10px] font-bold opacity-60 uppercase mb-1">Checklist (Opcional)</label>
                    <div className="flex gap-2 mb-2">
                        <input 
                            value={newItemText} 
                            onChange={e => setNewItemText(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                            className="flex-1 p-2 rounded-lg bg-white/60 border border-black/5 text-sm outline-none focus:bg-white" 
                            placeholder="Adicionar item..." 
                        />
                        <button type="button" onClick={addChecklistItem} className="p-2 bg-white/60 rounded-lg hover:bg-white"><Plus className="w-4 h-4"/></button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                        {checklist.map((item, i) => (
                            <div key={i} className="flex justify-between items-center text-xs bg-white/40 p-2 rounded-lg">
                                <span>{item.text}</span>
                                <button type="button" onClick={() => removeChecklistItem(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3"/></button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Descrição */}
                <div>
                    <label className="block text-[10px] font-bold opacity-60 uppercase mb-1">Detalhes Extras</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full p-3 rounded-xl bg-white/60 border border-black/5 outline-none text-sm text-slate-600 focus:bg-white resize-none" placeholder="Anotações..." />
                </div>

                {/* Seletor de Cores Universal */}
                <div>
                    <label className="block text-[10px] font-bold opacity-60 uppercase mb-2 flex items-center gap-2"><Palette className="w-3 h-3"/> Cor do Cartão</label>
                    <div className="flex gap-2">
                        {COLORS.map(c => (
                            <button key={c.id} type="button" onClick={() => setSelectedColor(c)} className={`w-8 h-8 rounded-full ${c.bg} border-2 ${selectedColor.id === c.id ? 'border-slate-500 scale-110' : 'border-black/10'} transition-all shadow-sm`}></button>
                        ))}
                    </div>
                </div>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50 flex justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Salvar'}
            </button>

        </form>
      </div>
    </div>
  );
}