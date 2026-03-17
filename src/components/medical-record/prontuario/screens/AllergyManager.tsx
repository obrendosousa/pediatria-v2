'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, Loader2, Save, Lock } from 'lucide-react';
import { ProntuarioScreenProps } from '@/types/prontuario';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

const supabase = createSchemaClient('atendimento');

// ── Tipos ──

interface AllergyItem {
  id: number;
  label: string;
  fieldType?: 'textarea' | 'input'; // Per-item field (textarea = multilinha, input = single-line)
}

interface AllergySection {
  key: string;
  title: string;
  group?: string; // Agrupamento visual sob título-pai
  items: AllergyItem[];
  sectionNote?: {
    afterItemId?: number; // Insere textarea após este item. Se undefined, após todos os items
    placeholder?: string;
  };
}

// ── Mapeamento completo das 11 seções do PRD ──

const ALLERGY_SECTIONS: AllergySection[] = [
  // SEÇÃO 1: Queixa Principal
  {
    key: 'queixa_principal',
    title: 'Queixa Principal',
    items: [
      { id: 1, label: 'Nariz' },
      { id: 2, label: 'Olhos' },
      { id: 3, label: 'Pulmão' },
      { id: 4, label: 'Pele' },
      { id: 5, label: 'Alergia Alimentar' },
    ],
  },
  // SEÇÃO 2A: Alergia Respiratória
  {
    key: 'alergia_respiratoria',
    title: 'Alergia Respiratória',
    group: 'História da Doença Atual',
    items: [
      { id: 6, label: 'Tosse' },
      { id: 7, label: 'Coriza' },
      { id: 8, label: 'Prurido nasoocular' },
      { id: 9, label: 'Prurido em orofaringe e ouvidos' },
      { id: 10, label: 'Roncos noturnos' },
      { id: 11, label: 'Dorme com boca aberta' },
      { id: 12, label: 'Otorreia' },
      { id: 13, label: 'Refluxo GE' },
      { id: 14, label: 'Sibilância' },
      { id: 15, label: 'Dispneia noturna' },
      { id: 16, label: 'Dispneia diurna e noturna' },
    ],
  },
  // SEÇÃO 2B: Alergia Cutânea (textarea entre items 20 e 21)
  {
    key: 'alergia_cutanea',
    title: 'Alergia Cutânea',
    group: 'História da Doença Atual',
    items: [
      { id: 17, label: 'Estrofulo' },
      { id: 18, label: 'Urticária' },
      { id: 19, label: 'Dermatite atópica' },
      { id: 20, label: 'Dermatite de contato' },
      { id: 21, label: 'Angioedema labial' },
      { id: 22, label: 'Angioedema palpebral' },
      { id: 23, label: 'Edema de língua' },
      { id: 24, label: 'Edema de faringe' },
    ],
    sectionNote: { afterItemId: 20, placeholder: 'Observações sobre alergia cutânea...' },
  },
  // SEÇÃO 2C: Alergia Alimentar
  {
    key: 'alergia_alimentar',
    title: 'Alergia Alimentar',
    group: 'História da Doença Atual',
    items: [
      { id: 25, label: 'Alergia a leite de vaca' },
      { id: 26, label: 'Intolerância ao leite' },
      { id: 27, label: 'Alergia a soja' },
      { id: 28, label: 'Alergia/intolerância frutos do mar' },
      { id: 29, label: 'Alergia a corantes' },
      { id: 30, label: 'Outras' },
    ],
    sectionNote: { placeholder: 'Detalhar outras alergias alimentares...' },
  },
  // SEÇÃO 3: Reações a Medicamento
  {
    key: 'reacoes_medicamento',
    title: 'Reações a Medicamento',
    items: [
      { id: 31, label: 'AINNH', fieldType: 'textarea' },
      { id: 32, label: 'Anti-hipertensivos', fieldType: 'textarea' },
      { id: 33, label: 'Ansiolíticos', fieldType: 'textarea' },
      { id: 34, label: 'Antibióticos' },
      { id: 84, label: 'Outros', fieldType: 'textarea' },
    ],
  },
  // SEÇÃO 4: Imunidade
  {
    key: 'imunidade',
    title: 'Imunidade',
    items: [
      { id: 35, label: 'Vacinas de rotina' },
      { id: 36, label: 'Outras vacinas' },
      { id: 37, label: 'Infecções respiratórias', fieldType: 'textarea' },
      { id: 38, label: 'Virais', fieldType: 'textarea' },
    ],
  },
  // SEÇÃO 5: História Patológica Pregressa
  {
    key: 'historia_patologica',
    title: 'História Patológica Pregressa',
    items: [
      { id: 39, label: 'Asma Bronquial' },
      { id: 40, label: 'Pneumonias' },
      { id: 41, label: 'Urticárias' },
      { id: 42, label: 'Sinusites' },
      { id: 43, label: 'Amigdalites' },
      { id: 44, label: 'Refluxos GE' },
      { id: 45, label: 'Gastrite/esofagite eosinofílica' },
      { id: 46, label: 'Estrofulo' },
      { id: 47, label: 'Reações a insetos' },
      { id: 48, label: 'Doença cardiovascular' },
      { id: 49, label: 'Hipertensão arterial' },
      { id: 50, label: 'Diabetes' },
      { id: 51, label: 'Câncer' },
      { id: 52, label: 'TB pulmonar/pleural' },
      { id: 53, label: 'TB ganglionar' },
    ],
  },
  // SEÇÃO 6: História Familiar
  {
    key: 'historia_familiar',
    title: 'História Familiar',
    items: [
      { id: 54, label: 'AB' },
      { id: 55, label: 'Rinite' },
      { id: 56, label: 'Urticária' },
      { id: 57, label: 'Estrofulo' },
      { id: 58, label: 'Reações a drogas' },
      { id: 59, label: 'Dermatite de contato' },
      { id: 60, label: 'Dermatite atópica' },
      { id: 61, label: 'Outras' },
    ],
    sectionNote: { placeholder: 'Detalhar outros itens familiares...' },
  },
  // SEÇÃO 7: Medicamentos em Uso
  {
    key: 'medicamentos_uso',
    title: 'Medicamentos em Uso',
    items: [
      { id: 62, label: 'Propranolol' },
      { id: 63, label: 'Enalapril' },
      { id: 64, label: 'Benzodiazepínicos' },
      { id: 65, label: 'Inibidores da ECA' },
      { id: 66, label: 'Diuréticos tiazídicos' },
      { id: 67, label: 'Antialérgicos' },
      { id: 68, label: 'Corticosteroides' },
    ],
  },
  // SEÇÃO 8: Exame Físico (input text single-line)
  {
    key: 'exame_fisico',
    title: 'Exame Físico',
    items: [
      { id: 69, label: 'Pele', fieldType: 'input' },
      { id: 70, label: 'AR', fieldType: 'input' },
      { id: 71, label: 'Rin Ant', fieldType: 'input' },
      { id: 72, label: 'Or', fieldType: 'input' },
    ],
  },
  // SEÇÃO 9: Testes Alérgicos (input text single-line)
  {
    key: 'testes_alergicos',
    title: 'Testes Alérgicos',
    items: [
      { id: 73, label: 'DP', fieldType: 'input' },
      { id: 74, label: 'DF', fieldType: 'input' },
      { id: 75, label: 'BT', fieldType: 'input' },
      { id: 76, label: 'PC', fieldType: 'input' },
      { id: 77, label: 'PG', fieldType: 'input' },
      { id: 78, label: 'Ba', fieldType: 'input' },
      { id: 79, label: 'Mo', fieldType: 'input' },
      { id: 80, label: 'CP', fieldType: 'input' },
      { id: 81, label: 'CN', fieldType: 'input' },
    ],
  },
  // SEÇÃO 10: Conduta
  {
    key: 'conduta',
    title: 'Conduta',
    items: [
      { id: 82, label: 'Medicamentos', fieldType: 'textarea' },
      { id: 83, label: 'Exames', fieldType: 'textarea' },
    ],
  },
];

