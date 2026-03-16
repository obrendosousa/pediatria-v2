'use client';

import { useEffect, useState, useCallback } from 'react';
import { AttendanceScreenProps } from '@/types/attendance';
import { useAnamneses, type Anamnese, type AnamneseTemplate } from '@/hooks/atendimento/useAnamneses';
import { useToast } from '@/contexts/ToastContext';
import { RichTextEditor } from '@/components/medical-record/attendance/RichTextEditor';
import { replaceTemplateVariables } from '@/utils/templateVariables';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  Plus, Eye, Pencil, Trash2, Printer, ArrowLeft,
  FileText, Loader2, ToggleLeft, ToggleRight, BookOpen
} from 'lucide-react';

type ViewMode = 'list' | 'create' | 'edit' | 'view';

// ── Componente Principal ────────────────────────────────────
export function AnamnesesList({ patientId, patientData, appointmentId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const {
    anamneses, templates, doctors, loading,
    fetchAnamneses, fetchDoctors, fetchTemplates,
    create, update, remove,
  } = useAnamneses(patientId);

  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Campos do formulário
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [signed, setSigned] = useState(false);
  const [showDate, setShowDate] = useState(true);
  const [fillDate, setFillDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [templateId, setTemplateId] = useState<number | null>(null);

  useEffect(() => {
    fetchAnamneses();
    fetchDoctors();
    fetchTemplates();
  }, [fetchAnamneses, fetchDoctors, fetchTemplates]);

  const selected = anamneses.find(a => a.id === selectedId) || null;

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setSigned(false);
    setShowDate(true);
    setFillDate(new Date().toLocaleDateString('en-CA'));
    setTemplateId(null);
  }, []);

  const handleCreate = () => {
    resetForm();
    setSelectedId(null);
    setMode('create');
  };

  const handleEdit = (a: Anamnese) => {
    setSelectedId(a.id);
    setTitle(a.title || '');
    setContent(a.content || '');
    setSigned(a.signed);
    setShowDate(a.show_date ?? true);
    setFillDate(a.fill_date || new Date().toLocaleDateString('en-CA'));
    setTemplateId(a.template_id);
    setMode('edit');
  };

  const handleView = (a: Anamnese) => {
    setSelectedId(a.id);
    setMode('view');
  };

  const handleBack = () => {
    setMode('list');
    setSelectedId(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('O conteúdo da anamnese é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title || null,
        content,
        signed,
        show_date: showDate,
        fill_date: showDate ? fillDate : null,
        template_id: templateId,
        appointment_id: appointmentId || null,
      };
      if (mode === 'create') {
        await create(payload);
        toast.success('Anamnese criada com sucesso!');
      } else if (mode === 'edit' && selectedId) {
        await update(selectedId, payload);
        toast.success('Anamnese atualizada!');
      }
      await fetchAnamneses();
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
      toast.success('Anamnese excluída.');
      await fetchAnamneses();
    } catch (err: unknown) {
      toast.error('Erro ao excluir: ' + (err instanceof Error ? err.message : ''));
    }
    setConfirmDeleteId(null);
  };

  const handlePrint = (a: Anamnese) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const doctorName = a.doctor_id ? (doctors[a.doctor_id] || '—') : '';
    win.document.write(`
      <html>
      <head>
        <title>${a.title || 'Anamnese'}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#333}h1{font-size:20px;margin-bottom:8px}
        .meta{color:#666;font-size:13px;margin-bottom:16px}hr{border:none;border-top:1px solid #ddd;margin:16px 0}</style>
      </head>
      <body>
        <h1>${a.title || 'Anamnese'}</h1>
        <div class="meta">
          ${a.show_date !== false && a.fill_date ? `<div>Data: ${new Date(a.fill_date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>` : ''}
          ${doctorName ? `<div>Profissional: ${doctorName}</div>` : ''}
        </div>
        <hr/>
        <div>${a.content || ''}</div>
        ${a.signed ? '<p style="margin-top:40px;font-weight:bold">✓ Assinado digitalmente</p>' : ''}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleSelectTemplate = (tmpl: AnamneseTemplate) => {
    setContent(replaceTemplateVariables(tmpl.content || '', patientData));
    setTemplateId(tmpl.id);
  };

  // ── Renderização ──────────────────────────────────────────

  if (loading && anamneses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Modo Visualização ─────────────────────────────────────
  if (mode === 'view' && selected) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">{selected.title || 'Anamnese'}</h2>
          <div className="ml-auto flex gap-2">
            <button onClick={() => handleEdit(selected)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button onClick={() => handlePrint(selected)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#d4d4d8] rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-[#2e2e33] p-6 space-y-3">
          <div className="flex gap-6 text-sm text-slate-500 dark:text-[#a1a1aa]">
            {selected.show_date && selected.fill_date && (
              <span>Data: <strong className="text-slate-700 dark:text-gray-200">{new Date(selected.fill_date + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
            )}
            {selected.doctor_id && doctors[selected.doctor_id] && (
              <span>Profissional: <strong className="text-slate-700 dark:text-gray-200">{doctors[selected.doctor_id]}</strong></span>
            )}
            {selected.signed && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ Assinado</span>
            )}
          </div>
          <hr className="border-slate-100 dark:border-[#2e2e33]" />
          <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: selected.content || '<p class="text-slate-400">Sem conteúdo</p>' }} />
        </div>
      </div>
    );
  }

  // ── Modo Criação / Edição ─────────────────────────────────
  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">
            {mode === 'create' ? 'Nova Anamnese' : 'Editar Anamnese'}
          </h2>
        </div>

        {/* Campos superiores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-[#a1a1aa] mb-1 block">Título / Nome da anamnese</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Anamnese inicial"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex items-end gap-6">
            {/* Toggle assinar digitalmente */}
            <button
              type="button"
              onClick={() => setSigned(!signed)}
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-[#a1a1aa] hover:text-slate-800 dark:hover:text-gray-200 transition-colors"
            >
              {signed
                ? <ToggleRight className="w-6 h-6 text-blue-500" />
                : <ToggleLeft className="w-6 h-6 text-slate-400" />
              }
              <span className="text-xs font-bold">Assinar digitalmente</span>
            </button>

            {/* Toggle mostrar data */}
            <button
              type="button"
              onClick={() => setShowDate(!showDate)}
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-[#a1a1aa] hover:text-slate-800 dark:hover:text-gray-200 transition-colors"
            >
              {showDate
                ? <ToggleRight className="w-6 h-6 text-blue-500" />
                : <ToggleLeft className="w-6 h-6 text-slate-400" />
              }
              <span className="text-xs font-bold">Mostrar data</span>
            </button>

            {/* Campo de data */}
            {showDate && (
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-[#a1a1aa] mb-1 block">Data</label>
                <input
                  type="date"
                  value={fillDate}
                  onChange={e => setFillDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}
          </div>
        </div>

        {/* Editor + Painel de templates */}
        <div className="flex gap-4">
          {/* Editor Rich Text */}
          <div className="flex-1 min-w-0">
            <label className="text-xs font-bold text-slate-600 dark:text-[#a1a1aa] mb-1 block">Conteúdo</label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Digite o conteúdo da anamnese..."
              className="min-h-[400px]"
            />
          </div>

          {/* Painel lateral de modelos */}
          <TemplatePanel templates={templates} onSelect={handleSelectTemplate} />
        </div>

        {/* Botões de ação */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
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

  // ── Modo Listagem ─────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Anamneses</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> ADICIONAR ANAMNESE
        </button>
      </div>

      {anamneses.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-[#71717a]">Nenhuma anamnese registrada.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-[#2e2e33] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#18181b] border-b border-slate-200 dark:border-[#2e2e33]">
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Data criação</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Data preenchimento</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Nome</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Profissional</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Opções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {anamneses.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-slate-600 dark:text-[#d4d4d8]">
                    {new Date(a.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-[#d4d4d8]">
                    {a.fill_date ? new Date(a.fill_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-gray-200">
                    {a.title || 'Sem título'}
                    {a.signed && (
                      <span className="ml-2 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">ASSINADO</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-[#d4d4d8]">
                    {a.doctor_id ? (doctors[a.doctor_id] || '—') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleView(a)} title="Visualizar" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(a)} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(a.id)} title="Excluir" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handlePrint(a)} title="Imprimir" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                        <Printer className="w-4 h-4" />
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
        title="Excluir anamnese"
        message="Tem certeza que deseja excluir esta anamnese? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}

// ── Painel Lateral de Modelos ───────────────────────────────
function TemplatePanel({ templates, onSelect }: {
  templates: AnamneseTemplate[];
  onSelect: (t: AnamneseTemplate) => void;
}) {
  if (templates.length === 0) {
    return (
      <div className="w-64 shrink-0 bg-slate-50 dark:bg-[#16171c] rounded-xl border border-slate-200 dark:border-[#2e2e33] p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Modelos de anamnese</h3>
        </div>
        <p className="text-xs text-slate-400 dark:text-[#71717a] text-center py-6">
          Nenhum modelo cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 bg-slate-50 dark:bg-[#16171c] rounded-xl border border-slate-200 dark:border-[#2e2e33] p-4 overflow-y-auto max-h-[500px]">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-slate-400" />
        <h3 className="text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Modelos de anamnese</h3>
      </div>
      <div className="space-y-2">
        {templates.map(tmpl => (
          <button
            key={tmpl.id}
            onClick={() => onSelect(tmpl)}
            className="w-full text-left p-3 rounded-lg bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-[#2e2e33] hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group"
          >
            <p className="text-xs font-bold text-slate-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
              {tmpl.title}
            </p>
            {tmpl.content && (
              <p className="text-[10px] text-slate-400 dark:text-[#71717a] mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: tmpl.content.replace(/<[^>]*>/g, ' ').slice(0, 80) }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
