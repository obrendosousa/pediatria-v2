/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */
'use client';

import { MoreVertical, Trash2, UserCog, Sparkles, Loader2, Bot, Users } from 'lucide-react';
import { getAvatarColorHex, getAvatarTextColor } from '@/utils/colorUtils';
import { Chat } from '@/types';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import EditContactModal from './modals/EditContactModal';
import { PatientInfoBadge } from './PatientInfoBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useModuleSafe } from '@/contexts/ModuleContext';

interface ChatHeaderProps {
  chat: Chat;
  loadingMsgs: boolean;
  onChatUpdate?: (chat: Chat) => void;
  onAISchedule?: () => void;
  isLoadingAI?: boolean;
}

export default function ChatHeader({ chat, loadingMsgs, onChatUpdate, onAISchedule, isLoadingAI }: ChatHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const moduleCtx = useModuleSafe();
  const schema = moduleCtx?.config?.schema || 'public';

  const isAIChat = chat?.phone === '00000000000';
  const isGroupChat = chat?.is_group === true;

  useEffect(() => {
    setAvatarError(false);
  }, [chat?.id, chat?.profile_pic]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleClearChatClick = () => {
    setConfirmClearOpen(true);
  };

  const handleClearChatConfirm = async () => {
    setConfirmClearOpen(false);
    if (chat?.id) {
        await supabase.from('chat_messages').delete().eq('chat_id', chat.id);
    }
    setIsMenuOpen(false);
  };

  const handleUpdate = (updatedChat: Chat) => {
      if (onChatUpdate) onChatUpdate(updatedChat);
      setIsMenuOpen(false);
  };

  const normalizePhone = (value?: string | null) => (value || '').replace(/\D/g, '');
  const contactName = (chat?.contact_name || '').trim();
  const isUnsavedContact =
    !contactName || normalizePhone(contactName) === normalizePhone(chat?.phone);

  useEffect(() => {
    if (!isAIChat && !chat?.profile_pic && chat?.id && chat?.phone) {
      fetch('/api/whatsapp/profile-picture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat.id, schema }),
      }).catch(() => {});
    }
  }, [chat?.id, chat?.phone, chat?.profile_pic, isAIChat, schema]);

  return (
    <>
        <EditContactModal 
            isOpen={isEditModalOpen} 
            onClose={() => setIsEditModalOpen(false)} 
            chat={chat} 
            onUpdate={handleUpdate}
        />

        <div className="relative bg-[var(--chat-surface)] dark:bg-[#202c33] px-4 py-2.5 border-l border-gray-300 dark:border-[#3d3d48] flex items-center justify-between z-20 shadow-sm transition-colors duration-300">
            <div className="flex items-center gap-3">
                {isAIChat ? (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm border border-indigo-400/30">
                    <Bot size={22} className="text-white" />
                  </div>
                ) : isGroupChat ? (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border-2 border-white/50 dark:border-gray-600"
                    style={!chat?.profile_pic || avatarError ? { backgroundColor: getAvatarColorHex(chat?.id || 0) } : {}}
                  >
                      {chat?.profile_pic && !avatarError ? (
                        <img
                          src={chat.profile_pic}
                          alt="Grupo"
                          className="w-full h-full object-cover"
                          onError={() => setAvatarError(true)}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Users size={20} style={{ color: getAvatarTextColor(chat?.id || 0) }} />
                      )}
                  </div>
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border-2 border-white/50 dark:border-gray-600"
                    style={!chat?.profile_pic || avatarError ? { backgroundColor: getAvatarColorHex(chat?.id || 0) } : {}}
                  >
                      {chat?.profile_pic && !avatarError ? (
                        <img
                          src={chat.profile_pic}
                          alt="Foto do contato"
                          className="w-full h-full object-cover"
                          onError={() => setAvatarError(true)}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="text-base font-semibold select-none" style={{ color: getAvatarTextColor(chat?.id || 0) }}>
                          {(chat?.contact_name || chat?.phone || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                  </div>
                )}

                <div>
                <h2 className="font-medium text-gray-800 dark:text-[#fafafa] flex items-center gap-1.5">
                  {isAIChat && <Sparkles size={16} className="text-indigo-500" />}
                  {isGroupChat && <Users size={16} className="text-[var(--chat-accent)]" />}
                  {isAIChat ? '🤖 Clara' : (chat?.contact_name || chat?.phone)}
                </h2>
                <p className="text-[12px] text-gray-500 dark:text-[#a1a1aa]">
                  {loadingMsgs ? 'Carregando...' : (
                    isAIChat ? 'Inteligência Artificial Interna'
                    : isGroupChat ? `Grupo · ${chat?.group_metadata?.size || ''} participantes`
                    : chat?.phone
                  )}
                </p>
                {!isAIChat && !isGroupChat && isUnsavedContact && (
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="mt-1 text-[11px] font-semibold text-[var(--chat-accent)] hover:opacity-80 dark:text-[var(--chat-accent)] cursor-pointer transition-opacity"
                  >
                    Salvar contato
                  </button>
                )}
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                {chat?.patient_id && !isAIChat && (
                  <PatientInfoBadge 
                    chatId={chat.id} 
                    patientId={chat.patient_id}
                  />
                )}
                
                {onAISchedule && !isAIChat && (
                    <button
                        onClick={onAISchedule}
                        disabled={isLoadingAI}
                        className="px-3 py-1.5 bg-[var(--chat-accent)] hover:bg-[var(--chat-accent-hover)] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                        title="Agendar paciente usando IA"
                        aria-label="Agendar paciente usando IA"
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
                
                {!isAIChat && (
                  <div className="relative" ref={menuRef}>
                      <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer" aria-label="Menu">
                          <MoreVertical size={20} className="text-gray-600 dark:text-[#d4d4d8]" />
                      </button>

                      {isMenuOpen && (
                          <div className="absolute right-0 top-10 bg-white dark:bg-[#1c1c21] shadow-xl rounded-lg border border-gray-100 dark:border-[#3d3d48] py-1 w-48 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                              <button
                                  onClick={() => setIsEditModalOpen(true)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 text-sm flex gap-2 items-center transition-colors cursor-pointer"
                              >
                                  <UserCog size={16}/> Editar Contato
                              </button>
                              <div className="h-[1px] bg-gray-100 dark:bg-[#2d2d36] my-1"/>
                              <button
                                  onClick={handleClearChatClick}
                                  className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 text-sm flex gap-2 items-center transition-colors cursor-pointer"
                              >
                                  <Trash2 size={16}/> Limpar Conversa
                              </button>
                          </div>
                      )}
                  </div>
                )}
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