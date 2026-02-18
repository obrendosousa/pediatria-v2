'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, Phone, Calendar, Search, Plus, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';

interface PatientListTableProps {
  patients: any[];
  isLoading: boolean;
  onSelectPatient: (id: number) => void;
  onNewPatient: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onPatientDeleted?: () => void; // Callback após deletar paciente
}

export function PatientListTable({ 
  patients = [], // Valor padrão para evitar erro se for undefined
  isLoading, 
  onSelectPatient,
  onNewPatient,
  searchTerm,
  onSearchChange,
  onPatientDeleted
}: PatientListTableProps) {
  const { toast } = useToast();
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; patient: any | null }>({
    isOpen: false,
    patient: null
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  
  // Filtro de segurança para evitar erro caso patients seja null
  const safePatients = Array.isArray(patients) ? patients : [];

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpenId !== null) {
        const menuRef = menuRefs.current[menuOpenId];
        const target = event.target as Node;
        // Verificar se o clique foi dentro do botão ou do menu dropdown
        const clickedInsideButton = menuRef && menuRef.contains(target);
        const clickedInsideDropdown = dropdownMenuRef.current && dropdownMenuRef.current.contains(target);
        
        // Só fechar se o clique foi fora de ambos
        if (!clickedInsideButton && !clickedInsideDropdown) {
          setMenuOpenId(null);
          setMenuPosition(null);
        }
      }
    };

    if (menuOpenId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      // Calcular posição do menu
      const menuRef = menuRefs.current[menuOpenId];
      if (menuRef) {
        const rect = menuRef.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 4,
          left: rect.right - 192 // 192px = width do menu (w-48)
        });
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpenId]);

  // Filtro local (pelo nome ou telefone)
  const filtered = safePatients.filter(p => 
    (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (p.phone && p.phone.includes(searchTerm))
  );

  const handleDeleteClick = (e: React.MouseEvent, patient: any) => {
    e.stopPropagation(); // Previne o clique na linha
    setDeleteModal({ isOpen: true, patient });
    setMenuOpenId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.patient) {
      console.error('Nenhum paciente selecionado para deletar');
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const patientId = deleteModal.patient.id;
      
      // Deletar registros relacionados antes de deletar o paciente
      // (Algumas tabelas podem não ter ON DELETE CASCADE configurado)
      
      // 1. Deletar prontuários médicos (medical_records)
      const { error: medicalRecordsError } = await supabase
        .from('medical_records')
        .delete()
        .eq('patient_id', patientId);
      
      if (medicalRecordsError) {
        console.warn('Aviso ao deletar prontuários médicos:', medicalRecordsError);
        // Continuar mesmo com erro, pode não ter prontuários ou já ter sido deletado
      }
      
      // 2. Deletar entradas de antropometria (já tem CASCADE, mas deletamos explicitamente para garantir)
      const { error: anthropometryError } = await supabase
        .from('anthropometry_entries')
        .delete()
        .eq('patient_id', patientId);
      
      if (anthropometryError) {
        console.warn('Erro ao deletar entradas de antropometria:', anthropometryError);
      }
      
      // 3. Deletar telefones do paciente (já tem CASCADE, mas deletamos explicitamente para garantir)
      const { error: phonesError } = await supabase
        .from('patient_phones')
        .delete()
        .eq('patient_id', patientId);
      
      if (phonesError) {
        console.warn('Erro ao deletar telefones:', phonesError);
      }
      
      // 4. Limpar referências em outras tabelas (SET NULL)
      // appointments, chats, medical_checkouts já têm ON DELETE SET NULL
      // Mas vamos limpar explicitamente para garantir
      const { error: appointmentsError } = await supabase
        .from('appointments')
        .update({ patient_id: null })
        .eq('patient_id', patientId);
      
      if (appointmentsError) {
        console.warn('Erro ao limpar referências em appointments:', appointmentsError);
      }
      
      const { error: chatsError } = await supabase
        .from('chats')
        .update({ patient_id: null })
        .eq('patient_id', patientId);
      
      if (chatsError) {
        console.warn('Erro ao limpar referências em chats:', chatsError);
      }
      
      const { error: checkoutsError } = await supabase
        .from('medical_checkouts')
        .update({ patient_id: null })
        .eq('patient_id', patientId);
      
      if (checkoutsError) {
        console.warn('Erro ao limpar referências em medical_checkouts:', checkoutsError);
      }
      
      // 5. Deletar o paciente
      const { error, data } = await supabase
        .from('patients')
        .delete()
        .eq('id', patientId)
        .select();

      if (error) {
        // Extrair mensagem de erro de diferentes formas
        let errorMessage = 'Erro desconhecido ao deletar paciente.';
        
        // Verificar diferentes propriedades do erro
        if (error.message) {
          errorMessage = error.message;
        } else if (error.details) {
          errorMessage = error.details;
        } else if (error.hint) {
          errorMessage = error.hint;
        } else if (error.code) {
          // Erro com código (ex: violação de chave estrangeira)
          if (error.code === '23503') {
            errorMessage = 'Não é possível deletar este paciente. Ele está vinculado a outros registros (consultas, prontuários, checkouts, etc.).';
          } else {
            errorMessage = `Erro ao deletar (código: ${error.code}). O paciente pode estar vinculado a outros registros.`;
          }
        } else {
          // Se o erro for um objeto vazio ou sem propriedades úteis
          errorMessage = 'Não foi possível deletar o paciente. Ele pode estar vinculado a outros registros (consultas, prontuários, checkouts, etc.).';
        }
        
        // Log sempre com informações úteis (nunca objeto vazio)
        const logInfo: any = {
          errorMessage,
          patientId: deleteModal.patient.id,
          patientName: deleteModal.patient.name || 'Nome não disponível'
        };
        
        // Adicionar propriedades do erro apenas se existirem
        if (error.message) logInfo.message = error.message;
        if (error.details) logInfo.details = error.details;
        if (error.hint) logInfo.hint = error.hint;
        if (error.code) logInfo.code = error.code;
        
        // Se não houver nenhuma propriedade útil do erro, adicionar flag
        if (!error.message && !error.details && !error.hint && !error.code) {
          logInfo.errorType = 'Objeto de erro vazio do Supabase';
          logInfo.reason = 'Provável restrição de chave estrangeira ou permissão';
        }
        
        console.error('Erro ao deletar paciente:', logInfo);
        
        toast.toast.error(`Erro ao deletar paciente: ${errorMessage}`);
        setIsDeleting(false);
        return;
      }

      // Verificar se realmente deletou
      if (!data || data.length === 0) {
        console.warn('Nenhum registro foi deletado. Pode haver restrições de chave estrangeira.');
        toast.toast.error('Não foi possível deletar o paciente. Ele pode estar vinculado a outros registros (consultas, prontuários, checkouts, etc.).');
        setIsDeleting(false);
        return;
      }

      // Sucesso - fechar modal e recarregar lista
      setDeleteModal({ isOpen: false, patient: null });
      setIsDeleting(false);
      
      if (onPatientDeleted) {
        onPatientDeleted();
      }
    } catch (error: any) {
      console.error('Erro ao deletar paciente (catch):', error);
      
      let errorMessage = 'Erro desconhecido ao deletar paciente.';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.code === '23503') {
        errorMessage = 'Não é possível deletar este paciente. Ele está vinculado a outros registros (consultas, prontuários, checkouts, etc.).';
      } else {
        errorMessage = 'Não foi possível deletar o paciente. Ele pode estar vinculado a outros registros.';
      }
      
      toast.toast.error(`Erro ao deletar paciente: ${errorMessage}`);
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      
      {/* --- CABEÇALHO DA PÁGINA --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pacientes</h1>
           <p className="text-slate-500 dark:text-gray-400">Gerencie seus pacientes e atendimentos</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
           {/* Barra de Busca */}
           <div className="relative flex-1 md:w-80">
             <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
             <input 
               type="text"
               placeholder="Buscar por nome ou telefone..."
               className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all outline-none"
               value={searchTerm}
               onChange={(e) => onSearchChange(e.target.value)}
             />
           </div>
           
           {/* Botão Novo Paciente */}
           <button 
             onClick={onNewPatient}
             className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-rose-500/20 active:scale-95"
           >
             <Plus className="w-5 h-5" />
             <span className="hidden sm:inline">Novo Paciente</span>
           </button>
        </div>
      </div>

       {/* --- TABELA DE DADOS --- */}
       <div className="bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm">
         <div className="overflow-x-auto overflow-y-visible relative">
           <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-[#252830] border-b border-slate-100 dark:border-gray-800">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-gray-300">Paciente</th>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-gray-300">Telefone</th>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-gray-300">Última Consulta</th>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-gray-300 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              
              {/* Estado de Carregamento */}
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                      <span>Carregando lista de pacientes...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                /* Estado Vazio */
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500 dark:text-gray-400 italic">
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              ) : (
                /* Lista de Pacientes */
                filtered.map((patient) => (
                  <tr 
                    key={patient.id} 
                    onClick={() => onSelectPatient(patient.id)}
                    className="group hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#2a2d36] text-slate-500 dark:text-gray-400 group-hover:bg-rose-100 group-hover:text-rose-600 dark:group-hover:bg-rose-900/40 dark:group-hover:text-rose-400 flex items-center justify-center font-bold text-sm transition-colors">
                          {patient.name ? patient.name.substring(0, 2).toUpperCase() : '--'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-gray-200 group-hover:text-rose-700 dark:group-hover:text-rose-400 transition-colors">
                            {patient.name}
                          </p>
                          <p className="text-xs text-slate-400">Prontuário: {patient.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-gray-400">
                        <Phone className="w-4 h-4 opacity-70" />
                        {patient.phone || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4 opacity-70" />
                        <span>—</span> 
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div 
                        className="relative inline-block" 
                        ref={(el) => {
                          menuRefs.current[patient.id] = el;
                        }}
                      >
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === patient.id ? null : patient.id);
                          }}
                          className="p-2 hover:bg-slate-200 dark:hover:bg-gray-700 rounded-full transition-colors text-slate-400 relative z-10"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Menu Dropdown Fixo (Portal) */}
      {menuOpenId !== null && menuPosition && (
        <div 
          ref={dropdownMenuRef}
          className="fixed bg-white dark:bg-[#2a2d36] shadow-xl rounded-lg border border-slate-200 dark:border-gray-700 py-1 w-48 z-[200] animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`
          }}
        >
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const patient = safePatients.find(p => p.id === menuOpenId);
              if (patient) {
                handleDeleteClick(e, patient);
              }
            }}
            className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 text-sm flex gap-2 items-center transition-colors"
          >
            <Trash2 size={16} />
            Apagar Paciente
          </button>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteModal({ isOpen: false, patient: null });
          }
        }}
        onConfirm={handleDeleteConfirm}
        title="Confirmar Exclusão"
        message={
          deleteModal.patient
            ? `Tem certeza que deseja apagar o paciente "${deleteModal.patient.name}"?\n\nEsta ação não pode ser desfeita e todos os dados relacionados serão removidos permanentemente.`
            : ''
        }
        confirmText="Sim, Apagar"
        cancelText="Cancelar"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}