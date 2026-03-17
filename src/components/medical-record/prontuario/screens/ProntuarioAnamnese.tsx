'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback, useRef } from 'react';
import { ProntuarioScreenProps } from '@/types/prontuario';
import { useAnamneses, type Anamnese, type AnamneseTemplate, type AnamneseQuestion, type QuestionType } from '@/hooks/atendimento/useAnamneses';
import { useToast } from '@/contexts/ToastContext';
import { RichTextEditor } from '@/components/medical-record/attendance/RichTextEditor';
import { replaceTemplateVariables } from '@/utils/templateVariables';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  Plus, Eye, Pencil, Trash2, Printer, ArrowLeft, FileText, Loader2,
  Search, ChevronDown, Lock, Upload, X, GripVertical, BookOpen,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const pubSupabase = createClient();

type ViewMode = 'list' | 'create' | 'edit' | 'view';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'multiple_choice', label: 'Múltipla escolha' },
  { value: 'checkbox', label: 'Caixa de seleção' },
  { value: 'gestational_calculator', label: 'Calculadora gestacional' },
];

const labelCls = 'text-[11px] font-semibold text-slate-500 dark:text-[#52525b] uppercase tracking-wide mb-1.5 block';
const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#1e1e24] rounded-lg bg-white dark:bg-[#131316] text-slate-700 dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-[#3f3f46]';
const cardCls = 'bg-white dark:bg-[#131316] border border-slate-200/80 dark:border-[#1e1e24] rounded-xl';

// Sanitiza query para uso seguro em filtros PostgREST
function sanitizeCidQuery(q: string): string {
  return q.replace(/[%_(),.\\]/g, '');
}

