'use client';

import { useState } from 'react';
import { X, MessageSquarePlus, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Chat } from '@/types';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartChat: (chat: Partial<Chat>) => void;
}

export default function NewChatModal({ isOpen, onClose, onStartChat }: NewChatModalProps) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const formatPhone = (input: string) => {
    // Remove tudo que não é número
    return input.replace(/\D/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanPhone = formatPhone(phone);

    if (cleanPhone.length < 10) {
      setError('Número inválido. Verifique o DDD e o número.');
      setLoading(false);
      return;
    }

    try {
      // 1. Verifica se já existe um chat com este número
      const { data: existingChat, error: fetchError } = await supabase
        .from('chats')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingChat) {
        // Se já existe, usa o chat real
        onStartChat(existingChat);
      } else {
        // 2. Se não existe, cria um objeto TEMPORÁRIO
        // O ID começa com 'new_' para o ChatWindow saber que precisa criar no banco
        // ao enviar a primeira mensagem.
        const tempChat: Partial<Chat> = {
          id: `new_${Date.now()}` as any, // Cast para any pois id geralmente é number
          phone: cleanPhone,
          contact_name: cleanPhone, // Nome provisório igual ao fone
          status: 'ACTIVE',
          unread_count: 0,
          last_interaction_at: new Date().toISOString(),
          tags: []
        };
        
        onStartChat(tempChat);
      }

      // Limpa e fecha
      setPhone('');
      onClose();

    } catch (err) {
      console.error('Erro ao verificar contato:', err);
      setError('Erro ao verificar contato. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36]">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <MessageSquarePlus className="text-green-600 dark:text-green-500" size={20}/>
            Nova Conversa
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Número do WhatsApp
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Ex: 5511999998888"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="w-full px-4 py-3 bg-white dark:bg-[#111b21] border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 font-mono"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Digite o número completo com DDI e DDD (apenas números).
            </p>
            {error && (
              <p className="text-xs text-red-500 mt-2 font-medium animate-pulse">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || phone.length < 10}
            className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : 'Iniciar Conversa'}
          </button>
        </form>
      </div>
    </div>
  );
}