// ── Estilos ──

const cardCls = 'bg-white dark:bg-[#131316] border border-slate-200/80 dark:border-[#1e1e24] rounded-xl';
const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#1e1e24] rounded-lg bg-white dark:bg-[#131316] text-slate-700 dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-[#3f3f46]';
const labelCls = 'text-[11px] font-semibold text-slate-500 dark:text-[#52525b] uppercase tracking-wide mb-1.5 block';

// ── Componente Principal ──

export function AllergyManager({ patientId }: ProntuarioScreenProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({}); // keys: item IDs (number) + section keys ("s_xxx")
  const [blocked, setBlocked] = useState(false);
  const [allowedProfessionals, setAllowedProfessionals] = useState<number[]>([]);
  const [professionals, setProfessionals] = useState<{ id: number; name: string }[]>([]);
  const [alertSystem, setAlertSystem] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const currentProfessionalId = profile?.doctor_id ?? null;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ data }, { data: profsData }] = await Promise.all([
        supabase
          .from('patient_allergies')
          .select('*')
          .eq('patient_id', patientId)
          .single(),
        supabase
          .from('professionals')
          .select('id, name')
          .eq('status', 'active')
          .order('name'),
      ]);

      if (data) {
        setCheckedIds(new Set(data.answers || []));
        setNotes(data.notes || {});
        setBlocked(data.blocked || false);
        setAllowedProfessionals(data.allowed_professionals || []);
        setAlertSystem(data.alert_system || false);
      }
      if (profsData) setProfessionals(profsData);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Verificar se o profissional logado tem acesso (quando bloqueado)
  const hasAccess = !blocked || (currentProfessionalId != null && allowedProfessionals.includes(currentProfessionalId));
  const isReadOnly = blocked && !hasAccess;

  const toggleCheck = (id: number) => {
    if (isReadOnly) return;
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateNote = (key: string, value: string) => {
    if (isReadOnly) return;
    setNotes(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (isReadOnly) {
      toast.error('Você não tem permissão para editar estas alergias.');
      return;
    }
    if (blocked && allowedProfessionals.length === 0) {
      toast.error('Selecione ao menos um profissional com acesso às alergias bloqueadas.');
      return;
    }
    setIsSaving(true);
    try {
      // Limpar notes de items desmarcados (manter apenas section notes e items ativos)
      const cleanedNotes: Record<string, string> = {};
      for (const [key, value] of Object.entries(notes)) {
        if (!value.trim()) continue;
        if (key.startsWith('s_')) {
          cleanedNotes[key] = value; // section notes sempre mantidas
        } else {
          const numId = Number(key);
          if (checkedIds.has(numId)) cleanedNotes[key] = value;
        }
      }

      const payload = {
        patient_id: patientId,
        answers: Array.from(checkedIds),
        notes: cleanedNotes,
        blocked,
        allowed_professionals: blocked ? allowedProfessionals : null,
        alert_system: alertSystem,
      };

      const { data: existing } = await supabase
        .from('patient_allergies')
        .select('id')
        .eq('patient_id', patientId)
        .single();

      if (existing) {
        await supabase.from('patient_allergies').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('patient_allergies').insert(payload);
      }
      toast.success('Alergias salvas!');
    } catch {
      toast.error('Erro ao salvar alergias');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render helpers ──

  const renderSectionNote = (section: AllergySection) => {
    if (!section.sectionNote) return null;
    const key = `s_${section.key}`;
    return (
      <textarea
        value={notes[key] || ''}
        onChange={e => updateNote(key, e.target.value)}
        disabled={isReadOnly}
        placeholder={section.sectionNote.placeholder || 'Observações...'}
        rows={3}
        className={`${inputCls} text-xs resize-none`}
      />
    );
  };

  const renderSection = (section: AllergySection) => {
    const afterItemId = section.sectionNote?.afterItemId;
    const itemsBefore = afterItemId != null ? section.items.filter(i => i.id <= afterItemId) : section.items;
    const itemsAfter = afterItemId != null ? section.items.filter(i => i.id > afterItemId) : [];

    return (
      <div key={section.key} className={`${cardCls} p-4 space-y-3`}>
        <h4 className="text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">{section.title}</h4>

        {/* Items antes do section note */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
          {itemsBefore.map(item => (
            <div key={item.id} className={item.fieldType ? 'col-span-2 md:col-span-3' : ''}>
              <label className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${checkedIds.has(item.id) ? 'bg-red-50 dark:bg-red-500/5' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'} ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={checkedIds.has(item.id)}
                  onChange={() => toggleCheck(item.id)}
                  disabled={isReadOnly}
                  className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className={`text-xs ${checkedIds.has(item.id) ? 'text-red-700 dark:text-red-400 font-medium' : 'text-slate-600 dark:text-[#d4d4d8]'}`}>{item.label}</span>
                {/* Input inline para Exame Físico / Testes Alérgicos */}
                {item.fieldType === 'input' && checkedIds.has(item.id) && (
                  <input
                    type="text"
                    value={notes[String(item.id)] || ''}
                    onChange={e => updateNote(String(item.id), e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Resultado..."
                    onClick={e => e.stopPropagation()}
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 dark:border-[#1e1e24] rounded bg-white dark:bg-[#131316] text-slate-700 dark:text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-red-400 ml-2"
                  />
                )}
              </label>
              {/* Textarea abaixo do checkbox */}
              {item.fieldType === 'textarea' && checkedIds.has(item.id) && (
                <textarea
                  value={notes[String(item.id)] || ''}
                  onChange={e => updateNote(String(item.id), e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Detalhes..."
                  rows={2}
                  className={`${inputCls} mt-1 ml-6 text-xs resize-none`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Section note (textarea de seção) */}
        {afterItemId != null && renderSectionNote(section)}

        {/* Items depois do section note */}
        {itemsAfter.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {itemsAfter.map(item => (
              <div key={item.id} className={item.fieldType ? 'col-span-2 md:col-span-3' : ''}>
                <label className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${checkedIds.has(item.id) ? 'bg-red-50 dark:bg-red-500/5' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'} ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(item.id)}
                    onChange={() => toggleCheck(item.id)}
                    disabled={isReadOnly}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span className={`text-xs ${checkedIds.has(item.id) ? 'text-red-700 dark:text-red-400 font-medium' : 'text-slate-600 dark:text-[#d4d4d8]'}`}>{item.label}</span>
                  {item.fieldType === 'input' && checkedIds.has(item.id) && (
                    <input
                      type="text"
                      value={notes[String(item.id)] || ''}
                      onChange={e => updateNote(String(item.id), e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Resultado..."
                      onClick={e => e.stopPropagation()}
                      className="flex-1 px-2 py-1 text-xs border border-slate-200 dark:border-[#1e1e24] rounded bg-white dark:bg-[#131316] text-slate-700 dark:text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-red-400 ml-2"
                    />
                  )}
                </label>
                {item.fieldType === 'textarea' && checkedIds.has(item.id) && (
                  <textarea
                    value={notes[String(item.id)] || ''}
                    onChange={e => updateNote(String(item.id), e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Detalhes..."
                    rows={2}
                    className={`${inputCls} mt-1 ml-6 text-xs resize-none`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Section note no final (quando não tem afterItemId) */}
        {afterItemId == null && section.sectionNote && renderSectionNote(section)}
      </div>
    );
  };

  // ── Loading ──
  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  // ── Agrupar seções com grupo ──
  let lastGroup = '';

  return (
    <div className="p-6 space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-500" /> Adicionar alergias
        </h2>
      </div>

      {/* Seções */}
      {ALLERGY_SECTIONS.map(section => {
        const groupHeader = section.group && section.group !== lastGroup;
        if (section.group) lastGroup = section.group;

        return (
          <div key={section.key}>
            {/* Título do grupo pai */}
            {groupHeader && (
              <h3 className="text-xs font-bold text-slate-700 dark:text-[#e4e4e7] uppercase tracking-wider mt-6 mb-3 border-b border-slate-200 dark:border-[#1e1e24] pb-2">
                {section.group}
              </h3>
            )}
            {renderSection(section)}
          </div>
        );
      })}

      {/* SEÇÃO 11: Restrições */}
      <div>
        <label className={labelCls}>Restrições</label>
        <div className={`${cardCls} p-4 space-y-3`}>
          <label className={`flex items-center gap-3 ${isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            <button
              type="button"
              onClick={() => { if (!isReadOnly) setBlocked(!blocked); }}
              disabled={isReadOnly}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${blocked ? 'bg-red-500' : 'bg-slate-300 dark:bg-[#3f3f46]'} ${isReadOnly ? 'cursor-not-allowed' : ''}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${blocked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </button>
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-[#e4e4e7] flex items-center gap-1.5">
                <Lock size={14} /> Bloquear alergias
              </span>
              {blocked && (
                <p className="text-[10px] text-slate-400 dark:text-[#52525b] mt-0.5">
                  Selecione os profissionais que você deseja permitir o acesso
                </p>
              )}
            </div>
          </label>
          {blocked && professionals.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 pl-4 pt-2 border-t border-slate-100 dark:border-[#1a1a1f]">
              {professionals.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#a1a1aa] cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={allowedProfessionals.includes(p.id)}
                    disabled={isReadOnly}
                    onChange={e => {
                      if (isReadOnly) return;
                      setAllowedProfessionals(
                        e.target.checked
                          ? [...allowedProfessionals, p.id]
                          : allowedProfessionals.filter(id => id !== p.id)
                      );
                    }}
                    className={`w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${isReadOnly ? 'cursor-not-allowed' : ''}`}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rodapé de ações (sticky) */}
      <div className="fixed bottom-0 right-0 left-64 bg-white dark:bg-[#131316] border-t border-slate-200 dark:border-[#1e1e24] p-4 flex items-center justify-between z-10">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={alertSystem}
            onChange={e => setAlertSystem(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-slate-600 dark:text-[#d4d4d8] font-medium">Alertar no sistema</span>
        </label>
        <button
          onClick={handleSave}
          disabled={isSaving || isReadOnly}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          SALVAR INFORMAÇÕES
        </button>
      </div>
    </div>
  );
}
