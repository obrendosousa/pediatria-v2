'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { Chat } from '@/types';
import { TagData } from '@/utils/sidebarUtils';

interface TagSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat | null;
  allTags: TagData[];
  onSaveTags: (chat: Chat, tagIds: number[]) => void | Promise<unknown>;
}

export default function TagSelector({ isOpen, onClose, chat, allTags, onSaveTags }: TagSelectorProps) {
   const [pendingTagIds, setPendingTagIds] = useState<number[]>([]);

   // Inicializa estado local quando abre; mantém tags originais do chat (não aplica até fechar)
   useEffect(() => {
     if (isOpen && chat) {
       const ids = (chat.tags || []).map((t: string | number) => 
         typeof t === 'string' ? parseInt(t, 10) : t
       ).filter((id: number) => !isNaN(id));
       setPendingTagIds(ids);
     }
   }, [isOpen, chat?.id]);

   if (!isOpen || !chat) return null;
   
   const handleToggle = (e: React.MouseEvent, tagId: number) => {
     e.stopPropagation();
     setPendingTagIds(prev => 
       prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
     );
   };

   const handleClose = () => {
     onSaveTags(chat, pendingTagIds);
     onClose();
   };

   const handleBackdropClick = (e: React.MouseEvent) => {
     if (e.target === e.currentTarget) handleClose();
   };

   const modalContent = (
     <div 
       className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 pointer-events-auto"
       onClick={handleBackdropClick}
     >
       <div 
         className="bg-white dark:bg-[#202c33] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] w-full max-w-[min(288px,90vw)] overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200" 
         onClick={e => e.stopPropagation()}
       >
         <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36] flex justify-between items-center">
            <div className="min-w-0 flex-1">
               <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block">Etiquetas de</span>
               <span className="font-bold text-gray-800 dark:text-gray-100 truncate block">
                 {chat.contact_name || chat.phone}
               </span>
            </div>
            <button onClick={handleClose} className="ml-2 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors shrink-0">
              <X size={18} className="text-gray-500 dark:text-gray-400"/>
            </button>
         </div>
         <div className="max-h-[min(300px,50vh)] overflow-y-auto p-2">
            {allTags.map((tag) => {
              const isSelected = pendingTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={(e) => handleToggle(e, tag.id)}
                  className={`w-full flex items-center gap-3 p-3 mb-1 rounded-lg cursor-pointer transition-all duration-200 text-left
                    ${isSelected 
                      ? 'bg-[#00a884]/10 dark:bg-[#00a884]/20 border border-[#00a884]/30 dark:border-[#00a884]/40' 
                      : 'hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent'}`}
                >
                  <div 
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 shrink-0
                      ${isSelected 
                        ? 'bg-[#00a884] border-[#00a884] scale-105' 
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1e2028]'}`}
                  >
                    {isSelected && <Check size={12} className="text-white stroke-[3] animate-in zoom-in-50 duration-150" />}
                  </div>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: tag.color || '#9ca3af' }}
                    />
                    <span className={`text-sm truncate ${isSelected ? 'font-bold text-[#00a884] dark:text-[#34d399]' : 'text-gray-700 dark:text-gray-300'}`}>
                      {tag.name}
                    </span>
                  </div>
                </button>
              );
            })}
            {allTags.length === 0 && (
              <div className="p-6 text-xs text-gray-400 dark:text-gray-500 text-center">
                Nenhuma etiqueta disponível.
              </div>
            )}
         </div>
       </div>
     </div>
   );

   if (typeof document === 'undefined') return null;
   const portalTarget = document.getElementById('modal-root') || document.body;
   return createPortal(modalContent, portalTarget);
}
