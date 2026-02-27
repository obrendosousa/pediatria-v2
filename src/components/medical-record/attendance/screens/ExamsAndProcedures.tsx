'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, Search, Printer, Save, X, FileText, ChevronDown } from 'lucide-react';
import { useExamRequests, searchTuss, ExamItem, ExamRequest } from '@/hooks/useExamRequests';
import { AttendanceScreenProps } from '@/types/attendance';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ModelTemplateModal } from '../ModelTemplateModal';

// ─── Tipos internos ───────────────────────────────────────────────────────────
interface TussResult { id: number; code: string; name: string; category: string }
interface DraftRequest {
  id?: number;
  include_date: boolean;
  request_date: string;
  request_type: 'SADT' | 'PARTICULAR';
  clinical_indication: string;
  exams: ExamItem[];
}

const emptyDraft = (): DraftRequest => ({
  include_date: true,
  request_date: format(new Date(), 'yyyy-MM-dd'),
  request_type: 'PARTICULAR',
  clinical_indication: '',
  exams: [{ code: '', name: '', quantity: 1 }],
});

// ─── Componente de busca de exame (uma linha) ─────────────────────────────────
function ExamRow({
  exam,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  exam: ExamItem;
  index: number;
  onUpdate: (i: number, exam: ExamItem) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
}) {
  const [query, setQuery] = useState(exam.name || exam.code || '');
  const [results, setResults] = useState<TussResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleQueryChange = (v: string) => {
    setQuery(v);
    onUpdate(index, { ...exam, name: v, code: '' });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (v.length < 2) { setResults([]); setOpen(false); return; }
      setSearching(true);
      const r = await searchTuss(v);
      setResults(r);
      setOpen(r.length > 0);
      setSearching(false);
    }, 300);
  };

  const handleSelect = (item: TussResult) => {
    const label = `${item.code} — ${item.name}`;
    setQuery(label);
    onUpdate(index, { ...exam, code: item.code, name: item.name });
    setOpen(false);
  };

  return (
    <div className="flex items-start gap-2">
      {/* Campo de busca */}
      <div ref={wrapRef} className="relative flex-1">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Digite o nome ou código do exame..."
            className="w-full pl-3 pr-9 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {/* Dropdown de resultados */}
        {open && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={() => handleSelect(item)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-100 dark:border-gray-700/50 last:border-0"
              >
                <span className="font-mono text-xs text-blue-600 dark:text-blue-400 mr-2">{item.code}</span>
                <span className="text-slate-700 dark:text-gray-200">{item.name}</span>
                {item.category && (
                  <span className="ml-1 text-xs text-slate-400">({item.category})</span>
                )}
              </button>
            ))}
          </div>
        )}
        {searching && (
          <div className="absolute right-9 top-2.5">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Quantidade */}
      <input
        type="number"
        min={1}
        value={exam.quantity}
        onChange={(e) => onUpdate(index, { ...exam, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
        className="w-16 px-2 py-2 text-sm text-center border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      />

      {/* Deletar linha */}
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Card de solicitação ──────────────────────────────────────────────────────
function RequestCard({
  draft,
  onUpdate,
  onDelete,
  onSave,
  onPrint,
  onOpenModelManager,
  isSaving,
  isNew,
}: {
  draft: DraftRequest;
  onUpdate: (d: DraftRequest) => void;
  onDelete: () => void;
  onSave: () => void;
  onPrint: () => void;
  onOpenModelManager: (action: 'load' | 'save', content?: string) => void;
  isSaving: boolean;
  isNew: boolean;
}) {
  const updateExam = (i: number, exam: ExamItem) =>
    onUpdate({ ...draft, exams: draft.exams.map((e, idx) => (idx === i ? exam : e)) });

  const removeExam = (i: number) =>
    onUpdate({ ...draft, exams: draft.exams.filter((_, idx) => idx !== i) });

  const addExam = () =>
    onUpdate({ ...draft, exams: [...draft.exams, { code: '', name: '', quantity: 1 }] });

  return (
    <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-4">
      {/* Cabeçalho do card */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Toggle incluir data */}
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            type="button"
            onClick={() => onUpdate({ ...draft, include_date: !draft.include_date })}
            className={`relative w-10 h-5 rounded-full transition-colors ${draft.include_date ? 'bg-orange-400' : 'bg-slate-300 dark:bg-gray-600'
              }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${draft.include_date ? 'translate-x-5' : 'translate-x-0'
              }`} />
          </button>
          <span className="text-xs text-slate-600 dark:text-gray-400">Incluir data</span>
        </label>

        {/* Data */}
        {draft.include_date && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase font-medium">DATA</span>
            <input
              type="date"
              value={draft.request_date}
              onChange={(e) => onUpdate({ ...draft, request_date: e.target.value })}
              className="px-2 py-1 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        )}

        {/* Botões de modelo */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenModelManager('load')}
            className="px-3 py-1 text-xs font-semibold rounded bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
          >
            USAR MODELO
          </button>
          <button
            type="button"
            onClick={() => onOpenModelManager('save', JSON.stringify(draft.exams))}
            className="px-3 py-1 text-xs font-semibold rounded bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
          >
            SALVAR COMO MODELO
          </button>
        </div>

        {/* SADT / PARTICULAR */}
        <div className="flex gap-1 ml-auto">
          {(['SADT', 'PARTICULAR'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onUpdate({ ...draft, request_type: t })}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${draft.request_type === t
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600'
                }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Indicação clínica */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 uppercase">
          Indicação clínica (opcional)
        </label>
        <input
          type="text"
          value={draft.clinical_indication}
          onChange={(e) => onUpdate({ ...draft, clinical_indication: e.target.value })}
          placeholder="aqui eu colocar esse texto"
          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      {/* Lista de exames */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Exames</label>
          <span className="text-xs text-slate-400 dark:text-gray-500">Quantidade</span>
        </div>
        <div className="space-y-2">
          {draft.exams.map((exam, i) => (
            <ExamRow
              key={i}
              exam={exam}
              index={i}
              onUpdate={updateExam}
              onRemove={removeExam}
              canRemove={draft.exams.length > 1}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addExam}
          className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar página
        </button>
      </div>

      {/* Ações do card */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-gray-700/50">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-md hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            IMPRIMIR
          </button>
          <button
            type="button"
            onClick={() => onOpenModelManager('save', JSON.stringify(draft.exams))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-md hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            SALVAR COMO MODELO
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            EXCLUIR PEDIDO
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Geração de PDF via janela de impressão ───────────────────────────────────
export function printRequest(draft: any, patientData: any) {
  const examsRows = draft.exams
    .filter((e: any) => e.name || e.code)
    .map(
      (e: any) => `
        <tr>
          <td>${e.code ? `${e.code} - ` : ''}${e.name}</td>
          <td>${e.quantity}</td>
        </tr>`
    )
    .join('');

  const dateStr = draft.include_date
    ? format(new Date(draft.request_date + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : '';

  const patientName = patientData?.name || patientData?.contact_name || '—';
  const patientCpf = patientData?.cpf || patientData?.document || '';

  // ==============================================================================
  // RENDERIZAÇÃO CONDICIONAL POR TIPO DE GUIA
  // ==============================================================================
  let html = '';

  if (draft.request_type === 'SADT') {
    // ─── GUIA SP/SADT OFICIAL (TISS) ──────────────────────────────────────────
    const sadtExamsRows = draft.exams
      .filter((e: any) => e.name || e.code)
      .map(
        (e: any) => `
          <tr class="tiss-tr">
            <td class="tiss-td-center">22</td>
            <td class="tiss-td-center">${e.code}</td>
            <td class="tiss-td-left">${e.name}</td>
            <td class="tiss-td-center">${e.quantity}</td>
            <td class="tiss-td-center"></td>
          </tr>`
      )
      .join('');

    html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Guia SADT</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
    body { padding: 20px; font-size: 10px; }
    .tiss-header { text-align: center; font-weight: bold; font-size: 13px; margin-bottom: 10px; line-height: 1.2; }
    .tiss-numero-guia { text-align: right; font-size: 9px; margin-bottom: 2px; }
    .tiss-section-title { font-size: 9px; font-weight: bold; background-color: #e5e7eb; padding: 2px 4px; border: 1px solid #000; border-bottom: none; margin-top: -1px; }
    .tiss-row { display: flex; width: 100%; border-right: 1px solid #000; }
    .tiss-field { border: 1px solid #000; padding: 2px; font-size: 9px; flex-grow: 1; margin-left: -1px; margin-top: -1px; display: flex; flex-direction: column; overflow: hidden; white-space: nowrap; min-width: 0; }
    .tiss-field-label { font-size: 7px; margin-bottom: 2px; line-height: 1; color: #333; }
    .tiss-field-value { font-size: 10px; min-height: 12px; font-weight: bold; }
    .tiss-field-squares { font-family: monospace; letter-spacing: 0px; font-weight: normal; color: #666; font-size: 9px; }
    
    .tiss-table-wrapper { border: 1px solid #000; margin-top: -1px; width: 100%; border-collapse: collapse; table-layout: fixed; }
    .tiss-table-wrapper th, .tiss-table-wrapper td { border: 1px solid #000; padding: 2px; overflow: hidden; }
    .tiss-table-wrapper th { font-size: 7px; font-weight: bold; text-align: left; background-color: #e5e7eb; }
    .tiss-table-wrapper td { font-size: 9px; font-weight: bold; white-space: nowrap; }
    
    .tiss-tr { height: 16px; }
    .tiss-td-center { text-align: center; }
    .tiss-td-left { text-align: left; }
    
    .dark-header { background-color: #d1d5db; }

    @page { size: A4 landscape; margin: 8mm; }
    @media print { body { padding: 0; transform: scale(0.98); transform-origin: top left; } }
  </style>
</head>
<body>
  <div class="tiss-header">
    GUIA DE SERVIÇO PROFISSIONAL / SERVIÇO AUXILIAR DE<br/>
    DIAGNÓSTICO E TERAPIA-SP/SADT
  </div>
  <div class="tiss-numero-guia">2-Nº Guia no Prestador:</div>

  <div class="tiss-row">
    <div class="tiss-field" style="width: 25%; flex: none;">
      <span class="tiss-field-label">1-Registro ANS</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|</span>
    </div>
    <div class="tiss-field" style="width: 75%; flex: none;">
      <span class="tiss-field-label">3-Número da Guia Principal</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|</span>
    </div>
  </div>

  <div class="tiss-row">
    <div class="tiss-field" style="width: 25%; flex: none;">
      <span class="tiss-field-label">4-Data da Autorização</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span>
    </div>
    <div class="tiss-field" style="width: 35%; flex: none;">
      <span class="tiss-field-label">5-Senha</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|</span>
    </div>
    <div class="tiss-field" style="width: 20%; flex: none;">
      <span class="tiss-field-label">6-Data de Validade da Senha</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span>
    </div>
    <div class="tiss-field" style="width: 20%; flex: none;">
      <span class="tiss-field-label">7-Número da Guia Atribuído pela Operadora</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|_|_|_|_|_|_|_|_|</span>
    </div>
  </div>

  <div class="tiss-section-title dark-header">Dados do Beneficiário</div>
  <div class="tiss-row">
    <div class="tiss-field" style="width: 35%; flex: none;">
      <span class="tiss-field-label">8-Número da Carteira</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|</span>
    </div>
    <div class="tiss-field" style="width: 15%; flex: none;">
      <span class="tiss-field-label">9-Validade da Carteira</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span>
    </div>
    <div class="tiss-field" style="width: 50%; flex: none;">
      <span class="tiss-field-label">10-Nome</span>
      <span class="tiss-field-value">${patientName}</span>
    </div>
  </div>
  <div class="tiss-row">
    <div class="tiss-field" style="width: 80%; flex: none;">
      <span class="tiss-field-label">11-Cartão Nacional de Saúde</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|</span>
    </div>
    <div class="tiss-field" style="width: 20%; flex: none;">
      <span class="tiss-field-label">12-Atendimento ao RN</span>
      <span class="tiss-field-value tiss-field-squares">|_| (S/N)</span>
    </div>
  </div>

  <div class="tiss-section-title dark-header">Dados do Solicitante</div>
  <div class="tiss-row">
    <div class="tiss-field" style="width: 25%; flex: none;">
      <span class="tiss-field-label">13-Código na Operadora</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|_|_|_|_|_|_|_|</span>
    </div>
    <div class="tiss-field" style="width: 75%; flex: none;">
      <span class="tiss-field-label">14-Nome do Contratado</span>
      <span class="tiss-field-value"></span>
    </div>
  </div>

  <div class="tiss-row">
    <div class="tiss-field" style="width: 35%; flex: none;">
      <span class="tiss-field-label">15-Nome do Profissional Solicitante</span>
      <span class="tiss-field-value">Dra. Fernanda Santana</span>
    </div>
    <div class="tiss-field" style="width: 15%; flex: none;">
      <span class="tiss-field-label">16-Conselho Profissional</span>
      <span class="tiss-field-value">CRM</span>
    </div>
    <div class="tiss-field" style="width: 15%; flex: none;">
      <span class="tiss-field-label">17-Número no Conselho</span>
      <span class="tiss-field-value">9223</span>
    </div>
    <div class="tiss-field" style="width: 5%; flex: none;">
      <span class="tiss-field-label">18-UF</span>
      <span class="tiss-field-value">MA</span>
    </div>
    <div class="tiss-field" style="width: 10%; flex: none;">
      <span class="tiss-field-label">19-Código CBO</span>
      <span class="tiss-field-value">225125</span>
    </div>
    <div class="tiss-field" style="width: 20%; flex: none;">
      <span class="tiss-field-label">20-Assinatura do Profissional Solicitante</span>
      <span class="tiss-field-value"></span>
    </div>
  </div>

  <div class="tiss-section-title dark-header">Dados da Solicitação / Procedimentos ou Itens Assistenciais Solicitados</div>
  <div class="tiss-row">
    <div class="tiss-field" style="width: 20%; flex: none;">
      <span class="tiss-field-label">21-Caráter do Atendimento</span>
      <span class="tiss-field-value">|_| E - Eletiva / U - Urgência</span>
    </div>
    <div class="tiss-field" style="width: 15%; flex: none;">
      <span class="tiss-field-label">22-Data da Solicitação</span>
      <span class="tiss-field-value">${draft.include_date && draft.request_date ? format(new Date(draft.request_date + 'T12:00:00'), 'dd/MM/yyyy') : ''}</span>
    </div>
    <div class="tiss-field" style="width: 65%; flex: none;">
      <span class="tiss-field-label">23-Indicação Clínica</span>
      <span class="tiss-field-value">${draft.clinical_indication || ''}</span>
    </div>
  </div>

  <table class="tiss-table-wrapper">
    <thead>
      <tr>
        <th style="width: 50px;">24-Tabela</th>
        <th style="width: 100px;">25-Código do Procedimento</th>
        <th>26-Descrição</th>
        <th style="width: 80px;">27-Qtde. Solic.</th>
        <th style="width: 80px;">28-Qtde. Aut.</th>
      </tr>
    </thead>
    <tbody>
      ${sadtExamsRows || '<tr class="tiss-tr"><td colspan="5" class="tiss-td-center">Nenhum exame adicionado</td></tr>'}
      <tr class="tiss-tr"><td></td><td></td><td></td><td></td><td></td></tr>
      <tr class="tiss-tr"><td></td><td></td><td></td><td></td><td></td></tr>
      <tr class="tiss-tr"><td></td><td></td><td></td><td></td><td></td></tr>
      <tr class="tiss-tr"><td></td><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>

  <div class="tiss-section-title dark-header">Dado do Contratado Executante</div>
  <div class="tiss-row">
    <div class="tiss-field" style="width: 25%; flex: none;">
      <span class="tiss-field-label">29-Código na Operadora</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|_|_|_|_|_|_|_|</span>
    </div>
    <div class="tiss-field" style="width: 60%; flex: none;">
      <span class="tiss-field-label">30-Nome do Contratado</span>
      <span class="tiss-field-value">Centro Medico Aliança</span>
    </div>
    <div class="tiss-field" style="width: 15%; flex: none;">
      <span class="tiss-field-label">31-Código CNES</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|_|</span>
    </div>
  </div>

  <div class="tiss-section-title dark-header">Dados do Atendimento</div>
  <div class="tiss-row">
    <div class="tiss-field" style="width: 20%; flex: none;">
      <span class="tiss-field-label">32-Tipo de Atendimento</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|</span>
    </div>
    <div class="tiss-field" style="width: 40%; flex: none;">
      <span class="tiss-field-label">33-Indicação de Acidente (acidente ou doença relacionada)</span>
      <span class="tiss-field-value tiss-field-squares">|_|</span>
    </div>
    <div class="tiss-field" style="width: 20%; flex: none;">
      <span class="tiss-field-label">34-Tipo de Consulta</span>
      <span class="tiss-field-value tiss-field-squares">|_|</span>
    </div>
    <div class="tiss-field" style="width: 20%; flex: none;">
      <span class="tiss-field-label">35-Motivo de Encerramento do Atendimento</span>
      <span class="tiss-field-value tiss-field-squares">|_|_|</span>
    </div>
  </div>
  
  <div class="tiss-section-title dark-header">Dados da Execução / Procedimentos e Exames Realizados</div>
  <table class="tiss-table-wrapper">
    <thead>
      <tr>
        <th style="width: 80px;">36-Data</th>
        <th style="width: 60px;">37-Hora Inicial</th>
        <th style="width: 60px;">38-Hora Final</th>
        <th style="width: 50px;">39-Tabela</th>
        <th style="width: 90px;">40-Código do Procedimento</th>
        <th>41-Descrição</th>
        <th style="width: 40px;">42-Qtde.</th>
        <th style="width: 40px;">43-Via</th>
        <th style="width: 40px;">44-Tec.</th>
        <th style="width: 80px;">45-Fator Red./Acresc.</th>
        <th style="width: 80px;">46-Valor Unitário (R$)</th>
        <th style="width: 80px;">47-Valor Total (R$)</th>
      </tr>
    </thead>
    <tbody>
      <tr class="tiss-tr"><td><span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></td><td><span class="tiss-field-squares">|_|_|:|_|_|</span></td><td><span class="tiss-field-squares">|_|_|:|_|_|</span></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr class="tiss-tr"><td><span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></td><td><span class="tiss-field-squares">|_|_|:|_|_|</span></td><td><span class="tiss-field-squares">|_|_|:|_|_|</span></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr class="tiss-tr"><td><span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></td><td><span class="tiss-field-squares">|_|_|:|_|_|</span></td><td><span class="tiss-field-squares">|_|_|:|_|_|</span></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr class="tiss-tr"><td><span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></td><td><span class="tiss-field-squares">|_|_|:|_|_|</span></td><td><span class="tiss-field-squares">|_|_|:|_|_|</span></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr class="tiss-tr"><td><span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></td><td><span class="tiss-field-squares">|_|_|:|_|_|</span></td><td><span class="tiss-field-squares">|_|_|:|_|_|</span></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>

  <div class="tiss-section-title dark-header">Identificação do(s) Profissional(is) Executante(s)</div>
  <table class="tiss-table-wrapper">
    <thead>
      <tr>
        <th style="width: 60px;">48-Seq. Ref</th>
        <th style="width: 70px;">49-Grau Part.</th>
        <th style="width: 150px;">50-Código na Operadora/CPF</th>
        <th>51-Nome do Profissional</th>
        <th style="width: 120px;">52-Conselho Profissional</th>
        <th style="width: 120px;">53-Número no Conselho</th>
        <th style="width: 40px;">54-UF</th>
        <th style="width: 90px;">55-Código CBO</th>
      </tr>
    </thead>
    <tbody>
      <tr class="tiss-tr"><td><span class="tiss-field-squares">|_|_|</span></td><td><span class="tiss-field-squares">|_|_|</span></td><td><span class="tiss-field-squares">|_|_|_|_|_|_|_|_|_|_|_|</span></td><td></td><td><span class="tiss-field-squares">|_|_|</span></td><td></td><td><span class="tiss-field-squares">|_|_|</span></td><td><span class="tiss-field-squares">|_|_|_|_|_|_|</span></td></tr>
      <tr class="tiss-tr"><td><span class="tiss-field-squares">|_|_|</span></td><td><span class="tiss-field-squares">|_|_|</span></td><td><span class="tiss-field-squares">|_|_|_|_|_|_|_|_|_|_|_|</span></td><td></td><td><span class="tiss-field-squares">|_|_|</span></td><td></td><td><span class="tiss-field-squares">|_|_|</span></td><td><span class="tiss-field-squares">|_|_|_|_|_|_|</span></td></tr>
      <tr class="tiss-tr"><td><span class="tiss-field-squares">|_|_|</span></td><td><span class="tiss-field-squares">|_|_|</span></td><td><span class="tiss-field-squares">|_|_|_|_|_|_|_|_|_|_|_|</span></td><td></td><td><span class="tiss-field-squares">|_|_|</span></td><td></td><td><span class="tiss-field-squares">|_|_|</span></td><td><span class="tiss-field-squares">|_|_|_|_|_|_|</span></td></tr>
    </tbody>
  </table>

  <div class="tiss-row">
    <div class="tiss-field" style="width: 50%; padding: 0;">
      <div class="tiss-section-title dark-header" style="border: none; border-bottom: 1px solid #000; margin: 0;">56-Data de Realização de Procedimentos em Série</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px;">
        <div style="font-size: 10px;">1-<span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></div>
        <div style="font-size: 10px;">6-<span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></div>
        <div style="font-size: 10px;">2-<span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></div>
        <div style="font-size: 10px;">7-<span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></div>
        <div style="font-size: 10px;">3-<span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></div>
        <div style="font-size: 10px;">8-<span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></div>
        <div style="font-size: 10px;">4-<span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></div>
        <div style="font-size: 10px;">9-<span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></div>
        <div style="font-size: 10px;">5-<span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|_|</span></div>
        <div style="font-size: 10px;">10-<span class="tiss-field-squares">|_|_|/|_|_|/|_|_|_|</span></div>
      </div>
    </div>
    <div class="tiss-field" style="width: 50%; padding: 0;">
      <div class="tiss-section-title dark-header" style="border: none; border-bottom: 1px solid #000; margin: 0;">57-Assinatura do Beneficiário ou Responsável</div>
      <div style="flex-grow: 1;"></div>
    </div>
  </div>

  <div class="tiss-section-title dark-header">58-Observação / Justificativa</div>
  <div class="tiss-row">
    <div class="tiss-field" style="width: 100%; height: 30px;"></div>
  </div>

  <div class="tiss-row">
    <div class="tiss-field" style="width: 14%;"><span class="tiss-field-label">59-Total de Procedimentos (R$)</span><span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|</span></div>
    <div class="tiss-field" style="width: 14%;"><span class="tiss-field-label">60-Total de Taxas e Aluguéis (R$)</span><span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|</span></div>
    <div class="tiss-field" style="width: 15%;"><span class="tiss-field-label">61-Total de Materiais (R$)</span><span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|</span></div>
    <div class="tiss-field" style="width: 14%;"><span class="tiss-field-label">62-Total de OPME (R$)</span><span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|</span></div>
    <div class="tiss-field" style="width: 15%;"><span class="tiss-field-label">63-Total de Medicamentos (R$)</span><span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|</span></div>
    <div class="tiss-field" style="width: 14%;"><span class="tiss-field-label">64-Total de Gases Medicinais (R$)</span><span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|</span></div>
    <div class="tiss-field" style="width: 14%;"><span class="tiss-field-label">65-Total Geral (R$)</span><span class="tiss-field-value tiss-field-squares">|_|_|_|_|_|_|</span></div>
  </div>

  <div class="tiss-row">
    <div class="tiss-field" style="width: 33%; height: 40px;"><span class="tiss-field-label">66-Assinatura do Responsável pela Autorização</span></div>
    <div class="tiss-field" style="width: 34%; height: 40px;"><span class="tiss-field-label">67-Assinatura do Beneficiário ou Responsável</span></div>
    <div class="tiss-field" style="width: 33%; height: 40px;"><span class="tiss-field-label">68-Assinatura do Contratado</span></div>
  </div>
</body>
</html>`;

  } else {
    // ─── RECEITUÁRIO PARTICULAR MINIMALISTA (PADRÃO) ────────────────────────
    html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Solicitação de Exames</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #000; background: #fff; padding: 40px; font-size: 13px; line-height: 1.5; display: flex; flex-direction: column; min-height: 100vh; }
    .header { margin-bottom: 24px; border-bottom: 1px solid #000; padding-bottom: 16px; }
    .clinic-name { font-size: 14px; font-weight: bold; }
    .clinic-phones { font-size: 13px; }
    
    .patient-info { margin-bottom: 24px; }
    .patient-name { font-weight: bold; }
    
    table.exams { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    table.exams th, table.exams td { padding: 6px 8px; border: 1px solid #d1d5db; font-size: 13px; text-align: left; }
    table.exams th { font-weight: bold; }
    table.exams th:last-child, table.exams td:last-child { text-align: center; width: 100px; }
    
    .footer { margin-top: auto; padding-top: 32px; }
    .footer-content { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px; }
    .doctor-info { text-align: right; font-size: 11px; }
    .doctor-name { font-weight: normal; }
    .date-info { font-size: 11px; }
    .footer-credit { text-align: center; font-size: 10px; color: #000; }
    
    @media print { 
      body { padding: 20px; } 
      .footer { position: fixed; bottom: 20px; left: 20px; right: 20px; padding-top: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="clinic-name">Karla Fernanda</div>
    <div class="clinic-phones">Telefones: (99) 98429-2254</div>
  </div>

  <div class="patient-info">
    <div class="patient-name">Paciente ${patientName}</div>
    ${patientCpf ? `<div>CPF: ${patientCpf}</div>` : '<div>CPF: </div>'}
    ${draft.clinical_indication ? `<div>Indicação clínica: ${draft.clinical_indication}</div>` : ''}
  </div>

  <table class="exams">
    <thead>
      <tr>
        <th>Exames/Procedimentos</th>
        <th>Quantidade</th>
      </tr>
    </thead>
    <tbody>
      ${examsRows || '<tr><td colspan="2" style="text-align:center;">Nenhum exame adicionado</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <div class="footer-content">
      <div class="date-info">${dateStr}</div>
      <div class="doctor-info">
        <div class="doctor-name">Dra. Fernanda Santana</div>
        <div>CRM: 9223 - MA</div>
        <div>Rua Senador Vitorino Freire , 130 - Lago da Pedra</div>
      </div>
    </div>
    <div class="footer-credit">Documento gerado por Centro Medico Aliança - Sistema para gestão de clinicas e consultórios</div>
  </div>
</body>
</html>`;
  }

  // Create an invisible iframe to print
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }

  // Wait for content to render, then print and remove
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Remove the iframe after the print dialog is closed or after a delay
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 400);
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ExamsAndProcedures({ patientId, patientData, appointmentId, medicalRecordId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { requests, isLoading, isSaving, createRequest, updateRequest, deleteRequest } =
    useExamRequests(patientId, medicalRecordId);

  // Rascunhos locais (novos ainda não salvos + edições de existentes)
  const [drafts, setDrafts] = useState<Map<string, DraftRequest>>(new Map());
  const [newDrafts, setNewDrafts] = useState<{ id: string; draft: DraftRequest }[]>([
    { id: 'initial-draft', draft: emptyDraft() },
  ]);
  const [savedFeedback, setSavedFeedback] = useState<Set<string>>(new Set());

  // Estado do Modal de Modelos
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelTargetDraftId, setModelTargetDraftId] = useState<string | number | null>(null);
  const [currentModelContent, setCurrentModelContent] = useState<string>('');

  const currentDate = format(new Date(), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });

  // Inicializa rascunhos a partir dos requests carregados
  useEffect(() => {
    const m = new Map<string, DraftRequest>();
    requests.forEach((r) => {
      if (r.id) m.set(String(r.id), { ...r });
    });
    setDrafts(m);
  }, [requests]);

  const getDraft = (id: number) => drafts.get(String(id)) ?? requests.find((r) => r.id === id) ?? emptyDraft();

  const setDraft = (id: number, d: DraftRequest) =>
    setDrafts((prev) => new Map(prev).set(String(id), d));

  const flashSaved = (key: string) => {
    setSavedFeedback((prev) => new Set(prev).add(key));
    setTimeout(() => setSavedFeedback((prev) => { const s = new Set(prev); s.delete(key); return s; }), 3000);
  };

  // Salva nova solicitação
  const handleSaveNew = async (itemId: string) => {
    const item = newDrafts.find((n) => n.id === itemId);
    if (!item) return;

    const hasExams = item.draft.exams.some((e) => e.name || e.code);
    if (!hasExams) {
      toast.toast.error('Adicione pelo menos um exame antes de salvar.');
      return;
    }
    try {
      await createRequest({ ...item.draft, patient_id: patientId });
      setNewDrafts((prev) => prev.filter((n) => n.id !== itemId));
      toast.toast.success('Solicitação salva com sucesso!');
    } catch {
      toast.toast.error('Erro ao salvar solicitação.');
    }
  };

  // Salva solicitação existente
  const handleSaveExisting = async (id: number) => {
    const d = getDraft(id);
    try {
      await updateRequest(id, d);
      flashSaved(String(id));
    } catch {
      toast.toast.error('Erro ao salvar.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Confirmar exclusão desta solicitação?')) return;
    try {
      await deleteRequest(id);
    } catch {
      toast.toast.error('Erro ao excluir.');
    }
  };

  const handleOpenModelManager = (id: string | number, action: 'load' | 'save', content?: string) => {
    setModelTargetDraftId(id);
    if (action === 'save' && content) {
      setCurrentModelContent(content);
    } else {
      setCurrentModelContent('');
    }
    setModelModalOpen(true);
  };

  const handleModelSelect = (content: string) => {
    if (!modelTargetDraftId) return;
    try {
      const parsedExams = JSON.parse(content);
      if (Array.isArray(parsedExams)) {
        if (typeof modelTargetDraftId === 'string') {
          setNewDrafts((prev) =>
            prev.map((p) =>
              p.id === modelTargetDraftId ? { ...p, draft: { ...p.draft, exams: parsedExams } } : p
            )
          );
        } else {
          const id = modelTargetDraftId as number;
          const currentDraft = getDraft(id);
          setDraft(id, { ...currentDraft, exams: parsedExams });
        }
      }
    } catch (err) {
      console.error('Erro ao carregar exames do modelo:', err);
      toast.toast.error('Formato do modelo inválido.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500 dark:text-gray-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-6">
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">Exames e Procedimentos</h1>
        <span className="text-xs text-slate-600 dark:text-gray-400 uppercase">{currentDate}</span>
      </div>

      <div className="space-y-4">
        {/* Solicitações já salvas */}
        {requests.map((req) => {
          if (!req.id) return null;
          const d = getDraft(req.id);
          return (
            <RequestCard
              key={req.id}
              draft={d}
              onUpdate={(nd) => setDraft(req.id!, nd)}
              onDelete={() => handleDelete(req.id!)}
              onSave={() => handleSaveExisting(req.id!)}
              onPrint={() => printRequest(d, patientData)}
              onOpenModelManager={(action, content) => handleOpenModelManager(req.id!, action, content)}
              isSaving={isSaving}
              isNew={false}
            />
          );
        })}

        {/* Novas solicitações */}
        {newDrafts.map((item, index) => (
          <div key={item.id} className="mb-4">
            {(requests.length > 0 || index > 0) && (
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-gray-700" />
                <span className="text-xs text-slate-400 dark:text-gray-500 uppercase font-medium">Nova Solicitação</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-gray-700" />
              </div>
            )}
            <RequestCard
              draft={item.draft}
              onUpdate={(nd) => {
                setNewDrafts((prev) =>
                  prev.map((p) => (p.id === item.id ? { ...p, draft: nd } : p))
                );
              }}
              onDelete={() => {
                setNewDrafts((prev) => prev.filter((p) => p.id !== item.id));
              }}
              onSave={() => handleSaveNew(item.id)}
              onPrint={() => printRequest(item.draft, patientData)}
              onOpenModelManager={(action, content) => handleOpenModelManager(item.id, action, content)}
              isSaving={isSaving}
              isNew={true}
            />
          </div>
        ))}

        {/* Adicionar outra solicitação */}
        <button
          type="button"
          onClick={() =>
            setNewDrafts((prev) => [
              ...prev,
              { id: `draft-${Date.now()}-${Math.random()}`, draft: emptyDraft() },
            ])
          }
          className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar Solicitação
        </button>
      </div>

      <ModelTemplateModal
        isOpen={modelModalOpen}
        onClose={() => setModelModalOpen(false)}
        onSelect={handleModelSelect}
        onSave={() => { }} // Not used entirely since the parent Modal handles its own save to DB now 
        type="exames"
        currentContent={currentModelContent}
      />
    </div>
  );
}