// ── CID Search ──
function CidSearch({ selected, onChange }: { selected: string[]; onChange: (cids: string[]) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ code: string; description: string }[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click-outside para fechar dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const sanitized = sanitizeCidQuery(query);
    if (sanitized.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      // Tenta RPC primeiro, fallback para busca direta
      const { data: rpcData } = await pubSupabase.rpc('search_cid10', { search_query: sanitized });
      if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        setResults(rpcData.slice(0, 15) as { code: string; description: string }[]);
        setOpen(true);
        return;
      }
      // Fallback: busca direta em cid_sub_categoria
      const { data: directData } = await pubSupabase
        .from('cid_sub_categoria')
        .select('id, descricao')
        .or(`id.ilike.%${sanitized}%,descricao.ilike.%${sanitized}%`)
        .limit(15);
      if (directData && directData.length > 0) {
        setResults(directData.map((d: Record<string, unknown>) => ({
          code: String(d.id).length === 4 ? String(d.id).slice(0, 3) + '.' + String(d.id).slice(3) : String(d.id),
          description: String(d.descricao),
        })));
        setOpen(true);
        return;
      }
      // Último fallback: tabela cid10
      const { data: cid10Data } = await pubSupabase
        .from('cid10')
        .select('code, description')
        .or(`code.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
        .limit(15);
      setResults((cid10Data || []) as { code: string; description: string }[]);
      setOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div>
      <label className={labelCls}>CID</label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(code => (
            <span key={code} className="inline-flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md border border-indigo-200 dark:border-indigo-500/20">
              {code}
              <button type="button" onClick={() => onChange(selected.filter(c => c !== code))} className="hover:text-red-500"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative" ref={wrapperRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#3f3f46]" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Pesquisar CID por código ou descrição..."
          className={`${inputCls} pl-9`}
        />
        {open && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto bg-white dark:bg-[#131316] border border-slate-200 dark:border-[#1e1e24] rounded-lg shadow-xl">
            {results.map(r => {
              const added = selected.includes(r.code);
              return (
                <button key={r.code} type="button" disabled={added} onClick={() => { onChange([...selected, r.code]); setQuery(''); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-b border-slate-100 dark:border-[#1a1a1f] last:border-0 ${added ? 'opacity-40' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer'}`}>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 w-14 shrink-0">{r.code}</span>
                  <span className="truncate text-slate-600 dark:text-[#a1a1aa]">{r.description}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Question Builder ──
function QuestionBuilder({ questions, onChange }: { questions: AnamneseQuestion[]; onChange: (q: AnamneseQuestion[]) => void }) {
  const [text, setText] = useState('');
  const [type, setType] = useState<QuestionType>('text');
  const [options, setOptions] = useState<string[]>(['']);

  const needsOptions = type === 'multiple_choice' || type === 'checkbox';

  const handleAdd = () => {
    if (!text.trim()) return;
    const validOptions = needsOptions ? options.filter(o => o.trim()) : undefined;
    if (needsOptions && (!validOptions || validOptions.length === 0)) return;
    const q: AnamneseQuestion = {
      id: crypto.randomUUID(),
      text: text.trim(),
      type,
      options: validOptions,
    };
    onChange([...questions, q]);
    setText('');
    setType('text');
    setOptions(['']);
  };

  const handleRemove = (id: string) => onChange(questions.filter(q => q.id !== id));

  return (
    <div className="space-y-4">
      <label className={labelCls}>Perguntas</label>

      {/* Builder */}
      <div className={`${cardCls} p-4 space-y-3`}>
        <div className="grid grid-cols-[1fr_180px] gap-3">
          <div>
            <label className="text-[10px] text-slate-400 dark:text-[#52525b] font-medium mb-1 block">Pergunta *</label>
            <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Digite a pergunta..." className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 dark:text-[#52525b] font-medium mb-1 block">Tipo</label>
            <div className="relative">
              <select value={type} onChange={e => { setType(e.target.value as QuestionType); setOptions(['']); }}
                className={`${inputCls} appearance-none pr-8`}>
                {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Options for multiple choice / checkbox */}
        {needsOptions && (
          <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-500/20 space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={opt} onChange={e => { const next = [...options]; next[i] = e.target.value; setOptions(next); }}
                  placeholder={`Opção ${i + 1}`} className={`${inputCls} text-xs`} />
                {options.length > 1 && (
                  <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 p-1"><X size={14} /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setOptions([...options, ''])} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">
              + Adicionar outra resposta
            </button>
          </div>
        )}

        <button type="button" onClick={handleAdd} disabled={!text.trim() || (needsOptions && options.filter(o => o.trim()).length === 0)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed">
          <Plus size={14} /> ADICIONAR
        </button>
      </div>

      {/* Questionário — perguntas adicionadas */}
      {questions.length > 0 && (
        <div>
          <label className={labelCls}>Questionário ({questions.length} pergunta{questions.length !== 1 ? 's' : ''})</label>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={q.id} className={`${cardCls} px-4 py-3 flex items-start gap-3`}>
                <GripVertical className="w-4 h-4 text-slate-300 dark:text-[#3f3f46] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-[#e4e4e7]">{i + 1}. {q.text}</p>
                  <p className="text-[10px] text-slate-400 dark:text-[#52525b] mt-0.5">
                    {QUESTION_TYPES.find(t => t.value === q.type)?.label}
                    {q.options && q.options.length > 0 && ` — ${q.options.join(', ')}`}
                  </p>
                </div>
                <button type="button" onClick={() => handleRemove(q.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente Principal ──
export function ProntuarioAnamnese({ patientId, patientData }: ProntuarioScreenProps) {
  const { toast } = useToast();
  const {
    anamneses, templates, doctors, professionals, loading,
    fetchAnamneses, fetchDoctors, fetchProfessionals, fetchTemplates, getTemplateQuestions,
    create, update, remove,
  } = useAnamneses(patientId);

  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [questions, setQuestions] = useState<AnamneseQuestion[]>([]);
  const [cidCodes, setCidCodes] = useState<string[]>([]);
  const [signed, setSigned] = useState(false);
  const [showDate, setShowDate] = useState(true);
  const [fillDate, setFillDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [allowedProfessionals, setAllowedProfessionals] = useState<number[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [printOnSave, setPrintOnSave] = useState(false);

  useEffect(() => {
    fetchAnamneses();
    fetchDoctors();
    fetchProfessionals();
    fetchTemplates();
  }, [fetchAnamneses, fetchDoctors, fetchProfessionals, fetchTemplates]);

  const selected = anamneses.find(a => a.id === selectedId) || null;

  const resetForm = useCallback(() => {
    setTitle(''); setContent(''); setQuestions([]); setCidCodes([]);
    setSigned(false); setShowDate(true); setFillDate(new Date().toLocaleDateString('en-CA'));
    setTemplateId(null); setBlocked(false); setAllowedProfessionals([]);
    setSaveAsTemplate(false); setPrintOnSave(false);
  }, []);

  const handleCreate = () => { resetForm(); setSelectedId(null); setMode('create'); };

  const handleEdit = (a: Anamnese) => {
    setSelectedId(a.id);
    setTitle(a.title || ''); setContent(a.content || '');
    setQuestions(a.questions || []); setCidCodes(a.cid_codes || []);
    setSigned(a.signed); setShowDate(a.show_date ?? true);
    setFillDate(a.fill_date || new Date().toLocaleDateString('en-CA'));
    setTemplateId(a.template_id); setBlocked(a.blocked || false);
    setAllowedProfessionals(a.allowed_professionals || []);
    setMode('edit');
  };

  const handleView = (a: Anamnese) => { setSelectedId(a.id); setMode('view'); };
  const handleBack = () => { setMode('list'); setSelectedId(null); resetForm(); };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Título é obrigatório.'); return; }
    if (blocked && allowedProfessionals.length === 0) {
      toast.error('Selecione ao menos um profissional com acesso à anamnese bloqueada.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        content, questions: questions.length > 0 ? questions : null,
        cid_codes: cidCodes.length > 0 ? cidCodes : null,
        signed, show_date: showDate,
        fill_date: showDate ? fillDate : null,
        template_id: templateId != null && templateId > 0 ? templateId : null,
        blocked, allowed_professionals: blocked ? allowedProfessionals : null,
        save_as_template: saveAsTemplate,
        appointment_id: null,
      };

      let savedAnamnese: Anamnese | null = null;
      if (mode === 'create') {
        savedAnamnese = await create(payload);
        toast.success('Anamnese criada!');
      } else if (mode === 'edit' && selectedId) {
        await update(selectedId, payload);
        // Monta objeto para impressão com os dados atuais do formulário
        savedAnamnese = {
          ...anamneses.find(a => a.id === selectedId)!,
          ...payload,
          id: selectedId,
          patient_id: patientId,
        } as Anamnese;
        toast.success('Anamnese atualizada!');
      }

      // ── Salvar como modelo: cria template ──
      if (saveAsTemplate) {
        const { createSchemaClient } = await import('@/lib/supabase/schemaClient');
        const supa = createSchemaClient('atendimento');

        if (questions.length > 0) {
          // Modelo com perguntas dinâmicas → anamnesis_templates
          const { data: newTpl } = await supa
            .from('anamnesis_templates')
            .insert({ title: title.trim(), allow_send_on_scheduling: false })
            .select('id')
            .single();

          if (newTpl) {
            const questionRows = questions.map((q, idx) => ({
              template_id: newTpl.id,
              question: q.text,
              type: q.type,
              options: q.options || [],
              sort_order: idx,
            }));
            await supa.from('anamnesis_questions').insert(questionRows);
          }
        } else if (content.trim()) {
          // Modelo com conteúdo rich text → clinical_templates
          await supa
            .from('clinical_templates')
            .insert({ title: title.trim(), content: content.trim(), template_type: 'anamnese' });
        }
        toast.success('Modelo salvo para reutilização!');
      }

      // ── Salvar e imprimir ──
      if (printOnSave && savedAnamnese) {
        handlePrint(savedAnamnese);
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
    try { await remove(id); toast.success('Anamnese excluída.'); await fetchAnamneses(); } catch { toast.error('Erro ao excluir'); }
    setConfirmDeleteId(null);
  };

  const handlePrint = async (a: Anamnese) => {
    const { printWithLetterhead } = await import('@/lib/letterhead');
    const doctorName = a.doctor_id ? (doctors[a.doctor_id] || '') : '';

    const formatAnswer = (q: AnamneseQuestion): string => {
      if (q.answer == null) return '<em style="color:#999">Sem resposta</em>';
      if (q.type === 'checkbox' && Array.isArray(q.answer)) return q.answer.join(', ');
      if (q.type === 'gestational_calculator') {
        const diffMs = Date.now() - new Date((q.answer as string) + 'T00:00:00').getTime();
        if (diffMs < 0) return `DUM: ${new Date((q.answer as string) + 'T00:00:00').toLocaleDateString('pt-BR')} (data futura)`;
        const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
        const days = Math.floor((diffMs % (7 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
        return `DUM: ${new Date((q.answer as string) + 'T00:00:00').toLocaleDateString('pt-BR')} — ${weeks}s ${days}d`;
      }
      return String(q.answer);
    };

    await printWithLetterhead(`
      <h1>${a.title || 'Anamnese'}</h1>
      <div class="meta">
        ${a.fill_date ? `<div>Data: ${new Date(a.fill_date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>` : ''}
        ${doctorName ? `<div>Profissional: ${doctorName}</div>` : ''}
        ${a.cid_codes && a.cid_codes.length > 0 ? `<div>CID: ${a.cid_codes.join(', ')}</div>` : ''}
      </div>
      <hr/>
      <div class="content">${a.content || ''}</div>
      ${a.questions && a.questions.length > 0 ? `
        <h3 style="margin-top:16px">Questionário</h3>
        ${a.questions.map((q, i) => `
          <div style="margin-bottom:10px">
            <strong>${i + 1}. ${q.text}</strong>
            <div style="margin-left:16px;margin-top:4px">${formatAnswer(q)}</div>
          </div>
        `).join('')}
      ` : ''}
      ${a.signed ? '<p style="margin-top:40px;font-weight:bold">Assinado digitalmente</p>' : ''}
    `, a.title || 'Anamnese');
  };

  const handleSelectTemplate = async (tmpl: AnamneseTemplate) => {
    // Preencher título com nome do modelo
    if (!title.trim()) setTitle(tmpl.title);

    // Legacy templates: conteúdo rich text
    if (tmpl.content) setContent(replaceTemplateVariables(tmpl.content, patientData));
    if (tmpl.questions) setQuestions(tmpl.questions);
    setTemplateId(tmpl.id);

    // Cadastros templates: buscar perguntas do banco
    if (tmpl._cadastroId) {
      const fetchedQuestions = await getTemplateQuestions(tmpl._cadastroId);
      if (fetchedQuestions.length > 0) {
        setQuestions(fetchedQuestions);
      }
    }
  };

  // ── Loading ──
  if (loading && anamneses.length === 0) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  // ── View Mode ──
  if (mode === 'view' && selected) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer"><ArrowLeft className="w-5 h-5 text-slate-400" /></button>
          <h2 className="text-base font-semibold text-slate-800 dark:text-[#e4e4e7]">{selected.title || 'Anamnese'}</h2>
          <div className="ml-auto flex gap-2">
            <button onClick={() => handleEdit(selected)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/15 transition-colors cursor-pointer"><Pencil size={13} /> Editar</button>
            <button onClick={() => handlePrint(selected)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-[#71717a] bg-slate-100 dark:bg-white/[0.04] rounded-lg hover:bg-slate-200 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"><Printer size={13} /> Imprimir</button>
          </div>
        </div>
        <div className={`${cardCls} p-6 space-y-3`}>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-[#71717a]">
            {selected.fill_date && <span>Data: <strong className="text-slate-700 dark:text-[#e4e4e7]">{new Date(selected.fill_date + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>}
            {selected.doctor_id && doctors[selected.doctor_id] && <span>Profissional: <strong className="text-slate-700 dark:text-[#e4e4e7]">{doctors[selected.doctor_id]}</strong></span>}
            {selected.signed && <span className="text-emerald-600 dark:text-emerald-400 font-bold">Assinado</span>}
            {selected.blocked && <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-bold"><Lock size={12} /> Bloqueado</span>}
            {selected.cid_codes?.map(c => <span key={c} className="font-mono text-indigo-600 dark:text-indigo-400">{c}</span>)}
          </div>
          <hr className="border-slate-100 dark:border-[#1e1e24]" />
          {selected.content && <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: selected.content }} />}
          {selected.questions && selected.questions.length > 0 && (
            <div className="space-y-3 pt-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-[#52525b] uppercase">Questionário</p>
              {selected.questions.map((q, i) => (
                <div key={q.id} className={`${cardCls} px-4 py-3`}>
                  <p className="text-sm font-medium text-slate-700 dark:text-[#e4e4e7]">
                    <span className="text-blue-500 font-bold mr-1.5">{i + 1}.</span>
                    {q.text}
                    <span className="text-[10px] text-slate-400 ml-2">({QUESTION_TYPES.find(t => t.value === q.type)?.label})</span>
                  </p>
                  {q.answer != null && (
                    <div className="mt-1.5 pl-4 border-l-2 border-blue-200 dark:border-blue-500/20">
                      {q.type === 'text' && (
                        <p className="text-sm text-slate-600 dark:text-[#d4d4d8] whitespace-pre-wrap">{q.answer as string}</p>
                      )}
                      {q.type === 'multiple_choice' && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{q.answer as string}</p>
                      )}
                      {q.type === 'checkbox' && Array.isArray(q.answer) && (
                        <div className="flex flex-wrap gap-1.5">
                          {q.answer.map((a, j) => (
                            <span key={j} className="text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md">{a}</span>
                          ))}
                        </div>
                      )}
                      {q.type === 'gestational_calculator' && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                          DUM: {new Date((q.answer as string) + 'T00:00:00').toLocaleDateString('pt-BR')}
                          {(() => {
                            const diffMs = Date.now() - new Date((q.answer as string) + 'T00:00:00').getTime();
                            if (diffMs < 0) return ' (data futura)';
                            const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
                            const days = Math.floor((diffMs % (7 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
                            return ` — ${weeks}s ${days}d`;
                          })()}
                        </p>
                      )}
                    </div>
                  )}
                  {(q.answer == null || (typeof q.answer === 'string' && !q.answer.trim()) || (Array.isArray(q.answer) && q.answer.length === 0)) && (
                    <p className="mt-1 text-xs text-slate-400 dark:text-[#52525b] italic">Sem resposta</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Create / Edit Mode ──
  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="p-6 space-y-5 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer"><ArrowLeft className="w-5 h-5 text-slate-400" /></button>
          <h2 className="text-base font-semibold text-slate-800 dark:text-[#e4e4e7]">{mode === 'create' ? 'Nova Anamnese' : 'Editar Anamnese'}</h2>
        </div>

        {/* 2.1 Usar modelo */}
        <div>
          <label className={labelCls}>Usar modelo</label>
          <div className="relative">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#3f3f46]" />
            <select onChange={e => { const t = templates.find(t => String(t.id) === e.target.value); if (t) handleSelectTemplate(t); }} className={`${inputCls} pl-9 appearance-none`}>
              <option value="">Selecione um modelo</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* 2.2 + 2.3 Titulo + Assinar + Data */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-end">
          <div>
            <label className={labelCls}>Título *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Digite o nome da anamnese" className={inputCls} />
          </div>
          <button type="button" onClick={() => setSigned(!signed)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${signed ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-[#1e1e24] text-slate-500 dark:text-[#71717a] hover:border-slate-300'}`}>
            Assinar digitalmente
          </button>
          <button type="button" onClick={() => setShowDate(!showDate)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${showDate ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-[#1e1e24] text-slate-500 dark:text-[#71717a] hover:border-slate-300'}`}>
            Mostrar data
          </button>
          {showDate && (
            <div>
              <label className={labelCls}>Data</label>
              <input type="date" value={fillDate} onChange={e => setFillDate(e.target.value)} className={inputCls} />
            </div>
          )}
        </div>

        {/* ── Formulário de Preenchimento (quando tem perguntas do modelo) ── */}
        {questions.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Questionário ({questions.length} pergunta{questions.length !== 1 ? 's' : ''})</label>
              <button type="button" onClick={() => setQuestions([])} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                Limpar questionário
              </button>
            </div>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={q.id} className={`${cardCls} p-4 space-y-2`}>
                  <p className="text-sm font-medium text-slate-700 dark:text-[#e4e4e7]">
                    <span className="text-blue-500 font-bold mr-1.5">{i + 1}.</span>
                    {q.text}
                    {q.type !== 'text' && <span className="text-[10px] text-slate-400 dark:text-[#52525b] ml-2">({QUESTION_TYPES.find(t => t.value === q.type)?.label})</span>}
                  </p>

                  {/* Texto */}
                  {q.type === 'text' && (
                    <textarea
                      value={(q.answer as string) || ''}
                      onChange={e => {
                        const updated = [...questions];
                        updated[i] = { ...q, answer: e.target.value };
                        setQuestions(updated);
                      }}
                      placeholder="Resposta..."
                      rows={2}
                      className={`${inputCls} resize-none`}
                    />
                  )}

                  {/* Múltipla escolha (radio) */}
                  {q.type === 'multiple_choice' && q.options && (
                    <div className="space-y-1.5 pl-2">
                      {q.options.map((opt, j) => (
                        <label key={j} className="flex items-center gap-2.5 py-1 cursor-pointer">
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={(q.answer as string) === opt}
                            onChange={() => {
                              const updated = [...questions];
                              updated[i] = { ...q, answer: opt };
                              setQuestions(updated);
                            }}
                            className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-600 dark:text-[#d4d4d8]">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Caixa de seleção (checkbox) */}
                  {q.type === 'checkbox' && q.options && (
                    <div className="space-y-1.5 pl-2">
                      {q.options.map((opt, j) => {
                        const selectedArr = Array.isArray(q.answer) ? q.answer : [];
                        return (
                          <label key={j} className="flex items-center gap-2.5 py-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedArr.includes(opt)}
                              onChange={e => {
                                const updated = [...questions];
                                const prev = Array.isArray(q.answer) ? [...q.answer] : [];
                                updated[i] = { ...q, answer: e.target.checked ? [...prev, opt] : prev.filter(v => v !== opt) };
                                setQuestions(updated);
                              }}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-600 dark:text-[#d4d4d8]">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Calculadora gestacional */}
                  {q.type === 'gestational_calculator' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        value={(q.answer as string) || ''}
                        onChange={e => {
                          const updated = [...questions];
                          updated[i] = { ...q, answer: e.target.value };
                          setQuestions(updated);
                        }}
                        className={inputCls}
                      />
                      {q.answer && (
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {(() => {
                            const dum = new Date((q.answer as string) + 'T00:00:00');
                            const diffMs = Date.now() - dum.getTime();
                            if (diffMs < 0) return 'Data futura — verifique a DUM';
                            const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
                            const days = Math.floor((diffMs % (7 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
                            return `${weeks} semanas e ${days} dias`;
                          })()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Conteúdo adicional (observações livres) */}
            <div>
              <label className={labelCls}>Observações adicionais</label>
              <RichTextEditor value={content} onChange={setContent} placeholder="Observações do profissional..." className="min-h-[150px]" />
            </div>
          </div>
        ) : (
          /* ── Modo livre (sem modelo selecionado) ── */
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 min-w-0">
                <label className={labelCls}>Conteúdo</label>
                <RichTextEditor value={content} onChange={setContent} placeholder="Digite o conteúdo da anamnese..." className="min-h-[300px]" />
              </div>
              {templates.length > 0 && (
                <div className="w-56 shrink-0">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-[#52525b] uppercase tracking-wide mb-2">Modelos de Anamnese</p>
                  <div className={`${cardCls} max-h-[340px] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-[#1a1a1f]`}>
                    {templates.map(t => (
                      <button key={t.id} type="button" onClick={() => handleSelectTemplate(t)}
                        className="w-full text-left px-3 py-2.5 text-xs text-slate-600 dark:text-[#a1a1aa] hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer">
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Builder para criar perguntas do zero */}
            <QuestionBuilder questions={questions} onChange={setQuestions} />
          </div>
        )}

        {/* 5. CID */}
        <CidSearch selected={cidCodes} onChange={setCidCodes} />

        {/* 6. Restrições */}
        <div>
          <label className={labelCls}>Restrições</label>
          <div className={`${cardCls} p-4 space-y-3`}>
            <label className="flex items-center gap-3 cursor-pointer">
              <button type="button" onClick={() => setBlocked(!blocked)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${blocked ? 'bg-red-500' : 'bg-slate-300 dark:bg-[#3f3f46]'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${blocked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </button>
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-[#e4e4e7] flex items-center gap-1.5"><Lock size={14} /> Bloquear anamnese</span>
                {blocked && <p className="text-[10px] text-slate-400 dark:text-[#52525b] mt-0.5">Selecione os profissionais que terão acesso</p>}
              </div>
            </label>
            {blocked && professionals.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 pl-4 pt-2 border-t border-slate-100 dark:border-[#1a1a1f]">
                {professionals.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#a1a1aa] cursor-pointer py-1">
                    <input type="checkbox" checked={allowedProfessionals.includes(p.id)}
                      onChange={e => setAllowedProfessionals(e.target.checked ? [...allowedProfessionals, p.id] : allowedProfessionals.filter(id => id !== p.id))}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 7. Opções */}
        <div>
          <label className={labelCls}>Opções</label>
          <div className="flex flex-wrap gap-4">
            {[
              { checked: saveAsTemplate, onChange: setSaveAsTemplate, label: 'Salvar como modelo', disabled: false },
              { checked: false, onChange: () => {}, label: 'Enviar para paciente (em breve)', disabled: true },
              { checked: printOnSave, onChange: setPrintOnSave, label: 'Salvar e imprimir', disabled: false },
            ].map(opt => (
              <label key={opt.label} className={`flex items-center gap-2 text-xs ${opt.disabled ? 'text-slate-400 dark:text-[#52525b] cursor-not-allowed' : 'text-slate-600 dark:text-[#a1a1aa] cursor-pointer'}`}>
                <input type="checkbox" checked={opt.checked} onChange={e => opt.onChange(e.target.checked)} disabled={opt.disabled}
                  className={`w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}`} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* 8. Upload de anexos */}
        <div>
          <label className={labelCls}>Anexos</label>
          <div className={`${cardCls} p-6 border-dashed flex flex-col items-center justify-center gap-2`}>
            <Upload className="w-8 h-8 text-slate-300 dark:text-[#3f3f46]" />
            <p className="text-xs text-slate-400 dark:text-[#52525b]">Arraste arquivos aqui ou <span className="text-blue-600 dark:text-blue-400 font-medium cursor-pointer">procure</span></p>
            <p className="text-[10px] text-slate-400 dark:text-[#3f3f46]">jpg, png, pdf, doc, xls, txt, zip</p>
          </div>
        </div>

        {/* 9. Ações */}
        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            SALVAR INFORMAÇÕES
          </button>
          <button onClick={handleBack} className="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-[#71717a] bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.06] transition-colors cursor-pointer">
            CANCELAR
          </button>
        </div>
      </div>
    );
  }

  // ── List Mode ──
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 dark:text-[#e4e4e7]">Anamneses</h2>
        <button onClick={handleCreate}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer">
          <Plus size={14} /> ADICIONAR ANAMNESE
        </button>
      </div>

      {anamneses.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-slate-200 dark:text-[#2d2d36] mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-[#52525b]">Nenhuma anamnese registrada.</p>
        </div>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-[#0c0c0e] border-b border-slate-200/80 dark:border-[#1e1e24]">
                <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 dark:text-[#52525b] uppercase">Data</th>
                <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 dark:text-[#52525b] uppercase">Título</th>
                <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 dark:text-[#52525b] uppercase">Profissional</th>
                <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 dark:text-[#52525b] uppercase text-right">Opções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1f]">
              {anamneses.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => handleView(a)}>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-[#71717a]">{a.fill_date ? new Date(a.fill_date + 'T12:00:00').toLocaleDateString('pt-BR') : new Date(a.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-[#e4e4e7]">{a.title || 'Sem título'}</span>
                    {a.blocked && <span className="ml-2 inline-flex items-center gap-0.5 text-[9px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-semibold"><Lock size={9} /> BLOQUEADO</span>}
                    {a.signed && <span className="ml-2 text-[9px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-semibold">ASSINADO</span>}
                    {!a.content && (!a.questions || a.questions.length === 0) && !a.signed && <span className="ml-2 text-[9px] bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold">RASCUNHO</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-[#71717a]">{a.doctor_id ? (doctors[a.doctor_id] || '—') : '—'}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleView(a)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"><Eye size={14} /></button>
                      <button onClick={() => handleEdit(a)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"><Pencil size={14} /></button>
                      <button onClick={() => handlePrint(a)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"><Printer size={14} /></button>
                      <button onClick={() => setConfirmDeleteId(a.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal isOpen={confirmDeleteId !== null} onClose={() => setConfirmDeleteId(null)} onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); }}
        title="Excluir anamnese" message="Tem certeza que deseja excluir esta anamnese?" confirmText="Excluir" type="danger" />
    </div>
  );
}
