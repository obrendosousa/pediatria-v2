'use client';

import React, { useState, useEffect } from 'react';
import { Phone, Plus, Trash2, Star, StarOff, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { PatientPhone, getPatientPhones, addPhoneToPatient, removePhoneFromPatient, setPrimaryPhone } from '@/utils/patientRelations';
import { useToast } from '@/contexts/ToastContext';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { formatPhone, cleanPhone } from '@/utils/formatUtils';

interface PatientPhonesManagerProps {
  patientId: number;
  onPhoneAdded?: () => void;
  onPhoneRemoved?: () => void;
}

export function PatientPhonesManager({ patientId, onPhoneAdded, onPhoneRemoved }: PatientPhonesManagerProps) {
  const { toast } = useToast();
  const [phones, setPhones] = useState<PatientPhone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ phoneId: number; phone: string } | null>(null);

  useEffect(() => {
    fetchPhones();
  }, [patientId]);

  const fetchPhones = async () => {
    setLoading(true);
    try {
      const data = await getPatientPhones(patientId);
      setPhones(data);
    } catch (error) {
      console.error('Erro ao buscar números:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhone = async () => {
    if (!newPhone.trim()) return;
    
    setIsAdding(true);
    try {
      const phoneId = await addPhoneToPatient(patientId, newPhone, 'manual', false);
      if (phoneId) {
        setNewPhone('');
        setShowAddForm(false);
        await fetchPhones();
        if (onPhoneAdded) onPhoneAdded();
      }
    } catch (error) {
      console.error('Erro ao adicionar número:', error);
      toast.toast.error('Erro ao adicionar número. Verifique se o telefone é válido.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemovePhoneClick = (phoneId: number, phone: string) => {
    setConfirmRemove({ phoneId, phone });
  };

  const handleRemovePhoneConfirm = async () => {
    if (!confirmRemove) return;
    const { phone } = confirmRemove;
    setConfirmRemove(null);
    try {
      const success = await removePhoneFromPatient(patientId, phone);
      if (success) {
        await fetchPhones();
        if (onPhoneRemoved) onPhoneRemoved();
      }
    } catch (error) {
      console.error('Erro ao remover número:', error);
      toast.toast.error('Erro ao remover número.');
    }
  };

  const handleSetPrimary = async (phoneId: number) => {
    try {
      const success = await setPrimaryPhone(patientId, phoneId);
      if (success) {
        await fetchPhones();
      }
    } catch (error) {
      console.error('Erro ao definir número principal:', error);
      toast.toast.error('Erro ao definir número principal.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <>
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 flex items-center gap-2">
          <Phone className="w-4 h-4 text-rose-500" />
          Números de Contato ({phones.length})
        </h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-colors font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newPhone}
              onChange={(e) => {
                const formatted = formatPhone(e.target.value);
                setNewPhone(formatted);
              }}
              placeholder="(00) 00000-0000"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              maxLength={15}
            />
            <button
              onClick={handleAddPhone}
              disabled={isAdding || !newPhone.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isAdding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Adicionar
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewPhone('');
              }}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      )}

      {phones.length === 0 ? (
        <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
          <Phone className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-gray-400">Nenhum número cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {phones.map((phone) => (
            <div
              key={phone.id}
              className={`p-3 rounded-lg border transition-all ${
                phone.is_primary
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-[#1e2028] border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {phone.is_primary ? (
                    <Star className="w-4 h-4 text-blue-600 dark:text-blue-400 fill-current" />
                  ) : (
                    <StarOff className="w-4 h-4 text-slate-400" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-gray-100">
                        {phone.phone_formatted || phone.phone}
                      </span>
                      {phone.is_primary && (
                        <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-semibold">
                          Principal
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 dark:text-gray-400">
                        {phone.source === 'chat' && '💬 Chat'}
                        {phone.source === 'appointment' && '📅 Agendamento'}
                        {phone.source === 'patient_registration' && '📝 Cadastro'}
                        {phone.source === 'manual' && '✏️ Manual'}
                        {phone.source === 'migration' && '🔄 Migração'}
                        {!phone.source && '📱 Telefone'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!phone.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(phone.id)}
                      className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="Definir como principal"
                    >
                      <Star className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemovePhoneClick(phone.id, phone.phone)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Remover número"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    <ConfirmModal
      isOpen={!!confirmRemove}
      onClose={() => setConfirmRemove(null)}
      onConfirm={handleRemovePhoneConfirm}
      title="Remover número"
      message={confirmRemove ? `Deseja remover o número ${formatPhone(confirmRemove.phone)}?` : ''}
      type="danger"
      confirmText="Sim, remover"
    />
    </>
  );
}
