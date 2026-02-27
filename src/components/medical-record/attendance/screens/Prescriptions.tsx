'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Printer,
  Save,
  X,
  FileText,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Pill,
  BookOpen,
  AlertCircle,
  Syringe,
  Microscope,
} from 'lucide-react';
import {
  usePrescriptions,
  PrescriptionItem,
  PrescriptionExamItem,
  PrescriptionVaccineItem,
  Prescription,
  searchMedications,
  searchVaccines,
} from '@/hooks/usePrescriptions';
import { searchTuss } from '@/hooks/useExamRequests';
import { AttendanceScreenProps } from '@/types/attendance';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ModelTemplateModal } from '../ModelTemplateModal';

// ─── Tipos internos ────────────────────────────────────────────────────────────
type View = 'landing' | 'form' | 'done';
type FormTab = 'medications' | 'exams' | 'vaccines';

interface DraftPrescription {
  id?: number;
  medications: PrescriptionItem[];
  exams: PrescriptionExamItem[];
  vaccines: PrescriptionVaccineItem[];
}

const UNITS = ['embalagem', 'caixa', 'comprimido', 'ampola', 'frasco', 'sachê', 'bisnaga', 'tubo', 'flaconete', 'unidade'];
const DOSES = ['1ª dose', '2ª dose', '3ª dose', '4ª dose', 'Reforço', 'Reforço 1', 'Reforço 2', 'Dose Única', 'Dose Anual'];

const emptyMedication = (): PrescriptionItem => ({
  name: '', posology: '', quantity: 1, unit: 'embalagem', receipt_type: 'simples',
});
const emptyExam = (): PrescriptionExamItem => ({ code: '', name: '', quantity: 1 });
const emptyVaccine = (): PrescriptionVaccineItem => ({ name: '', dose: '1ª dose' });

const emptyDraft = (): DraftPrescription => ({
  medications: [emptyMedication()],
  exams: [emptyExam()],
  vaccines: [emptyVaccine()],
});

// ─── Hook de busca genérico com debounce ─────────────────────────────────────
function useSearch<T>(
  searchFn: (q: string) => Promise<T[]>,
  delay = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (v: string) => {
      setQuery(v);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (v.length < 2) { setResults([]); return; }
        setSearching(true);
        const r = await searchFn(v);
        setResults(r);
        setSearching(false);
      }, delay);
    },
    [searchFn, delay]
  );

  const reset = () => { setQuery(''); setResults([]); };

  return { query, results, searching, handleChange, reset, setQuery };
}

