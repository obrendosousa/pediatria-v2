'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Save, FileText, Trash2, Eye, Edit3, Plus, Minus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { useToast } from '@/contexts/ToastContext';

interface ModelTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (content: string) => void;
  onSave: (title: string, content: string, type: string) => void;
  type: string;
  currentContent?: string;
}

// ─── Helpers para detectar e formatar conteúdo JSON ──────────────────────────

type ParsedContentType = 'html' | 'exams' | 'prescription';

interface ExamItem {
  code: string;
  name: string;
  quantity: number;
}

interface PrescriptionData {
  medications: { name: string; posology: string; quantity: number; unit: string; receipt_type: string }[];
  exams: { code: string; name: string; quantity: number }[];
  vaccines: { name: string; dose: string }[];
}

function detectContentType(content: string): ParsedContentType {
  if (!content || !content.trim()) return 'html';
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0 && ('name' in parsed[0] || 'code' in parsed[0])) {
      return 'exams';
    }
    if (parsed.medications || parsed.exams || parsed.vaccines) {
      return 'prescription';
    }
  } catch {
    // not JSON
  }
  return 'html';
}

function parseExams(content: string): ExamItem[] {
  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function parsePrescription(content: string): PrescriptionData {
  try {
    const p = JSON.parse(content);
    return {
      medications: p.medications || [],
      exams: p.exams || [],
      vaccines: p.vaccines || [],
    };
  } catch {
    return { medications: [], exams: [], vaccines: [] };
  }
}

function formatContentPreview(content: string): string {
  const type = detectContentType(content);
  if (type === 'exams') {
    const exams = parseExams(content);
    return exams
      .filter(e => e.name || e.code)
      .map(e => `${e.code ? e.code + ' - ' : ''}${e.name} (x${e.quantity})`)
      .join(', ');
  }
  if (type === 'prescription') {
    const p = parsePrescription(content);
    const parts: string[] = [];
    const meds = p.medications.filter(m => m.name.trim());
    const exams = p.exams.filter(e => e.name.trim());
    const vacs = p.vaccines.filter(v => v.name.trim());
    if (meds.length) parts.push(`${meds.length} medicamento(s)`);
    if (exams.length) parts.push(`${exams.length} exame(s)`);
    if (vacs.length) parts.push(`${vacs.length} vacina(s)`);
    return parts.join(', ') || 'Prescrição vazia';
  }
  return content.replace(/<[^>]*>/g, '').substring(0, 120);
}

// ─── Editor de Exames (visual) ──────────────────────────────────────────────

function ExamsEditor({
  items,
  onChange,
}: {
  items: ExamItem[];
  onChange: (items: ExamItem[]) => void;
}) {
  const update = (i: number, field: keyof ExamItem, value: string | number) => {
    const next = items.map((item, idx) =>
      idx === i ? { ...item, [field]: value } : item
    );
    onChange(next);
  };
  const remove = (i: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, idx) => idx !== i));
  };
  const add = () => onChange([...items, { code: '', name: '', quantity: 1 }]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[80px_1fr_70px_32px] gap-2 text-xs font-medium text-slate-500 dark:text-gray-400 uppercase px-1">
        <span>Código</span>
        <span>Nome do Exame</span>
        <span>Qtd.</span>
        <span></span>
      </div>
      {items.map((exam, i) => (
        <div key={i} className="grid grid-cols-[80px_1fr_70px_32px] gap-2 items-center">
          <input
            type="text"
            value={exam.code}
            onChange={(e) => update(i, 'code', e.target.value)}
            placeholder="Código"
            className="px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            type="text"
            value={exam.name}
            onChange={(e) => update(i, 'name', e.target.value)}
            placeholder="Nome do exame"
            className="px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            type="number"
            min={1}
            value={exam.quantity}
            onChange={(e) => update(i, 'quantity', parseInt(e.target.value) || 1)}
            className="px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-center"
          />
          <button
            onClick={() => remove(i)}
            disabled={items.length <= 1}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-30"
          >
            <Minus className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 mt-1"
      >
        <Plus className="w-4 h-4" />
        Adicionar exame
      </button>
    </div>
  );
}

// ─── Editor de Prescrição (visual) ──────────────────────────────────────────

function PrescriptionEditor({
  data,
  onChange,
}: {
  data: PrescriptionData;
  onChange: (data: PrescriptionData) => void;
}) {
  const updateMed = (i: number, field: string, value: string | number) => {
    const meds = data.medications.map((m, idx) =>
      idx === i ? { ...m, [field]: value } : m
    );
    onChange({ ...data, medications: meds });
  };
  const removeMed = (i: number) => {
    if (data.medications.length <= 1) return;
    onChange({ ...data, medications: data.medications.filter((_, idx) => idx !== i) });
  };
  const addMed = () =>
    onChange({ ...data, medications: [...data.medications, { name: '', posology: '', quantity: 1, unit: 'embalagem', receipt_type: 'simples' }] });

  const updateExam = (i: number, field: string, value: string | number) => {
    const exams = data.exams.map((e, idx) =>
      idx === i ? { ...e, [field]: value } : e
    );
    onChange({ ...data, exams });
  };
  const removeExam = (i: number) => {
    onChange({ ...data, exams: data.exams.filter((_, idx) => idx !== i) });
  };
  const addExam = () =>
    onChange({ ...data, exams: [...data.exams, { code: '', name: '', quantity: 1 }] });

  const updateVaccine = (i: number, field: string, value: string) => {
    const vaccines = data.vaccines.map((v, idx) =>
      idx === i ? { ...v, [field]: value } : v
    );
    onChange({ ...data, vaccines });
  };
  const removeVaccine = (i: number) => {
    onChange({ ...data, vaccines: data.vaccines.filter((_, idx) => idx !== i) });
  };
  const addVaccine = () =>
    onChange({ ...data, vaccines: [...data.vaccines, { name: '', dose: '1a dose' }] });

  const hasMeds = data.medications.some(m => m.name.trim());
  const hasExams = data.exams.some(e => e.name.trim());
  const hasVaccines = data.vaccines.some(v => v.name.trim());

  return (
    <div className="space-y-5">
      {/* Medicamentos */}
      {(data.medications.length > 0) && (
        <div>
          <h4 className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Medicamentos ({data.medications.filter(m => m.name.trim()).length})
          </h4>
          <div className="space-y-2">
            {data.medications.map((med, i) => (
              <div key={i} className="p-3 border border-slate-200 dark:border-gray-700 rounded-lg space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={med.name}
                    onChange={(e) => updateMed(i, 'name', e.target.value)}
                    placeholder="Nome do medicamento"
                    className="flex-1 px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    onClick={() => removeMed(i)}
                    disabled={data.medications.length <= 1}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-30"
                  >
                    <Minus className="w-4 h-4 text-red-500" />
                  </button>
                </div>
                <input
                  type="text"
                  value={med.posology}
                  onChange={(e) => updateMed(i, 'posology', e.target.value)}
                  placeholder="Posologia"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={med.quantity}
                    onChange={(e) => updateMed(i, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-20 px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-center"
                  />
                  <span className="text-xs text-slate-500 dark:text-gray-400 self-center">{med.unit}</span>
                </div>
              </div>
            ))}
            <button onClick={addMed} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 mt-1">
              <Plus className="w-4 h-4" /> Adicionar medicamento
            </button>
          </div>
        </div>
      )}

      {/* Exames */}
      {(data.exams.length > 0) && (
        <div>
          <h4 className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Exames ({data.exams.filter(e => e.name.trim()).length})
          </h4>
          <div className="space-y-2">
            {data.exams.map((exam, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={exam.code}
                  onChange={(e) => updateExam(i, 'code', e.target.value)}
                  placeholder="Código"
                  className="w-20 px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="text"
                  value={exam.name}
                  onChange={(e) => updateExam(i, 'name', e.target.value)}
                  placeholder="Nome do exame"
                  className="flex-1 px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="number"
                  min={1}
                  value={exam.quantity}
                  onChange={(e) => updateExam(i, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-center"
                />
                <button onClick={() => removeExam(i)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors">
                  <Minus className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
            <button onClick={addExam} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 mt-1">
              <Plus className="w-4 h-4" /> Adicionar exame
            </button>
          </div>
        </div>
      )}

      {/* Vacinas */}
      {(data.vaccines.length > 0) && (
        <div>
          <h4 className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Vacinas ({data.vaccines.filter(v => v.name.trim()).length})
          </h4>
          <div className="space-y-2">
            {data.vaccines.map((vac, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={vac.name}
                  onChange={(e) => updateVaccine(i, 'name', e.target.value)}
                  placeholder="Nome da vacina"
                  className="flex-1 px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="text"
                  value={vac.dose}
                  onChange={(e) => updateVaccine(i, 'dose', e.target.value)}
                  placeholder="Dose"
                  className="w-28 px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button onClick={() => removeVaccine(i)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors">
                  <Minus className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
            <button onClick={addVaccine} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 mt-1">
              <Plus className="w-4 h-4" /> Adicionar vacina
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Visualizador formatado (somente leitura) ───────────────────────────────

function FormattedContentView({ content }: { content: string }) {
  const type = detectContentType(content);

  if (type === 'exams') {
    const exams = parseExams(content).filter(e => e.name || e.code);
    return (
      <div className="space-y-1.5">
        {exams.map((exam, i) => (
          <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-[#2a2d36] rounded-md">
            {exam.code && (
              <span className="text-xs font-mono text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {exam.code}
              </span>
            )}
            <span className="text-sm text-slate-700 dark:text-gray-200 flex-1">{exam.name}</span>
            <span className="text-xs text-slate-500 dark:text-gray-400">x{exam.quantity}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'prescription') {
    const p = parsePrescription(content);
    const meds = p.medications.filter(m => m.name.trim());
    const exams = p.exams.filter(e => e.name.trim());
    const vaccines = p.vaccines.filter(v => v.name.trim());

    return (
      <div className="space-y-4">
        {meds.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase mb-1.5">Medicamentos</h4>
            {meds.map((m, i) => (
              <div key={i} className="p-2 bg-slate-50 dark:bg-[#2a2d36] rounded-md mb-1.5">
                <div className="text-sm font-medium text-slate-700 dark:text-gray-200">{m.name}</div>
                {m.posology && <div className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{m.posology}</div>}
                <div className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{m.quantity} {m.unit}</div>
              </div>
            ))}
          </div>
        )}
        {exams.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase mb-1.5">Exames</h4>
            {exams.map((e, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-[#2a2d36] rounded-md mb-1.5">
                {e.code && <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{e.code}</span>}
                <span className="text-sm text-slate-700 dark:text-gray-200 flex-1">{e.name}</span>
                <span className="text-xs text-slate-500 dark:text-gray-400">x{e.quantity}</span>
              </div>
            ))}
          </div>
        )}
        {vaccines.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase mb-1.5">Vacinas</h4>
            {vaccines.map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-[#2a2d36] rounded-md mb-1.5">
                <span className="text-sm text-slate-700 dark:text-gray-200 flex-1">{v.name}</span>
                <span className="text-xs text-slate-500 dark:text-gray-400">{v.dose}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // HTML content
  return (
    <div
      className="p-4 text-sm text-slate-700 dark:text-gray-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

// ─── Modal Principal ────────────────────────────────────────────────────────

export function ModelTemplateModal({
  isOpen,
  onClose,
  onSelect,
  onSave,
  type,
  currentContent = ''
}: ModelTemplateModalProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [saveMode, setSaveMode] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [editableContent, setEditableContent] = useState('');
  const [editableExams, setEditableExams] = useState<ExamItem[]>([]);
  const [editablePrescription, setEditablePrescription] = useState<PrescriptionData>({ medications: [], exams: [], vaccines: [] });
  const [contentType, setContentType] = useState<ParsedContentType>('html');
  const [isSaving, setIsSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const contentEditorRef = useRef<HTMLDivElement>(null);

  // Determine initial mode based on currentContent
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      const detectedType = detectContentType(currentContent);
      setContentType(detectedType);

      if (currentContent && currentContent.trim()) {
        setSaveMode(true);
        setSaveTitle('');

        if (detectedType === 'exams') {
          setEditableExams(parseExams(currentContent));
          setEditableContent('');
        } else if (detectedType === 'prescription') {
          setEditablePrescription(parsePrescription(currentContent));
          setEditableContent('');
        } else {
          setEditableContent(currentContent);
        }
      } else {
        setSaveMode(false);
        setEditableContent('');
        setSaveTitle('');
      }
      setPreviewTemplate(null);
    }
  }, [isOpen, type, currentContent]);

  // Sync structured data back to editableContent string for saving
  function getContentToSave(): string {
    if (contentType === 'exams') {
      return JSON.stringify(editableExams);
    }
    if (contentType === 'prescription') {
      return JSON.stringify(editablePrescription);
    }
    return editableContent;
  }

  async function loadTemplates() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('macros')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Erro ao carregar modelos:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!saveTitle.trim()) {
      toast.toast.error('Preencha o titulo do modelo.');
      return;
    }

    const contentToSave = getContentToSave();
    if (!contentToSave.trim()) {
      toast.toast.error('O conteudo do modelo nao pode estar vazio.');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('macros')
        .insert({
          title: saveTitle,
          type: type,
          content: contentToSave,
          category: 'geral',
        });

      if (error) throw error;

      setSaveMode(false);
      setSaveTitle('');
      setEditableContent('');
      loadTemplates();
      toast.toast.success('Modelo salvo com sucesso!');
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar modelo:', err);
      toast.toast.error('Erro ao salvar modelo: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTemplate(templateId: number) {
    try {
      const { error } = await supabase
        .from('macros')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      if (previewTemplate?.id === templateId) setPreviewTemplate(null);
      toast.toast.success('Modelo excluido.');
    } catch (err: any) {
      toast.toast.error('Erro ao excluir modelo: ' + err.message);
    }
  }

  const filteredTemplates = templates.filter(template =>
    template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1e2028] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${saveMode ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
              {saveMode ? <Save className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">
                {saveMode ? 'Salvar Modelo' : 'Modelos Salvos'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {saveMode ? 'Preencha o nome e revise o conteudo antes de salvar' : 'Selecione um modelo para usar'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-[#2a2d36] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {saveMode ? (
            <div className="space-y-4">
              {/* Title Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                  Nome do Modelo
                </label>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="Ex: Conduta padrao para IVAS"
                  autoFocus
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Content Editor - different rendering based on content type */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                    {contentType === 'exams' ? 'Exames do Modelo' : contentType === 'prescription' ? 'Itens da Prescricao' : 'Conteudo do Modelo'}
                  </label>
                  <span className="text-xs text-slate-400 dark:text-gray-500 flex items-center gap-1">
                    <Edit3 className="w-3 h-3" />
                    Editavel
                  </span>
                </div>

                {contentType === 'exams' ? (
                  <div className="border border-slate-200 dark:border-gray-700 rounded-lg p-4 bg-slate-50 dark:bg-[#2a2d36]">
                    <ExamsEditor items={editableExams} onChange={setEditableExams} />
                  </div>
                ) : contentType === 'prescription' ? (
                  <div className="border border-slate-200 dark:border-gray-700 rounded-lg p-4 bg-slate-50 dark:bg-[#2a2d36] max-h-[350px] overflow-y-auto custom-scrollbar">
                    <PrescriptionEditor data={editablePrescription} onChange={setEditablePrescription} />
                  </div>
                ) : (
                  <div
                    ref={contentEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: editableContent }}
                    onInput={(e) => setEditableContent(e.currentTarget.innerHTML)}
                    className="w-full min-h-[200px] max-h-[350px] overflow-y-auto px-4 py-3 border border-slate-200 dark:border-gray-700 rounded-lg bg-slate-50 dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm leading-relaxed custom-scrollbar prose prose-sm dark:prose-invert max-w-none"
                  />
                )}

                <p className="mt-1.5 text-xs text-slate-400 dark:text-gray-500">
                  O conteudo acima foi preenchido a partir do que voce ja digitou na tela. Edite conforme necessario antes de salvar.
                </p>
              </div>
            </div>
          ) : previewTemplate ? (
            /* Template Preview Mode */
            <div className="space-y-4">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                &larr; Voltar para lista
              </button>
              <div className="border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-slate-50 dark:bg-[#2a2d36] px-4 py-3 border-b border-slate-200 dark:border-gray-700">
                  <h3 className="font-semibold text-slate-800 dark:text-gray-200">{previewTemplate.title}</h3>
                </div>
                <div className="p-4">
                  <FormattedContentView content={previewTemplate.content} />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onSelect(previewTemplate.content);
                    onClose();
                  }}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Usar este modelo
                </button>
                <button
                  onClick={() => handleDeleteTemplate(previewTemplate.id)}
                  className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar modelos..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Templates List */}
              {isLoading ? (
                <div className="text-center py-8 text-slate-500 dark:text-gray-400">Carregando...</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>{searchTerm ? 'Nenhum modelo encontrado.' : 'Nenhum modelo salvo ainda.'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="group flex items-start gap-3 p-4 border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-900/10 hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer"
                      onClick={() => setPreviewTemplate(template)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 dark:text-gray-200 mb-1">
                          {template.title}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-gray-400 line-clamp-2">
                          {formatContentPreview(template.content)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(template.content);
                            onClose();
                          }}
                          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                          title="Usar modelo"
                        >
                          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTemplate(template);
                          }}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#2a2d36] rounded-md transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4 text-slate-500 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(template.id);
                          }}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {saveMode ? (
          <div className="p-5 border-t border-slate-200 dark:border-gray-700 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Modelo'}
            </button>
            <button
              onClick={() => {
                if (currentContent && currentContent.trim()) {
                  onClose();
                } else {
                  setSaveMode(false);
                  setSaveTitle('');
                  setEditableContent('');
                }
              }}
              className="px-4 py-2.5 bg-slate-100 dark:bg-[#2a2d36] hover:bg-slate-200 dark:hover:bg-[#353842] text-slate-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : !previewTemplate && (
          <div className="p-5 border-t border-slate-200 dark:border-gray-700">
            <button
              onClick={() => {
                setSaveMode(true);
                const ct = detectContentType(currentContent || '');
                setContentType(ct);
                if (ct === 'exams') {
                  setEditableExams(parseExams(currentContent || ''));
                } else if (ct === 'prescription') {
                  setEditablePrescription(parsePrescription(currentContent || ''));
                } else {
                  setEditableContent(currentContent || '');
                }
              }}
              className="w-full px-4 py-2.5 bg-slate-100 dark:bg-[#2a2d36] hover:bg-slate-200 dark:hover:bg-[#353842] text-slate-700 dark:text-gray-200 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Salvar Novo Modelo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
