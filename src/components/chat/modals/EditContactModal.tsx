import { useState, useEffect } from 'react';
import { X, UserCog, Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase'; //
import { Chat } from '@/types'; //

interface EditContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat;
  onUpdate: (updatedChat: Chat) => void;
}

export default function EditContactModal({ isOpen, onClose, chat, onUpdate }: EditContactModalProps) {
  const [name, setName] = useState(chat.contact_name || '');
  const [phone, setPhone] = useState(chat.phone || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(chat.contact_name || '');
    setPhone(chat.phone || '');
  }, [chat]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Atualiza no Supabase
      const { error } = await supabase
        .from('chats')
        .update({ contact_name: name, phone: phone })
        .eq('id', chat.id);

      if (error) throw error;

      // Atualiza o estado local
      onUpdate({ ...chat, contact_name: name, phone: phone });
      onClose();
    } catch (err) {
      console.error('Erro ao atualizar:', err);
      alert('Erro ao atualizar contato.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-md font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <UserCog className="text-blue-500" size={18}/>
            Editar Contato
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Nome do Contato</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2a2d36] border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Telefone</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2a2d36] border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16}/> Salvar Alterações</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}