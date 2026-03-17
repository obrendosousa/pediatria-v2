'use client';

import { useEffect, useState } from 'react';
import { Plus, BookMarked, Loader2, Trash2, Search } from 'lucide-react';
import { ProntuarioScreenProps } from '@/types/prontuario';
import { usePatientCids } from '@/hooks/atendimento/usePatientCids';
import { useToast } from '@/contexts/ToastContext';

export function PatientCidsList({ patientId }: ProntuarioScreenProps) {
  const { toast } = useToast();
  const { cids, searchResults, isLoading, isSaving, fetchPatientCids, searchCid10, addCid, updateCidStatus, removeCid } = usePatientCids();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchPatientCids(patientId); }, [patientId, fetchPatientCids]);

  useEffect(() => {
    const t = setTimeout(() => { if (searchQuery.trim().length >= 2) searchCid10(searchQuery); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchCid10]);

  const handleAdd = async (code: string, description: string) => {
    if (cids.some(c => c.cid_code === code)) { toast.error('CID já adicionado'); return; }
    await addCid({ patient_id: patientId, doctor_id: null, cid_code: code, cid_description: description, status: 'active', notes: null, diagnosed_at: new Date().toISOString().split('T')[0], resolved_at: null });
    setSearchQuery('');
    fetchPatientCids(patientId);
    toast.success(`CID ${code} adicionado`);
  };

  const handleRemove = async (id: number) => {
    await removeCid(id);
    fetchPatientCids(patientId);
  };

  const handleToggle = async (id: number, current: string) => {
    const next = current === 'active' ? 'resolved' : 'active';
    await updateCidStatus(id, next as 'active' | 'resolved', next === 'resolved' ? new Date().toISOString().split('T')[0] : undefined);
    fetchPatientCids(patientId);
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
        <BookMarked className="w-5 h-5 text-indigo-500" /> CID-10 do Paciente
      </h2>

      {/* Busca CID-10 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por código ou descrição CID-10..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] rounded-xl shadow-lg">
            {searchResults.map(item => {
              const alreadyAdded = cids.some(c => c.cid_code === item.code);
              return (
                <button
                  key={item.code}
                  onClick={() => !alreadyAdded && handleAdd(item.code, item.description)}
                  disabled={alreadyAdded || isSaving}
                  className={`w-full text-left px-4 py-2.5 border-b border-slate-100 dark:border-[#2d2d36] last:border-0 flex items-center gap-3 transition-colors ${alreadyAdded ? 'opacity-50 cursor-default' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 w-16">{item.code}</span>
                  <span className="text-sm text-slate-700 dark:text-gray-200 truncate">{item.description}</span>
                  {alreadyAdded && <span className="text-[10px] text-slate-400 ml-auto shrink-0">Já adicionado</span>}
                  {!alreadyAdded && <Plus className="w-4 h-4 text-blue-500 ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de CIDs do paciente */}
      {cids.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-[#71717a]">
          <BookMarked className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum CID registrado para este paciente.</p>
          <p className="text-xs mt-1">Use a busca acima para adicionar diagnósticos.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#1c1c21] border-b border-slate-200 dark:border-[#3d3d48]">
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase text-left">Código</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase text-left">Descrição</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase text-center w-24">Status</th>
                <th className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase text-left w-28">Data</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2d2d36]">
              {cids.map(cid => (
                <tr key={cid.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{cid.cid_code}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-gray-200">{cid.cid_description}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(cid.id, cid.status)} className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                      cid.status === 'active' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' :
                      cid.status === 'chronic' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' :
                      'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {cid.status === 'active' ? 'ATIVO' : cid.status === 'chronic' ? 'CRÔNICO' : 'RESOLVIDO'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{cid.diagnosed_at ? new Date(cid.diagnosed_at + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleRemove(cid.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
