'use client';

import { useEffect, useState, useCallback } from 'react';
import { useExamResults, type ExamResult } from '@/hooks/atendimento/useExamResults';
import { useToast } from '@/contexts/ToastContext';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  Plus, Eye, Pencil, Trash2, ArrowLeft,
  FlaskConical, Loader2
} from 'lucide-react';

interface ExamResultsTabProps {
  patientId: number;
}

type ViewMode = 'list' | 'create' | 'edit' | 'view';

export function ExamResultsTab({ patientId }: ExamResultsTabProps) {
  const { toast } = useToast();
  const {
    results, doctors, loading,
    fetchResults, fetchDoctors,
    create, update, remove,
  } = useExamResults(patientId);

  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Campos do formulário
  const [examName, setExamName] = useState('');
  const [resultDate, setResultDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [content, setContent] = useState('');

  useEffect(() => {
    fetchResults();
    fetchDoctors();
  }, [fetchResults, fetchDoctors]);

  const selected = results.find(r => r.id === selectedId) || null;

  const resetForm = useCallback(() => {
    setExamName('');
    setResultDate(new Date().toLocaleDateString('en-CA'));
    setContent('');
  }, []);

  const handleCreate = () => {
    resetForm();
    setSelectedId(null);
    setMode('create');
  };

  const handleEdit = (r: ExamResult) => {
    setSelectedId(r.id);
    setExamName(r.exam_name);
    setResultDate(r.result_date || new Date().toLocaleDateString('en-CA'));
    setContent(r.content || '');
    setMode('edit');
  };

  const handleView = (r: ExamResult) => {
    setSelectedId(r.id);
    setMode('view');
  };

  const handleBack = () => {
    setMode('list');
    setSelectedId(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!examName.trim()) {
      toast.error('O nome do exame é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        exam_name: examName,
        result_date: resultDate || null,
        content: content || null,
      };
      if (mode === 'create') {
        await create(payload);
        toast.success('Resultado registrado com sucesso!');
      } else if (mode === 'edit' && selectedId) {
        await update(selectedId, payload);
        toast.success('Resultado atualizado!');
      }
      await fetchResults();
      handleBack();
    } catch (err: unknown) {
      toast.error('Erro: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await remove(id);
      toast.success('Resultado excluído.');
      await fetchResults();
    } catch (err: unknown) {
      toast.error('Erro ao excluir: ' + (err instanceof Error ? err.message : ''));
    }
    setConfirmDeleteId(null);
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Modo Visualização ──────────────────────────────────────
  if (mode === 'view' && selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">{selected.exam_name}</h2>
          <div className="ml-auto flex gap-2">
            <button onClick={() => handleEdit(selected)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-[#2e2e33] p-6 space-y-3">
          <div className="flex gap-6 text-sm text-slate-500 dark:text-[#a1a1aa]">
            {selected.result_date && (
              <span>Data: <strong className="text-slate-700 dark:text-gray-200">{new Date(selected.result_date + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
            )}
            {selected.doctor_id && doctors[selected.doctor_id] && (
              <span>Profissional: <strong className="text-slate-700 dark:text-gray-200">{doctors[selected.doctor_id]}</strong></span>
            )}
          </div>
          <hr className="border-slate-100 dark:border-[#2e2e33]" />
          {selected.content ? (
            <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">{selected.content}</div>
          ) : (
            <p className="text-sm text-slate-400">Sem conteúdo</p>
          )}
          {selected.file_url && (
            <a href={selected.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Ver arquivo anexo
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Modo Criação / Edição ──────────────────────────────────
  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">
            {mode === 'create' ? 'Novo Resultado' : 'Editar Resultado'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-[#a1a1aa] mb-1 block">Nome do exame *</label>
            <input
              type="text"
              value={examName}
              onChange={e => setExamName(e.target.value)}
              placeholder="Ex: Hemograma completo"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-[#a1a1aa] mb-1 block">Data do resultado</label>
            <input
              type="date"
              value={resultDate}
              onChange={e => setResultDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-[#a1a1aa] mb-1 block">Conteúdo / Observações</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Digite os resultados do exame..."
            rows={10}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            SALVAR
          </button>
          <button
            onClick={handleBack}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-[#a1a1aa] bg-slate-100 dark:bg-[#18181b] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            CANCELAR
          </button>
        </div>
      </div>
    );
  }

  // ── Modo Listagem ──────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800 dark:text-[#fafafa]">Resultados de Exames</h3>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> ADICIONAR RESULTADO
        </button>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-16">
          <FlaskConical className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-[#71717a]">Nenhum resultado registrado.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-[#2e2e33] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#18181b] border-b border-slate-200 dark:border-[#2e2e33]">
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Data</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Nome do exame</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Profissional</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Opções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {results.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-slate-600 dark:text-[#d4d4d8]">
                    {r.result_date ? new Date(r.result_date + 'T12:00:00').toLocaleDateString('pt-BR') : new Date(r.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-gray-200">{r.exam_name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-[#d4d4d8]">
                    {r.doctor_id ? (doctors[r.doctor_id] || '—') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleView(r)} title="Visualizar" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(r)} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(r.id)} title="Excluir" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); }}
        title="Excluir resultado"
        message="Tem certeza que deseja excluir este resultado? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
