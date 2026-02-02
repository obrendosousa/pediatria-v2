'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Chat } from '@/types';
import { X, MessageCircle, Loader2, User, AlertCircle } from 'lucide-react';
import ChatWindow from '@/components/ChatWindow';

interface QuickChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientPhone: string;
}

export default function QuickChatModal({ isOpen, onClose, patientPhone }: QuickChatModalProps) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && patientPhone) {
      fetchOrCreateChat();
    }
  }, [isOpen, patientPhone]);

  const fetchOrCreateChat = async () => {
    setLoading(true);
    setError('');
    
    try {
      const cleanPhone = patientPhone.replace(/\D/g, '');
      
      // Busca chat existente
      const { data: existingChat, error: fetchError } = await supabase
        .from('chats')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingChat) {
        setChat(existingChat as Chat);
      } else {
        // Cria novo chat
        const { data: newChat, error: createError } = await supabase
          .from('chats')
          .insert({
            phone: cleanPhone,
            contact_name: cleanPhone,
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            last_interaction_at: new Date().toISOString(),
            unread_count: 0
          })
          .select()
          .single();

        if (createError) throw createError;
        setChat(newChat as Chat);
      }
    } catch (err: any) {
      console.error('Erro ao buscar/criar chat:', err);
      setError('Erro ao abrir chat. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#1e2028] rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            <h3 className="font-bold text-gray-800 dark:text-gray-100">
              Chat com {chat?.contact_name || patientPhone}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-400 dark:text-gray-500"/>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-pink-600 dark:text-pink-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Carregando chat...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          ) : chat ? (
            <ChatWindow chat={chat} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum chat encontrado</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
