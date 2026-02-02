import { MoreVertical, Trash2, User, Edit, UserCog, Sparkles, Loader2 } from 'lucide-react';
import { getAvatarColorHex, getAvatarTextColor } from '@/utils/colorUtils';
import { Chat } from '@/types'; //
import { useState } from 'react';
import { supabase } from '@/lib/supabase'; //
import EditContactModal from './modals/EditContactModal'; // Importar o modal novo
import { PatientInfoBadge } from './PatientInfoBadge';

interface ChatHeaderProps {
  chat: Chat;
  loadingMsgs: boolean;
  onChatUpdate?: (chat: Chat) => void; // Callback para atualizar o pai
  onAISchedule?: () => void; // Função para acionar agendamento com IA
  isLoadingAI?: boolean; // Estado de loading da IA
}

export default function ChatHeader({ chat, loadingMsgs, onChatUpdate, onAISchedule, isLoadingAI }: ChatHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleClearChat = async () => {
    if(confirm("Limpar todo o histórico desta conversa?")) {
        await supabase.from('chat_messages').delete().eq('chat_id', chat.id);
        setIsMenuOpen(false);
    }
  };

  const handleUpdate = (updatedChat: Chat) => {
      if (onChatUpdate) onChatUpdate(updatedChat);
      setIsMenuOpen(false);
  };

  return (
    <>
        <EditContactModal 
            isOpen={isEditModalOpen} 
            onClose={() => setIsEditModalOpen(false)} 
            chat={chat} 
            onUpdate={handleUpdate}
        />

        <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-2.5 border-l border-gray-300 dark:border-gray-700 flex items-center justify-between z-10 shadow-sm transition-colors duration-300">
            <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border-2 border-white/50 dark:border-gray-600"
                  style={!chat.profile_pic ? { backgroundColor: getAvatarColorHex(chat.id) } : {}}
                >
                    {chat.profile_pic ? (
                      <img src={chat.profile_pic} className="w-full h-full object-cover"/>
                    ) : (
                      <User 
                        className="w-6 h-6 opacity-80" 
                        style={{ color: getAvatarTextColor(chat.id) }}
                      />
                    )}
                </div>
                <div>
                <h2 className="font-medium text-gray-800 dark:text-gray-100">{chat.contact_name || chat.phone}</h2>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">{loadingMsgs ? 'Carregando...' : chat.phone}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                {/* Badge de Paciente Vinculado */}
                {chat.patient_id && (
                  <PatientInfoBadge 
                    chatId={chat.id} 
                    patientId={chat.patient_id}
                  />
                )}
                
                {/* Botão Agendar com IA */}
                {onAISchedule && (
                    <button
                        onClick={onAISchedule}
                        disabled={isLoadingAI}
                        className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        title="Agendar paciente usando IA"
                    >
                        {isLoadingAI ? (
                            <>
                                <Loader2 size={14} className="animate-spin"/>
                                Processando...
                            </>
                        ) : (
                            <>
                                <Sparkles size={14}/>
                                Agendar (IA)
                            </>
                        )}
                    </button>
                )}
                
                <div className="relative">
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
                        <MoreVertical size={20} className="text-gray-600 dark:text-gray-300" />
                    </button>
                
                    {isMenuOpen && (
                        <div className="absolute right-0 top-10 bg-white dark:bg-[#2a2d36] shadow-xl rounded-lg border border-gray-100 dark:border-gray-700 py-1 w-48 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                            <button 
                                onClick={() => setIsEditModalOpen(true)} 
                                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 text-sm flex gap-2 items-center transition-colors"
                            >
                                <UserCog size={16}/> Editar Contato
                            </button>
                            <div className="h-[1px] bg-gray-100 dark:bg-gray-700 my-1"/>
                            <button 
                                onClick={handleClearChat} 
                                className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 text-sm flex gap-2 items-center transition-colors"
                            >
                                <Trash2 size={16}/> Limpar Conversa
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </>
  );
}