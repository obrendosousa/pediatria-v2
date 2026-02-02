'use client';

import { X, CheckCheck } from 'lucide-react';
import { Chat } from '@/types';
import { TagData } from '@/utils/sidebarUtils';

interface TagSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat | null;
  allTags: TagData[];
  onToggleTag: (chat: Chat, tagId: number) => void;
}

export default function TagSelector({ isOpen, onClose, chat, allTags, onToggleTag }: TagSelectorProps) {
   if (!isOpen || !chat) return null;
   
   const currentTagIds = (chat.tags || []).map((t: string) => parseInt(t));

   return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-transparent" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] w-72 overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
           <div>
               <span className="text-xs font-bold text-gray-500 uppercase block">Etiquetas de</span>
               <span className="font-bold text-gray-800 truncate block max-w-[180px]">
                 {chat.contact_name || chat.phone}
               </span>
           </div>
           <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 rounded-full p-1">
             <X size={16}/>
           </button>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
           {allTags.map((tag) => {
             const isSelected = currentTagIds.includes(tag.id);
             return (
               <div 
                 key={tag.id} 
                 onClick={() => onToggleTag(chat, tag.id)}
                 className={`flex items-center gap-3 p-3 mb-1 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-green-50 border border-green-100' : 'hover:bg-gray-50 border border-transparent'}`}
               >
                 <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[#00a884] border-[#00a884]' : 'border-gray-300 bg-white'}`}>
                    {isSelected && <CheckCheck size={12} className="text-white"/>}
                 </div>
                 <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }}/>
                     <span className={`text-sm ${isSelected ? 'font-bold text-green-900' : 'text-gray-700'}`}>
                       {tag.name}
                     </span>
                 </div>
               </div>
             );
           })}
           {allTags.length === 0 && <div className="p-6 text-xs text-gray-400 text-center">Nenhuma etiqueta disponível.</div>}
        </div>
      </div>
    </div>
   );
}