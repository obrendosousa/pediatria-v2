'use client';

import { MoreVertical, Trash2, UserCog, Sparkles, Loader2 } from 'lucide-react';
import { getAvatarColorHex, getAvatarTextColor } from '@/utils/colorUtils';
import { Chat } from '@/types'; //
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient(); //
import EditContactModal from './modals/EditContactModal'; // Importar o modal novo
import { PatientInfoBadge } from './PatientInfoBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';

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
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [chat.id, chat.profile_pic]);

  const handleClearChatClick = () => {
    setConfirmClearOpen(true);
  };

  const handleClearChatConfirm = async () => {
    setConfirmClearOpen(false);
    await supabase.from('chat_messages').delete().eq('chat_id', chat.id);
    setIsMenuOpen(false);
  };

  const handleUpdate = (updatedChat: Chat) => {
      if (onChatUpdate) onChatUpdate(updatedChat);
      setIsMenuOpen(false);
  };

  const normalizePhone = (value?: string | null) => (value || '').replace(/\D/g, '');
  const contactName = (chat.contact_name || '').trim();
  const isUnsavedContact =
    !contactName || normalizePhone(contactName) === normalizePhone(chat.phone);

  // Buscar foto de perfil via Evolution API quando o chat não tem
  useEffect(() => {
    if (!chat.profile_pic && chat.id && chat.phone) {
      fetch('/api/whatsapp/profile-picture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat.id }),
      }).catch(() => {});
    }
  }, [chat.id, chat.phone, chat.profile_pic]);

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
                  style={!chat.profile_pic || avatarError ? { backgroundColor: getAvatarColorHex(chat.id) } : {}}
                >
                    {chat.profile_pic && !avatarError ? (
                      <img
                        src={chat.profile_pic}
                        alt="Foto do contato"
                        className="w-full h-full object-cover"
                        onError={() => setAvatarError(true)}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="text-base font-semibold select-none" style={{ color: getAvatarTextColor(chat.id) }}>
                        {(chat.contact_name || chat.phone || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                </div>
                <div>
                <h2 className="font-medium text-gray-800 dark:text-gray-100">{chat.contact_name || chat.phone}</h2>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">{loadingMsgs ? 'Carregando...' : chat.phone}</p>
                {isUnsavedContact && (
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="mt-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Salvar contato
                  </button>
                )}
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
                                onClick={handleClearChatClick} 
                                className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 text-sm flex gap-2 items-center transition-colors"
                            >
                                <Trash2 size={16}/> Limpar Conversa
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    <ConfirmModal
      isOpen={confirmClearOpen}
      onClose={() => setConfirmClearOpen(false)}
      onConfirm={handleClearChatConfirm}
      title="Limpar conversa"
      message="Limpar todo o histórico desta conversa?"
      type="danger"
      confirmText="Sim, limpar"
    />
    </>
  );
}