'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tag, X, CheckCheck, PenTool, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { TAG_COLORS, TagData } from '@/utils/sidebarUtils';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface TagsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  tags: TagData[];
  onUpdate: () => Promise<void>;
}

export default function TagsManager({ isOpen, onClose, tags, onUpdate }: TagsManagerProps) {
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const startEditing = (tag: TagData) => {
    setEditingId(tag.id);
    setNewTagName(tag.name);
    setSelectedColor(tag.color);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewTagName('');
    setSelectedColor(TAG_COLORS[0]);
  };

  const handleSave = async () => {
    if (!newTagName.trim()) return;
    
    if (editingId) {
      const { error } = await supabase
        .from('tags')
        .update({ name: newTagName, color: selectedColor })
        .eq('id', editingId);
      
      if (!error) { 
        await onUpdate(); 
        cancelEditing(); 
      }
    } else {
      const { error } = await supabase
        .from('tags')
        .insert({ name: newTagName, color: selectedColor });
      
      if (!error) { 
        await onUpdate(); 
        setNewTagName(''); 
      }
    }
  };

  const handleDeleteClick = (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleDeleteConfirm = async () => {
    const id = confirmDeleteId;
    if (id == null) return;
    setConfirmDeleteId(null);
    await supabase.from('tags').delete().eq('id', id);
    await onUpdate();
    if (editingId === id) cancelEditing();
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <>
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Tag size={18}/> Gerenciar Etiquetas
          </h3>
          <button onClick={onClose}>
            <X size={20} className="text-gray-500 hover:text-gray-800"/>
          </button>
        </div>
        
        <div className={`p-5 bg-white border-b space-y-4 shadow-sm z-10 ${editingId ? 'ring-1 ring-blue-100 bg-blue-50/30' : ''}`}>
           {editingId && (
             <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-blue-200 bg-blue-50">
               <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Modo edição</p>
               <button
                 onClick={cancelEditing}
                 className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2"
               >
                 Cancelar edição
               </button>
             </div>
           )}
           <div className="space-y-1">
               <label className="text-xs font-bold text-gray-500 uppercase">
                 {editingId ? 'Editar Etiqueta' : 'Nova Etiqueta'}
               </label>
               <input 
                 value={newTagName} 
                 onChange={e => setNewTagName(e.target.value)}
                 placeholder="Ex: Novo Cliente" 
                 className={`w-full border rounded-lg p-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all ${
                   editingId
                     ? 'border-blue-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                     : 'border-gray-300 bg-white focus:border-green-500'
                 }`}
               />
           </div>
           
           <div>
               <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Cor</label>
               <div className="flex gap-2 overflow-x-auto px-1 py-1 scrollbar-thin">
                  {TAG_COLORS.map(c => (
                    <button 
                      key={c} 
                      onClick={() => setSelectedColor(c)}
                      className={`w-9 h-9 rounded-full shrink-0 transition-all flex items-center justify-center border border-white/60 ${
                        selectedColor === c
                          ? 'ring-2 ring-offset-2 ring-gray-400 shadow-md'
                          : 'hover:scale-105 hover:shadow-sm'
                      }`}
                      style={{ backgroundColor: c, boxShadow: selectedColor === c ? 'inset 0 0 0 1px rgba(255,255,255,0.35)' : 'inset 0 0 0 1px rgba(255,255,255,0.2)' }}
                    >
                        {selectedColor === c && <CheckCheck size={14} className="text-white drop-shadow-md"/>}
                    </button>
                  ))}
               </div>
           </div>

           <div className="flex gap-2 pt-2">
               {editingId && (
                 <button onClick={cancelEditing} className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-bold">
                   Cancelar
                 </button>
               )}
               <button 
                 onClick={handleSave} 
                 disabled={!newTagName.trim()} 
                 className={`flex-1 text-white rounded-lg py-2.5 text-sm font-bold shadow-sm disabled:opacity-50 ${
                   editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#00a884] hover:bg-[#009774]'
                 }`}
               >
                 {editingId ? 'Salvar Alterações' : 'Criar'}
               </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
           <h4 className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
             Etiquetas Existentes ({tags.length})
           </h4>
           <div className="space-y-1">
               {tags.map((tag) => (
                 <div key={tag.id} className="flex items-center justify-between p-3 mx-2 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: tag.color }}>
                         <Tag size={14} fill="white"/>
                       </div>
                       <span className="text-sm font-semibold text-gray-700">{tag.name}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => startEditing(tag)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
                         <PenTool size={16}/>
                       </button>
                       <button onClick={() => handleDeleteClick(tag.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                         <Trash2 size={16}/>
                       </button>
                    </div>
                 </div>
               ))}
           </div>
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmDeleteId != null}
      onClose={() => setConfirmDeleteId(null)}
      onConfirm={handleDeleteConfirm}
      title="Excluir etiqueta"
      message="Tem certeza que deseja excluir esta etiqueta?"
      type="danger"
      confirmText="Sim, excluir"
    />
    </>
  );

  return createPortal(modalContent, document.body);
}