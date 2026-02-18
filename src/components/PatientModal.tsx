'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { X, Baby, Calendar, FileText, Save, Phone } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId?: number | null; // Pode ser opcional/nulo dependendo de onde abre
  onSuccess: () => void;
}

export default function PatientModal({ isOpen, onClose, chatId, onSuccess }: PatientModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '', // Adicionado: Essencial para o vínculo
    birth_date: '',
    notes: ''
  });

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validação Básica
    if (!formData.name || !formData.birth_date || !formData.phone) {
      toast.toast.error('Nome, Telefone e Data de Nascimento são obrigatórios.');
      return;
    }

    setLoading(true);

    try {
      // Remove formatação do telefone (deixa apenas números)
      const cleanPhone = formData.phone.replace(/\D/g, '');

      const payload = {
        chat_id: chatId || null, // Se não tiver ID, envia null (o trigger vai corrigir usando o telefone)
        name: formData.name,
        phone: cleanPhone,
        birth_date: formData.birth_date,
        notes: formData.notes
      };

      const { error } = await supabase.from('patients').insert(payload);

      if (error) throw error;
      
      // Limpa form e fecha
      setFormData({ name: '', phone: '', birth_date: '', notes: '' });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao cadastrar paciente:', error);
      // Tratamento para duplicidade (caso o telefone já exista e a constraint unique esteja ativa)
      if (error.code === '23505') {
        toast.toast.error('Já existe um paciente cadastrado com este telefone.');
      } else {
        toast.toast.error('Erro ao salvar paciente. Verifique os dados.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                <Baby className="w-5 h-5 text-blue-500" />
                Novo Paciente (Filho/a)
            </h2>
            <button onClick={onClose} className="p-2 text-blue-300 hover:text-blue-500 rounded-full hover:bg-blue-100 transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            {/* Nome */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Criança</label>
                <input 
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Enzo Gabriel"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800"
                    autoFocus
                />
            </div>

            {/* Telefone (VÍNCULO) */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp do Responsável</label>
                <div className="relative">
                    <Phone className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                        type="tel" 
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        placeholder="DDD + Número (Ex: 99 98888-7777)"
                        className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800"
                    />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 ml-1">Usado para vincular ao chat automaticamente.</p>
            </div>

            {/* Data Nascimento */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Nascimento</label>
                <div className="relative">
                    <Calendar className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                        type="date" 
                        value={formData.birth_date}
                        onChange={e => setFormData({...formData, birth_date: e.target.value})}
                        className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800"
                    />
                </div>
                {formData.birth_date && (
                    <p className="text-xs text-blue-600 font-bold mt-1 text-right">
                       O sistema calculará a idade automaticamente.
                    </p>
                )}
            </div>

            {/* Notas */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações Clínicas (Opcional)</label>
                <div className="relative">
                    <FileText className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                    <textarea 
                        value={formData.notes}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                        placeholder="Ex: Alérgico a dipirona, prematuro..."
                        className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800 resize-none h-24"
                    />
                </div>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {loading ? 'Salvando...' : <><Save className="w-5 h-5" /> Cadastrar Paciente</>}
            </button>

        </form>
      </div>
    </div>
  );
}