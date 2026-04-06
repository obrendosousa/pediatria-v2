'use client';

import { ChevronDown } from 'lucide-react';
import {
  PROCEDURE_TYPES,
  APPLICATION_ROUTES,
  inputClass,
  selectClass,
  labelClass,
  type ProcedureFormData,
} from './types';

function RequiredBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">
      Obrigatório
    </span>
  );
}

interface Props {
  form: ProcedureFormData;
  errors: Record<string, string>;
  onUpdate: <K extends keyof ProcedureFormData>(key: K, value: ProcedureFormData[K]) => void;
}

export default function ProcedureBasicData({ form, errors, onUpdate }: Props) {
  const isInjectable = form.procedure_type === 'injectable';

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* Nome */}
      <div className="col-span-12 md:col-span-5">
        <label className={labelClass}>Nome <RequiredBadge /></label>
        <input
          type="text"
          value={form.name}
          onChange={e => onUpdate('name', e.target.value)}
          placeholder="Nome do procedimento"
          className={`${inputClass} ${errors.name ? 'border-red-300 dark:border-red-700' : ''}`}
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
      </div>

      {/* Tipo */}
      <div className={`col-span-6 ${isInjectable ? 'md:col-span-2' : 'md:col-span-4'}`}>
        <label className={labelClass}>Tipo <RequiredBadge /></label>
        <div className="relative">
          <select
            value={form.procedure_type}
            onChange={e => {
              onUpdate('procedure_type', e.target.value);
              if (e.target.value !== 'injectable') onUpdate('way_id', '');
            }}
            className={`${selectClass} ${errors.procedure_type ? 'border-red-300 dark:border-red-700' : ''}`}
          >
            <option value="">Selecione</option>
            {PROCEDURE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        {errors.procedure_type && <p className="mt-1 text-xs text-red-500">{errors.procedure_type}</p>}
      </div>

      {/* Via de Aplicacao (condicional) */}
      {isInjectable && (
        <div className="col-span-6 md:col-span-3">
          <label className={labelClass}>Via de aplicação <RequiredBadge /></label>
          <div className="relative">
            <select
              value={form.way_id}
              onChange={e => onUpdate('way_id', e.target.value)}
              className={`${selectClass} ${errors.way_id ? 'border-red-300 dark:border-red-700' : ''}`}
            >
              <option value="">Selecione</option>
              {APPLICATION_ROUTES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          {errors.way_id && <p className="mt-1 text-xs text-red-500">{errors.way_id}</p>}
        </div>
      )}

      {/* Duracao */}
      <div className={`col-span-6 ${isInjectable ? 'md:col-span-2' : 'md:col-span-3'}`}>
        <label className={labelClass}>Duração (min) <RequiredBadge /></label>
        <input
          type="number"
          min={1}
          value={form.duration_minutes}
          onChange={e => onUpdate('duration_minutes', Math.max(1, Number(e.target.value)))}
          className={`${inputClass} text-center ${errors.duration_minutes ? 'border-red-300 dark:border-red-700' : ''}`}
        />
        {errors.duration_minutes && <p className="mt-1 text-xs text-red-500">{errors.duration_minutes}</p>}
      </div>
    </div>
  );
}