// ─── Row genérico com dropdown de autocomplete ────────────────────────────────
function SearchRow({
  value,
  placeholder,
  results,
  searching,
  onChange,
  onSelect,
  onClear,
  renderResult,
  children,
}: {
  value: string;
  placeholder: string;
  results: any[];
  searching: boolean;
  onChange: (v: string) => void;
  onSelect: (item: any) => void;
  onClear: () => void;
  renderResult: (item: any) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setOpen(results.length > 0);
  }, [results]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-3 pr-8 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
        {value ? (
          <button type="button" onMouseDown={onClear} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        ) : searching ? (
          <div className="absolute right-2.5 top-2.5 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : null}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {results.map((item, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => { onSelect(item); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-100 dark:border-gray-700/50 last:border-0"
            >
              {renderResult(item)}
            </button>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

// ─── Row de Medicamento ───────────────────────────────────────────────────────
function MedicationRow({
  item, index, onUpdate, onRemove, canRemove, showError,
}: {
  item: PrescriptionItem;
  index: number;
  onUpdate: (i: number, item: PrescriptionItem) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
  showError: boolean;
}) {
  const { query, results, searching, handleChange, setQuery } = useSearch(searchMedications);

  useEffect(() => { setQuery(item.name); }, [item.name]);

  return (
    <div className="relative bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg p-4">
      <div className="absolute -top-3 left-4 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
        {index + 1}
      </div>
      {canRemove && (
        <button type="button" onClick={() => onRemove(index)} className="absolute top-3 right-3 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="space-y-3 mt-1">
        {/* Busca do medicamento */}
        <SearchRow
          value={query}
          placeholder="Digite o nome do medicamento..."
          results={results}
          searching={searching}
          onChange={(v) => {
            handleChange(v);
            onUpdate(index, { ...item, name: v });
          }}
          onSelect={(med) => {
            const label = med.name;
            setQuery(label);
            onUpdate(index, { ...item, name: label });
          }}
          onClear={() => {
            setQuery('');
            onUpdate(index, { ...item, name: '' });
          }}
          renderResult={(med) => (
            <div>
              <span className="font-medium text-slate-800 dark:text-gray-100">{med.name}</span>
              {med.active_ingredient && (
                <span className="block text-xs text-slate-400 mt-0.5">{med.active_ingredient}</span>
              )}
              {med.form && (
                <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                  {med.form}
                </span>
              )}
            </div>
          )}
        />

        {/* Posologia */}
        <div>
          <textarea
            value={item.posology}
            onChange={(e) => onUpdate(index, { ...item, posology: e.target.value })}
            placeholder="Digite a posologia..."
            rows={2}
            className={`w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all ${showError && !item.posology.trim()
                ? 'border-red-400 dark:border-red-500 bg-red-50/30'
                : 'border-slate-200 dark:border-gray-700'
              }`}
          />
          {showError && !item.posology.trim() && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> A posologia é obrigatória
            </p>
          )}
        </div>

        {/* Quantidade + Unidade + Tipo */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number" min={1} value={item.quantity}
            onChange={(e) => onUpdate(index, { ...item, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-14 px-2 py-1.5 text-sm text-center border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <select
            value={item.unit}
            onChange={(e) => onUpdate(index, { ...item, unit: e.target.value })}
            className="px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <div className="flex gap-1 ml-auto">
            {(['simples', 'especial'] as const).map((t) => (
              <button key={t} type="button"
                onClick={() => onUpdate(index, { ...item, receipt_type: t })}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${item.receipt_type === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600'
                  }`}
              >
                {t === 'simples' ? 'Receituário Simples' : 'Especial'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Row de Exame (TUSS) ──────────────────────────────────────────────────────
function ExamPrescriptionRow({
  item, index, onUpdate, onRemove, canRemove,
}: {
  item: PrescriptionExamItem;
  index: number;
  onUpdate: (i: number, item: PrescriptionExamItem) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
}) {
  const { query, results, searching, handleChange, setQuery } = useSearch(searchTuss);

  useEffect(() => {
    setQuery(item.code ? `${item.code} — ${item.name}` : item.name);
  }, [item.name, item.code]);

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <SearchRow
          value={query}
          placeholder="Buscar exame ou código TUSS..."
          results={results}
          searching={searching}
          onChange={(v) => {
            handleChange(v);
            onUpdate(index, { ...item, name: v, code: '' });
          }}
          onSelect={(exam) => {
            const label = `${exam.code} — ${exam.name}`;
            setQuery(label);
            onUpdate(index, { ...item, code: exam.code, name: exam.name });
          }}
          onClear={() => {
            setQuery('');
            onUpdate(index, { ...item, name: '', code: '' });
          }}
          renderResult={(exam) => (
            <div>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400 mr-2">{exam.code}</span>
              <span className="text-slate-700 dark:text-gray-200">{exam.name}</span>
              {exam.category && <span className="ml-1 text-xs text-slate-400">({exam.category})</span>}
            </div>
          )}
        />
      </div>
      {/* Quantidade */}
      <input
        type="number" min={1} value={item.quantity}
        onChange={(e) => onUpdate(index, { ...item, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
        className="w-16 px-2 py-2 text-sm text-center border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      {canRemove && (
        <button type="button" onClick={() => onRemove(index)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Row de Vacina ────────────────────────────────────────────────────────────
function VaccineRow({
  item, index, onUpdate, onRemove, canRemove,
}: {
  item: PrescriptionVaccineItem;
  index: number;
  onUpdate: (i: number, item: PrescriptionVaccineItem) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
}) {
  const { query, results, searching, handleChange, setQuery } = useSearch(searchVaccines);

  useEffect(() => { setQuery(item.name); }, [item.name]);

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <SearchRow
          value={query}
          placeholder="Buscar vacina..."
          results={results}
          searching={searching}
          onChange={(v) => {
            handleChange(v);
            onUpdate(index, { ...item, name: v });
          }}
          onSelect={(vaccine) => {
            setQuery(vaccine.name);
            onUpdate(index, { ...item, name: vaccine.name });
          }}
          onClear={() => {
            setQuery('');
            onUpdate(index, { ...item, name: '' });
          }}
          renderResult={(vaccine) => (
            <div>
              <span className="font-medium text-slate-800 dark:text-gray-100">{vaccine.name}</span>
              <div className="flex gap-2 mt-0.5">
                {vaccine.commercial_names && (
                  <span className="text-xs text-slate-400">{vaccine.commercial_names}</span>
                )}
                {vaccine.category && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${vaccine.category === 'PNI'
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                    }`}>{vaccine.category}</span>
                )}
              </div>
            </div>
          )}
        />
      </div>
      {/* Dose */}
      <select
        value={item.dose || '1ª dose'}
        onChange={(e) => onUpdate(index, { ...item, dose: e.target.value })}
        className="px-2 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {DOSES.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      {canRemove && (
        <button type="button" onClick={() => onRemove(index)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Geração de PDF ───────────────────────────────────────────────────────────
export function printPrescription(draft: DraftPrescription, patientData: any) {
  const patientName = patientData?.name || patientData?.contact_name || '—';
  const patientCpf = patientData?.cpf || patientData?.document || '';
  const dateStr = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });

  const meds = draft.medications.filter((i) => i.name.trim());
  const exams = draft.exams.filter((i) => i.name.trim());
  const vaccines = draft.vaccines.filter((i) => i.name.trim());

  const medsHtml = meds.map((item, i) => `
    <div class="medication-item">
      <div class="medication-number">${i + 1}</div>
      <div class="medication-content">
        <div class="medication-name">${item.name}</div>
        <div class="medication-posology">${item.posology || ''}</div>
        <div class="medication-qty">${item.quantity} ${item.unit}</div>
      </div>
    </div>`).join('');

  const examsHtml = exams.map((item, i) => `
    <div class="exam-item">
      <span class="exam-num">${i + 1}.</span>
      ${item.code ? `<span class="exam-code">${item.code}</span> — ` : ''}
      <span>${item.name}</span>
      <span class="exam-qty">x${item.quantity}</span>
    </div>`).join('');

  const vaccinesHtml = vaccines.map((item, i) => `
    <div class="exam-item">
      <span class="exam-num">${i + 1}.</span>
      <span>${item.name}</span>
      ${item.dose ? `<span class="exam-qty">${item.dose}</span>` : ''}
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Receita Médica</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
    body { padding: 30px; font-size: 11px; color: #1a1a1a; }
    .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 20px; }
    .clinic-name { font-size: 18px; font-weight: bold; }
    .clinic-phones { font-size: 11px; color: #555; margin-top: 2px; }
    .title { text-align: center; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; }
    .patient-section { border: 1px solid #ccc; border-radius: 4px; padding: 10px 14px; margin-bottom: 20px; background: #f9f9f9; }
    .patient-label { font-size: 9px; text-transform: uppercase; color: #777; letter-spacing: 1px; }
    .patient-name { font-size: 13px; font-weight: bold; margin-top: 2px; }
    .patient-cpf { font-size: 11px; color: #555; margin-top: 2px; }
    .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #555; letter-spacing: 1px; margin: 16px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .medication-item { display: flex; gap: 12px; margin-bottom: 14px; }
    .medication-number { width: 22px; height: 22px; background: #1a1a1a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; flex-shrink: 0; margin-top: 1px; }
    .medication-content { flex: 1; }
    .medication-name { font-size: 13px; font-weight: bold; text-transform: uppercase; }
    .medication-posology { font-size: 11px; color: #333; margin-top: 3px; line-height: 1.4; }
    .medication-qty { font-size: 10px; color: #777; margin-top: 3px; }
    .exam-item { display: flex; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px dotted #e5e7eb; font-size: 11px; }
    .exam-num { font-weight: bold; color: #555; width: 18px; flex-shrink: 0; }
    .exam-code { font-family: monospace; color: #2563eb; font-size: 10px; }
    .exam-qty { margin-left: auto; color: #777; font-size: 10px; }
    .footer { position: fixed; bottom: 30px; left: 30px; right: 30px; border-top: 1px solid #ccc; padding-top: 12px; }
    .footer-row { display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-date { font-size: 10px; color: #555; }
    .doctor-block { text-align: right; }
    .doctor-signature { width: 160px; border-top: 1px solid #1a1a1a; margin-bottom: 6px; margin-left: auto; }
    .doctor-name { font-size: 12px; font-weight: bold; }
    .doctor-crm { font-size: 10px; color: #555; }
    .footer-credit { text-align: center; font-size: 9px; color: #aaa; margin-top: 10px; }
    @page { size: A5; margin: 8mm; }
    @media print { body { padding: 0; } .footer { position: fixed; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="clinic-name">Karla Fernanda</div>
    <div class="clinic-phones">CRM: 9223 | Telefone: (99) 98429-2254</div>
  </div>
  <div class="title">Receita Médica</div>
  <div class="patient-section">
    <div class="patient-label">Paciente</div>
    <div class="patient-name">${patientName}</div>
    ${patientCpf ? `<div class="patient-cpf">CPF: ${patientCpf}</div>` : ''}
  </div>

  ${meds.length > 0 ? `<div class="section-title">Medicamentos</div>${medsHtml}` : ''}
  ${exams.length > 0 ? `<div class="section-title">Exames Solicitados</div>${examsHtml}` : ''}
  ${vaccines.length > 0 ? `<div class="section-title">Vacinas</div>${vaccinesHtml}` : ''}

  <div class="footer">
    <div class="footer-row">
      <div class="footer-date">Lago da Pedra - MA, ${dateStr}</div>
      <div class="doctor-block">
        <div class="doctor-signature"></div>
        <div class="doctor-name">Dra. Fernanda Santana</div>
        <div class="doctor-crm">CRM 9223 - MA</div>
      </div>
    </div>
    <div class="footer-credit">Documento gerado pelo sistema Centro Médico Aliança</div>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) { doc.open(); doc.write(html); doc.close(); }
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 400);
}

// ─── Card de prescrição histórica ─────────────────────────────────────────────
function PrescriptionCard({
  prescription, onRenew, onPrint, onDelete,
}: {
  prescription: Prescription;
  onRenew: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const meds = prescription.items.filter((i) => i.name);
  const exams = (prescription.exam_items || []).filter((i) => i.name);
  const vaccines = (prescription.vaccine_items || []).filter((i) => i.name);
  const totalItems = meds.length + exams.length + vaccines.length;

  const preview = [
    ...meds.map((i) => i.name),
    ...exams.map((i) => i.name),
    ...vaccines.map((i) => i.name),
  ].filter(Boolean).slice(0, 3).join(', ');

  return (
    <div className="bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start gap-3">
        {/* Calendário */}
        <div className="flex-shrink-0 text-center">
          <div className="w-11 bg-blue-600 text-white text-[10px] font-bold rounded-t px-1 py-0.5 text-center">
            {prescription.created_at
              ? format(new Date(prescription.created_at), 'MMM', { locale: ptBR }).toUpperCase()
              : '—'}
          </div>
          <div className="w-11 border border-slate-200 dark:border-gray-600 rounded-b text-lg font-bold text-slate-700 dark:text-gray-200 text-center py-0.5">
            {prescription.created_at ? format(new Date(prescription.created_at), 'd') : '—'}
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-700 dark:text-gray-200 font-medium leading-tight line-clamp-2">
            {preview || 'Sem itens'}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {meds.length > 0 && (
              <span className="text-[10px] flex items-center gap-0.5 text-slate-400">
                <Pill className="w-3 h-3" /> {meds.length}
              </span>
            )}
            {exams.length > 0 && (
              <span className="text-[10px] flex items-center gap-0.5 text-slate-400">
                <Microscope className="w-3 h-3" /> {exams.length}
              </span>
            )}
            {vaccines.length > 0 && (
              <span className="text-[10px] flex items-center gap-0.5 text-slate-400">
                <Syringe className="w-3 h-3" /> {vaccines.length}
              </span>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-1 flex-shrink-0">
          <button type="button" onClick={onPrint} title="Imprimir" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-700 rounded transition-colors">
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDelete} title="Excluir" className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <button type="button" onClick={onRenew} className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
        <RotateCcw className="w-3.5 h-3.5" />
        Renovar Prescrição
      </button>
    </div>
  );
}

// ─── Grid de templates ────────────────────────────────────────────────────────
function PrescriptionTemplatesGrid({ onSelectTemplate }: {
  onSelectTemplate: (draft: DraftPrescription) => void;
}) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('macros')
        .select('*')
        .eq('type', 'prescricoes')
        .order('created_at', { ascending: false })
        .limit(8)
        .then(({ data }) => { setTemplates(data || []); setLoading(false); });
    });
  }, []);

  if (loading) return <div className="text-xs text-slate-400 py-2">Carregando modelos...</div>;

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-lg">
        <BookOpen className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-xs text-slate-400">Nenhum modelo salvo ainda.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {templates.map((t) => (
        <button key={t.id} type="button"
          onClick={() => {
            try {
              const parsed = JSON.parse(t.content);
              if (parsed && (parsed.medications || parsed.exams || parsed.vaccines)) {
                onSelectTemplate(parsed);
              } else if (Array.isArray(parsed)) {
                // compatibilidade com modelos antigos (só medications)
                onSelectTemplate({ ...emptyDraft(), medications: parsed });
              }
            } catch { /* ignora */ }
          }}
          className="text-left p-3 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
        >
          <ClipboardList className="w-5 h-5 text-slate-400 mb-2" />
          <p className="text-xs font-semibold text-slate-700 dark:text-gray-200 line-clamp-2">{t.title}</p>
        </button>
      ))}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function Prescriptions({ patientId, patientData, appointmentId, medicalRecordId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { prescriptions, isLoading, isSaving, createPrescription, deletePrescription } =
    usePrescriptions(patientId, medicalRecordId);

  const [view, setView] = useState<View>('landing');
  const [draft, setDraft] = useState<DraftPrescription>(emptyDraft());
  const [activeTab, setActiveTab] = useState<FormTab>('medications');
  const [showErrors, setShowErrors] = useState(false);
  const [lastSaved, setLastSaved] = useState<Prescription | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Modal de modelos
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelAction, setModelAction] = useState<'load' | 'save'>('load');

  const currentDate = format(new Date(), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });

  // Contagem de itens por aba (para badges)
  const medCount = draft.medications.filter((i) => i.name.trim()).length;
  const examCount = draft.exams.filter((i) => i.name.trim()).length;
  const vaccineCount = draft.vaccines.filter((i) => i.name.trim()).length;

  // ─── Helpers de atualização ────────────────────────────────────────────────
  const updateMed = (i: number, item: PrescriptionItem) =>
    setDraft((d) => ({ ...d, medications: d.medications.map((it, idx) => idx === i ? item : it) }));
  const removeMed = (i: number) =>
    setDraft((d) => ({ ...d, medications: d.medications.filter((_, idx) => idx !== i) }));
  const addMed = () =>
    setDraft((d) => ({ ...d, medications: [...d.medications, emptyMedication()] }));

  const updateExam = (i: number, item: PrescriptionExamItem) =>
    setDraft((d) => ({ ...d, exams: d.exams.map((it, idx) => idx === i ? item : it) }));
  const removeExam = (i: number) =>
    setDraft((d) => ({ ...d, exams: d.exams.filter((_, idx) => idx !== i) }));
  const addExam = () =>
    setDraft((d) => ({ ...d, exams: [...d.exams, emptyExam()] }));

  const updateVaccine = (i: number, item: PrescriptionVaccineItem) =>
    setDraft((d) => ({ ...d, vaccines: d.vaccines.map((it, idx) => idx === i ? item : it) }));
  const removeVaccine = (i: number) =>
    setDraft((d) => ({ ...d, vaccines: d.vaccines.filter((_, idx) => idx !== i) }));
  const addVaccine = () =>
    setDraft((d) => ({ ...d, vaccines: [...d.vaccines, emptyVaccine()] }));

  // ─── Formulário ────────────────────────────────────────────────────────────
  const openNewForm = () => {
    setDraft(emptyDraft());
    setActiveTab('medications');
    setShowErrors(false);
    setView('form');
  };

  const openRenewForm = (prescription: Prescription) => {
    setDraft({
      medications: prescription.items.map((i) => ({ ...i })),
      exams: (prescription.exam_items || []).map((i) => ({ ...i })),
      vaccines: (prescription.vaccine_items || []).map((i) => ({ ...i })),
    });
    setActiveTab('medications');
    setShowErrors(false);
    setView('form');
  };

  // ─── Finalizar ─────────────────────────────────────────────────────────────
  const handleFinalize = async () => {
    const hasMeds = draft.medications.some((i) => i.name.trim());
    const hasExams = draft.exams.some((i) => i.name.trim());
    const hasVaccines = draft.vaccines.some((i) => i.name.trim());

    if (!hasMeds && !hasExams && !hasVaccines) {
      toast.toast.error('Adicione pelo menos um item (medicamento, exame ou vacina).');
      return;
    }

    const hasEmptyPosology = draft.medications.some((i) => i.name.trim() && !i.posology.trim());
    if (hasEmptyPosology) {
      setShowErrors(true);
      setActiveTab('medications');
      toast.toast.error('Preencha a posologia de todos os medicamentos.');
      return;
    }

    try {
      const saved = await createPrescription({
        patient_id: patientId,
        items: draft.medications.filter((i) => i.name.trim()),
        exam_items: draft.exams.filter((i) => i.name.trim()),
        vaccine_items: draft.vaccines.filter((i) => i.name.trim()),
      });
      setLastSaved(saved);
      setView('done');
    } catch {
      toast.toast.error('Erro ao salvar prescrição.');
    }
  };

  // ─── Modelos ───────────────────────────────────────────────────────────────
  const handleModelSelect = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.medications || parsed.exams || parsed.vaccines) {
        setDraft({
          medications: parsed.medications || [emptyMedication()],
          exams: parsed.exams || [emptyExam()],
          vaccines: parsed.vaccines || [emptyVaccine()],
        });
      } else if (Array.isArray(parsed)) {
        setDraft({ ...emptyDraft(), medications: parsed });
      }
    } catch {
      toast.toast.error('Formato do modelo inválido.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Confirmar exclusão desta prescrição?')) return;
    try {
      await deletePrescription(id);
    } catch {
      toast.toast.error('Erro ao excluir.');
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-slate-500 dark:text-gray-400">Carregando...</div>;
  }

  // ─── View: Formulário ──────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="p-4 pb-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setView('landing')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-gray-300 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-sm font-semibold text-slate-600 dark:text-gray-300">Prescrever</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setModelAction('load'); setModelModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-md hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
              <BookOpen className="w-3.5 h-3.5" /> Histórico
            </button>
            <button type="button" onClick={() => { setModelAction('save'); setModelModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-md hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
              <Save className="w-3.5 h-3.5" /> Usar Modelo
            </button>
          </div>
        </div>

        {/* Abas: Medicamentos | Exames | Vacinas */}
        <div className="flex gap-0 border-b border-slate-200 dark:border-gray-700 mb-4">
          {([
            { key: 'medications', label: 'Medicamentos', icon: <Pill className="w-4 h-4" />, count: medCount },
            { key: 'exams', label: 'Exames', icon: <Microscope className="w-4 h-4" />, count: examCount },
            { key: 'vaccines', label: 'Vacinas', icon: <Syringe className="w-4 h-4" />, count: vaccineCount },
          ] as const).map((tab) => (
            <button key={tab.key} type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-0.5 w-4 h-4 text-[10px] bg-blue-600 text-white rounded-full flex items-center justify-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Cabeçalho da seção */}
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">
            {activeTab === 'medications' ? 'Itens da Receita' : activeTab === 'exams' ? 'Itens do Exame' : 'Itens da Vacina'}
          </p>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
            {activeTab === 'medications' ? 'Adicione itens de texto livre à sua receita' : activeTab === 'exams' ? 'Adicione itens de exame' : 'Adicione itens de vacina'}
          </p>
        </div>

        {/* ─── Aba: Medicamentos ─────────────────────────────────────────── */}
        {activeTab === 'medications' && (
          <div className="space-y-5">
            {draft.medications.map((item, i) => (
              <MedicationRow key={i} item={item} index={i}
                onUpdate={updateMed} onRemove={removeMed}
                canRemove={draft.medications.length > 1} showError={showErrors}
              />
            ))}
            <button type="button" onClick={addMed}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Plus className="w-4 h-4" /> Novo Item
            </button>
          </div>
        )}

        {/* ─── Aba: Exames ──────────────────────────────────────────────── */}
        {activeTab === 'exams' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400 uppercase font-medium">Exame / Procedimento</span>
              <span className="text-xs text-slate-400">Qtd.</span>
            </div>
            {draft.exams.map((item, i) => (
              <ExamPrescriptionRow key={i} item={item} index={i}
                onUpdate={updateExam} onRemove={removeExam}
                canRemove={draft.exams.length > 1}
              />
            ))}
            <button type="button" onClick={addExam}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Plus className="w-4 h-4" /> Novo Item
            </button>
          </div>
        )}

        {/* ─── Aba: Vacinas ─────────────────────────────────────────────── */}
        {activeTab === 'vaccines' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400 uppercase font-medium">Vacina</span>
              <span className="text-xs text-slate-400">Dose</span>
            </div>
            {draft.vaccines.map((item, i) => (
              <VaccineRow key={i} item={item} index={i}
                onUpdate={updateVaccine} onRemove={removeVaccine}
                canRemove={draft.vaccines.length > 1}
              />
            ))}
            <button type="button" onClick={addVaccine}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Plus className="w-4 h-4" /> Novo Item
            </button>
          </div>
        )}

        {/* Rodapé */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100 dark:border-gray-700/50">
          <button type="button" onClick={() => setView('landing')} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-gray-300 transition-colors">
            Cancelar
          </button>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => { setModelAction('save'); setModelModalOpen(true); }}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
              <Save className="w-4 h-4" />
              Salvar como Modelo
            </button>
            <button type="button" onClick={handleFinalize} disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors">
              {isSaving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
              ) : (
                <>Finalizar <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>

        {/* Modal de modelos */}
        <ModelTemplateModal
          isOpen={modelModalOpen}
          onClose={() => setModelModalOpen(false)}
          onSelect={handleModelSelect}
          onSave={() => { }}
          type="prescricoes"
          currentContent={modelAction === 'save' ? JSON.stringify(draft) : ''}
        />
      </div>
    );
  }

  // ─── View: Concluído ───────────────────────────────────────────────────────
  if (view === 'done' && lastSaved) {
    const meds = lastSaved.items || [];
    const exams = lastSaved.exam_items || [];
    const vaccines = lastSaved.vaccine_items || [];

    return (
      <div className="p-4 pb-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">Prescrições</h1>
          <span className="text-xs text-slate-600 dark:text-gray-400 uppercase">{currentDate}</span>
        </div>

        <div className="bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-gray-100">Prescrição Emitida</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {meds.length > 0 && `${meds.length} med. `}
                {exams.length > 0 && `${exams.length} exam. `}
                {vaccines.length > 0 && `${vaccines.length} vac.`}
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">Compartilhe com seu paciente:</p>

          {meds.length > 0 && (
            <div className="flex items-center gap-2 mb-2 p-3 border border-slate-200 dark:border-gray-700 rounded-lg">
              <input type="checkbox" checked readOnly className="rounded text-blue-600" />
              <Pill className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-700 dark:text-gray-200">
                Receituário Simples ({meds.length} medicamento{meds.length > 1 ? 's' : ''})
              </span>
            </div>
          )}
          {exams.length > 0 && (
            <div className="flex items-center gap-2 mb-2 p-3 border border-slate-200 dark:border-gray-700 rounded-lg">
              <input type="checkbox" checked readOnly className="rounded text-blue-600" />
              <Microscope className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-700 dark:text-gray-200">
                Exames ({exams.length} exame{exams.length > 1 ? 's' : ''})
              </span>
            </div>
          )}
          {vaccines.length > 0 && (
            <div className="flex items-center gap-2 mb-2 p-3 border border-slate-200 dark:border-gray-700 rounded-lg">
              <input type="checkbox" checked readOnly className="rounded text-blue-600" />
              <Syringe className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-700 dark:text-gray-200">
                Vacinas ({vaccines.length} vacina{vaccines.length > 1 ? 's' : ''})
              </span>
            </div>
          )}

          <div className="flex gap-2 mt-4 flex-wrap">
            <button type="button"
              onClick={() => printPrescription({ medications: meds, exams, vaccines }, patientData)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <Printer className="w-4 h-4" /> Imprimir PDF
            </button>
          </div>
        </div>

        <button type="button" onClick={openNewForm}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Nova Prescrição
        </button>
      </div>
    );
  }

  // ─── View: Landing ─────────────────────────────────────────────────────────
  return (
    <div className="p-4 pb-6">
      <div className="mb-5 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">Prescrições</h1>
        <span className="text-xs text-slate-600 dark:text-gray-400 uppercase">{currentDate}</span>
      </div>

      {/* Criar Prescrição */}
      <div className="bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg p-4 mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-slate-800 dark:text-gray-100">Criar Prescrição</span>
          </div>
          <div className="flex gap-2">
            <button type="button"
              onClick={() => { setModelAction('load'); setModelModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-md hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
              <BookOpen className="w-3.5 h-3.5" /> Usar Modelo
            </button>
            <button type="button" onClick={openNewForm}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
              <Plus className="w-3.5 h-3.5" /> Criar Nova Em Branco
            </button>
          </div>
        </div>
      </div>

      {/* Prescrições recentes / histórico */}
      {prescriptions.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200">
              {showAllHistory ? `Histórico completo (${prescriptions.length})` : 'Prescrições mais recentes'}
            </h2>
            {prescriptions.length > 3 && (
              <button type="button" onClick={() => setShowAllHistory((p) => !p)}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline transition-colors">
                {showAllHistory ? (
                  <><ChevronLeft className="w-3.5 h-3.5" /> Ver menos</>
                ) : (
                  <><FileText className="w-3.5 h-3.5" /> Ver Todo Histórico</>
                )}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(showAllHistory ? prescriptions : prescriptions.slice(0, 3)).map((p) => (
              <PrescriptionCard key={p.id} prescription={p}
                onRenew={() => openRenewForm(p)}
                onPrint={() => printPrescription({
                  medications: p.items, exams: p.exam_items || [], vaccines: p.vaccine_items || [],
                }, patientData)}
                onDelete={() => handleDelete(p.id!)}
              />
            ))}
          </div>
          {showAllHistory && (
            <button type="button" onClick={() => setShowAllHistory(false)}
              className="mt-4 w-full py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors">
              ↑ Mostrar menos
            </button>
          )}
        </div>
      )}

      {/* Biblioteca de modelos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Biblioteca de modelos
          </h2>
          <button type="button" onClick={() => { setModelAction('load'); setModelModalOpen(true); }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            Gerenciar
          </button>
        </div>
        <PrescriptionTemplatesGrid
          onSelectTemplate={(draft) => { setDraft(draft); setView('form'); }}
        />
      </div>

      {/* Estado vazio */}
      {prescriptions.length === 0 && (
        <div className="mt-6 text-center py-12">
          <Pill className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-gray-400">Nenhuma prescrição registrada ainda.</p>
          <button type="button" onClick={openNewForm}
            className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            Criar primeira prescrição
          </button>
        </div>
      )}

      {/* Modal de modelos (landing) */}
      <ModelTemplateModal
        isOpen={modelModalOpen}
        onClose={() => setModelModalOpen(false)}
        onSelect={(content) => {
          handleModelSelect(content);
          setView('form');
          setModelModalOpen(false);
        }}
        onSave={() => { }}
        type="prescricoes"
        currentContent=""
      />
    </div>
  );
}
