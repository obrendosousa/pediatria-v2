'use client';

import { useEffect, useState, useCallback } from 'react';
import { AttendanceScreenProps } from '@/types/attendance';
import { useEvolutions, type ClinicalEvolution, type EvolutionTemplate } from '@/hooks/atendimento/useEvolutions';
import { useEvolutionTemplates } from '@/hooks/useEvolutionTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { RichTextEditor } from '@/components/medical-record/attendance/RichTextEditor';
import { replaceTemplateVariables } from '@/utils/templateVariables';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  Plus, Eye, Pencil, Trash2, Printer, ArrowLeft,
  TrendingUp, Loader2, Settings, BookOpen, Lock,
} from 'lucide-react';

type ViewMode = 'list' | 'create' | 'edit' | 'view';

// ── Toggle Switch ──────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
    >
      <div className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-slate-600 dark:text-[#d4d4d8]">{label}</span>
    </button>
  );
}

// ── Checkbox ───────────────────────────────────────────────────
function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-slate-600 dark:text-[#d4d4d8]">{label}</span>
    </label>
  );
}

// ── Componente Principal ────────────────────────────────────────
export function EvolutionsList({ patientId, patientData, appointmentId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const {
    evolutions, templates, doctors, loading,
    fetchEvolutions, fetchDoctors, fetchTemplates,
    create, update, remove,
  } = useEvolutions(patientId);
  const { createTemplate: saveTemplateApi } = useEvolutionTemplates();

  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Campos do formulário
  const [content, setContent] = useState('');
  const [showDate, setShowDate] = useState(true);
  const [evolutionDate, setEvolutionDate] = useState(() => new Date().toLocaleDateString('en-CA'));

  // Restrições
  const [blocked, setBlocked] = useState(false);

  // Opções
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [saveAndPrint, setSaveAndPrint] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Painel de modelos
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);

  useEffect(() => {
    fetchEvolutions();
    fetchDoctors();
    fetchTemplates();
  }, [fetchEvolutions, fetchDoctors, fetchTemplates]);

  const selected = evolutions.find(e => e.id === selectedId) || null;

  const resetForm = useCallback(() => {
    setContent('');
    setShowDate(true);
    setEvolutionDate(new Date().toLocaleDateString('en-CA'));
    setBlocked(false);
    setSaveAsTemplate(false);
    setSaveAndPrint(false);
    setTemplateName('');
    setShowTemplatePanel(false);
  }, []);

  const handleCreate = () => {
    resetForm();
    setSelectedId(null);
    setMode('create');
  };

  const handleEdit = (ev: ClinicalEvolution) => {
    if (ev.blocked) {
      toast.error('Esta evolução está bloqueada e não pode ser editada.');
      return;
    }
    setSelectedId(ev.id);
    setContent(ev.content || '');
    setShowDate(ev.show_date ?? true);
    setEvolutionDate(ev.evolution_date || new Date().toLocaleDateString('en-CA'));
    setBlocked(false);
    setSaveAsTemplate(false);
    setSaveAndPrint(false);
    setTemplateName('');
    setMode('edit');
  };

  const handleView = (ev: ClinicalEvolution) => {
    setSelectedId(ev.id);
    setMode('view');
  };

  const handleBack = () => {
    setMode('list');
    setSelectedId(null);
    resetForm();
  };

  const handlePrint = async (ev: ClinicalEvolution) => {
    const { printWithLetterhead } = await import('@/lib/letterhead');
    const doctorName = ev.doctor_id ? (doctors[ev.doctor_id] || '—') : '';
    await printWithLetterhead(`
      <h1>Evolução Clínica</h1>
      <div class="meta">
        ${ev.show_date !== false && ev.evolution_date ? `<div>Data: ${new Date(ev.evolution_date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>` : ''}
        ${doctorName ? `<div>Profissional: ${doctorName}</div>` : ''}
      </div>
      <hr/>
      <div class="content">${ev.content || ''}</div>
    `, 'Evolução Clínica');
  };

  const handlePrintCurrentForm = async () => {
    const { printWithLetterhead } = await import('@/lib/letterhead');
    const doctorId = profile?.doctor_id;
    const doctorName = doctorId ? (doctors[doctorId] || '') : '';
    await printWithLetterhead(`
      <h1>Evolução Clínica</h1>
      <div class="meta">
        ${showDate && evolutionDate ? `<div>Data: ${new Date(evolutionDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>` : ''}
        ${doctorName ? `<div>Profissional: ${doctorName}</div>` : ''}
      </div>
      <hr/>
      <div class="content">${content}</div>
    `, 'Evolução Clínica');
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('O conteúdo da evolução é obrigatório.');
      return;
    }
    if (saveAsTemplate && !templateName.trim()) {
      toast.error('Informe o nome do modelo para salvar.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        content,
        signed: false,
        digital_signature: false,
        show_date: showDate,
        evolution_date: showDate ? evolutionDate : null,
        appointment_id: appointmentId || null,
        blocked,
      };

      if (mode === 'create') {
        await create(payload);
        toast.success('Evolução criada com sucesso!');
      } else if (mode === 'edit' && selectedId) {
        await update(selectedId, payload);
        toast.success('Evolução atualizada!');
      }

      // Salvar como modelo se solicitado
      if (saveAsTemplate && templateName.trim()) {
        try {
          await saveTemplateApi({ name: templateName.trim(), content });
          toast.success('Modelo salvo com sucesso!');
          await fetchTemplates();
        } catch {
          toast.error('Erro ao salvar modelo.');
        }
      }

      // Imprimir se solicitado
      if (saveAndPrint) {
        await handlePrintCurrentForm();
      }

      await fetchEvolutions();
      handleBack();
    } catch (err: unknown) {
      toast.error('Erro: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ev = evolutions.find(e => e.id === id);
    if (ev?.blocked) {
      toast.error('Esta evolução está bloqueada e não pode ser excluída.');
      setConfirmDeleteId(null);
      return;
    }
    try {
      await remove(id);
      toast.success('Evolução excluída.');
      await fetchEvolutions();
    } catch (err: unknown) {
      toast.error('Erro ao excluir: ' + (err instanceof Error ? err.message : ''));
    }
    setConfirmDeleteId(null);
  };

  const handleSelectTemplate = (tmpl: EvolutionTemplate) => {
    const processedContent = replaceTemplateVariables(tmpl.content || '', patientData);
    setContent(processedContent);
    toast.success(`Modelo "${tmpl.title}" aplicado.`);
  };

  // ── Loading ─────────────────────────────────────────────────
  if (loading && evolutions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Modo Visualização ───────────────────────────────────────
  if (mode === 'view' && selected) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Evolução Clínica</h2>
          {selected.blocked && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
              <Lock className="w-3 h-3" /> Bloqueada
            </span>
          )}
          <div className="ml-auto flex gap-2">
            {!selected.blocked && (
              <button onClick={() => handleEdit(selected)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
            )}
            <button onClick={() => handlePrint(selected)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#d4d4d8] rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-3">
          <div className="flex gap-6 text-sm text-slate-500 dark:text-[#a1a1aa]">
            {selected.show_date && selected.evolution_date && (
              <span>Data: <strong className="text-slate-700 dark:text-gray-200">{new Date(selected.evolution_date + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
            )}
            {selected.doctor_id && doctors[selected.doctor_id] && (
              <span>Profissional: <strong className="text-slate-700 dark:text-gray-200">{doctors[selected.doctor_id]}</strong></span>
            )}
          </div>
          <hr className="border-slate-100 dark:border-[#3d3d48]" />
          <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: selected.content || '<p class="text-slate-400">Sem conteúdo</p>' }} />
        </div>
      </div>
    );
  }

  // ── Modo Criação / Edição ───────────────────────────────────
  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">
            {mode === 'create' ? 'Nova Evolução' : 'Editar Evolução'}
          </h2>
          <div className="ml-auto flex items-center gap-3">
            {showDate && (
              <input
                type="date"
                value={evolutionDate}
                onChange={e => setEvolutionDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            )}
            <button
              onClick={() => setShowTemplatePanel(!showTemplatePanel)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                showTemplatePanel
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-slate-100 dark:bg-[#1c1c21] text-slate-600 dark:text-[#a1a1aa] hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Modelos
            </button>
          </div>
        </div>

        {/* Editor + Painel de Modelos */}
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Digite o conteúdo da evolução..."
              className="min-h-[300px]"
            />
          </div>
          {showTemplatePanel && (
            <EvolutionTemplatePanel templates={templates} onSelect={handleSelectTemplate} />
          )}
        </div>

        {/* RESTRIÇÕES */}
        <div className="border-t border-slate-200 dark:border-[#3d3d48] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Restrições</h3>
          </div>
          <div className="pl-1">
            <Toggle checked={blocked} onChange={setBlocked} label="Bloquear evolução" />
          </div>
        </div>

        {/* OPÇÕES */}
        <div className="border-t border-slate-200 dark:border-[#3d3d48] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Opções</h3>
          </div>
          <div className="pl-1 space-y-3">
            <Checkbox checked={saveAsTemplate} onChange={setSaveAsTemplate} label="Salvar como modelo" />
            {saveAsTemplate && (
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Nome do modelo..."
                className="ml-7 px-3 py-2 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 w-72"
              />
            )}
            <Checkbox checked={saveAndPrint} onChange={setSaveAndPrint} label="Salvar e imprimir" />
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="border-t border-slate-200 dark:border-[#3d3d48] pt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            SALVAR INFORMAÇÕES
          </button>
        </div>
      </div>
    );
  }

  // ── Modo Listagem ───────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Evoluções Clínicas</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> ADICIONAR EVOLUÇÃO
        </button>
      </div>

      {evolutions.length === 0 ? (
        <div className="text-center py-16">
          <TrendingUp className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-[#71717a]">Nenhuma evolução registrada.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#1c1c21] border-b border-slate-200 dark:border-[#3d3d48]">
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Data criação</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Data da evolução</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Profissional</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Opções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {evolutions.map(ev => (
                <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-slate-600 dark:text-[#d4d4d8]">
                    {new Date(ev.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-[#d4d4d8]">
                    {ev.evolution_date ? new Date(ev.evolution_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-[#d4d4d8]">
                    {ev.doctor_id ? (doctors[ev.doctor_id] || '—') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {ev.blocked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
                        <Lock className="w-3 h-3" /> BLOQUEADA
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                        ABERTA
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleView(ev)} title="Visualizar" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      {!ev.blocked && (
                        <button onClick={() => handleEdit(ev)} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {!ev.blocked && (
                        <button onClick={() => setConfirmDeleteId(ev.id)} title="Excluir" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handlePrint(ev)} title="Imprimir" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
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
        title="Excluir evolução"
        message="Tem certeza que deseja excluir esta evolução? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}

// ── Painel Lateral de Modelos de Evolução ───────────────────────
function EvolutionTemplatePanel({ templates, onSelect }: {
  templates: EvolutionTemplate[];
  onSelect: (t: EvolutionTemplate) => void;
}) {
  if (templates.length === 0) {
    return (
      <div className="w-64 shrink-0 bg-slate-50 dark:bg-[#16171c] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Modelos</h3>
        </div>
        <p className="text-xs text-slate-400 dark:text-[#71717a] text-center py-6">
          Nenhum modelo cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 bg-slate-50 dark:bg-[#16171c] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-4 overflow-y-auto max-h-[500px]">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-slate-400" />
        <h3 className="text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Modelos</h3>
      </div>
      <div className="space-y-2">
        {templates.map(tmpl => (
          <button
            key={tmpl.id}
            onClick={() => onSelect(tmpl)}
            className="w-full text-left p-3 rounded-lg bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group"
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
