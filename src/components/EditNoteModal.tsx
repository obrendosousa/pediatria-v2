'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { X, Trash2, Plus, Check, Save, Loader2, Clock } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: any;
  onUpdate: () => void;
}

const COLORS = [
  { id: 'white', bg: 'bg-white', border: 'border-slate-200', btn: 'bg-slate-800' },
  { id: 'yellow', bg: 'bg-yellow-100', border: 'border-yellow-200', btn: 'bg-yellow-500' },
  { id: 'rose', bg: 'bg-rose-100', border: 'border-rose-200', btn: 'bg-rose-500' },
  { id: 'blue', bg: 'bg-blue-100', border: 'border-blue-200', btn: 'bg-blue-500' },
  { id: 'purple', bg: 'bg-purple-100', border: 'border-purple-200', btn: 'bg-purple-500' },
  { id: 'green', bg: 'bg-emerald-100', border: 'border-emerald-200', btn: 'bg-emerald-500' },
];

export default function EditNoteModal({ isOpen, onClose, note, onUpdate }: EditModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColorId, setSelectedColorId] = useState('white');
  const [time, setTime] = useState(''); // Estado para o Horário
  const [checklist, setChecklist] = useState<{text: string, done: boolean}[]>([]);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    if (note && isOpen) {
        setTitle(note.title || '');
        setDescription(note.description || '');
        setSelectedColorId(note.metadata?.color || 'white');
        setChecklist(note.metadata?.checklist || []);
        setTime(note.due_time || ''); // Carrega o horário do banco
    }
  }, [note, isOpen]);

  const addChecklistItem = () => {
      if (!newItemText.trim()) return;
      setChecklist([...checklist, { text: newItemText, done: false }]);
      setNewItemText('');
  };

  const toggleItem = (index: number) => {
      const newC = [...checklist]; newC[index].done = !newC[index].done;
      setChecklist(newC);
  };

  const removeItem = (index: number) => {
      setChecklist(checklist.filter((_, i) => i !== index));
  };

  async function handleSave() {
    setLoading(true);
    try {
        await supabase.from('tasks').update({
            title,
            description,
            due_time: time || null, // Salva o novo horário
            metadata: { 
                color: selectedColorId, 
                checklist: checklist 
            }
        }).eq('id', note.id);
        
        onUpdate();
        onClose();
    } catch (error) {
        console.error(error);
        toast.toast.error('Erro ao salvar');
    } finally {
        setLoading(false);
    }
  }

  function handleDeleteClick() {
      setConfirmDeleteOpen(true);
  }

  async function handleDeleteConfirm() {
      setConfirmDeleteOpen(false);
      await supabase.from('tasks').update({ status: 'deleted' }).eq('id', note.id);
      onUpdate();
      onClose();
  }

  if (!isOpen || !note) return null;

  const colorTheme = COLORS.find(c => c.id === selectedColorId) || COLORS[0];

  return (
    <>
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
      <div className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up transition-colors duration-500 ${colorTheme.bg} flex flex-col max-h-[90vh]`}>
        
        {/* Header */}
        <div className={`p-4 border-b ${colorTheme.border} flex justify-between items-center bg-white/40`}>
            <div className="flex gap-2">
                {COLORS.map(c => (
                    <button key={c.id} onClick={() => setSelectedColorId(c.id)} className={`w-6 h-6 rounded-full border-2 ${c.bg} ${selectedColorId === c.id ? 'border-slate-600 scale-110' : 'border-black/5 hover:scale-110'} transition-all`}/>
                ))}
            </div>
            <div className="flex gap-2">
                <button onClick={handleDeleteClick} className="p-2 hover:bg-red-100 text-red-400 rounded-full"><Trash2 className="w-5 h-5"/></button>
                <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full"><X className="w-5 h-5 opacity-50"/></button>
            </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent text-xl font-bold text-slate-800 placeholder:text-slate-400/70 outline-none mb-2" placeholder="Título" />
            
            {/* Campo de Horário (Aparece se for Tarefa ou se já tiver horário) */}
            {(note.type === 'general' || time) && (
                <div className="flex items-center gap-2 mb-4 text-slate-500 bg-white/40 p-2 rounded-xl w-fit border border-black/5">
                    <Clock className="w-4 h-4" />
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-transparent text-sm font-bold outline-none text-slate-700" />
                </div>
            )}

            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400/70 outline-none resize-none min-h-[60px]" placeholder="Detalhes ou anotações..." />

            {/* Checklist */}
            <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold opacity-50 uppercase">Checklist</span>
                    <span className="text-[10px] font-bold opacity-50">{checklist.filter(i=>i.done).length}/{checklist.length}</span>
                </div>

                <div className="space-y-2 mb-3">
                    {checklist.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 group">
                            <button onClick={() => toggleItem(i)} className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${item.done ? 'bg-black/20 border-transparent' : 'border-black/20 hover:border-black/40'}`}>
                                {item.done && <Check className="w-3 h-3 text-white"/>}
                            </button>
                            <input value={item.text} onChange={(e) => { const newC = [...checklist]; newC[i].text = e.target.value; setChecklist(newC); }} className={`flex-1 bg-transparent text-sm outline-none ${item.done ? 'line-through opacity-50' : 'text-slate-800'}`} />
                            <button onClick={() => removeItem(i)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-100 p-1 rounded transition-all"><X className="w-3 h-3"/></button>
                        </div>
                    ))}
                </div>
                
                <div className="flex items-center gap-2 bg-white/40 p-2 rounded-xl border border-black/5">
                    <Plus className="w-4 h-4 opacity-50"/>
                    <input value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addChecklistItem()} className="flex-1 bg-transparent text-sm outline-none placeholder:text-black/30" placeholder="Novo item..." />
                    <button onClick={addChecklistItem} className="text-xs font-bold opacity-50 hover:opacity-100">ADD</button>
                </div>
            </div>
        </div>

        <div className="p-4 bg-white/40 border-t border-black/5 flex justify-end">
            <button onClick={handleSave} disabled={loading} className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-70 ${colorTheme.btn}`}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Save className="w-4 h-4"/> Salvar Alterações</>}
            </button>
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmDeleteOpen}
      onClose={() => setConfirmDeleteOpen(false)}
      onConfirm={handleDeleteConfirm}
      title="Excluir nota"
      message="Excluir permanentemente?"
      type="danger"
      confirmText="Sim, excluir"
    />
    </>
  );
}