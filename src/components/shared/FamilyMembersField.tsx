'use client';

import { Users, Plus, Trash2 } from 'lucide-react';
import { GUARDIAN_RELATIONSHIPS, type FamilyMember } from '@/constants/guardianRelationships';
import type { UseFormRegister, Control, FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove } from 'react-hook-form';

// Modo react-hook-form (useFieldArray)
interface RHFModeProps {
  mode: 'rhf';
  register: UseFormRegister<Record<string, unknown>>;
  control?: Control<Record<string, unknown>>;
  fields: FieldArrayWithId[];
  append: UseFieldArrayAppend<Record<string, unknown>>;
  remove: UseFieldArrayRemove;
  fieldName?: string;
  value?: never;
  onChange?: never;
}

// Modo controlled (useState)
interface ControlledModeProps {
  mode: 'controlled';
  value: FamilyMember[];
  onChange: (members: FamilyMember[]) => void;
  register?: never;
  control?: never;
  fields?: never;
  append?: never;
  remove?: never;
  fieldName?: never;
}

type FamilyMembersFieldProps = (RHFModeProps | ControlledModeProps) & {
  showCpf?: boolean;
  compact?: boolean;
  title?: string;
};

const inputClass = "w-full px-3 py-2 border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400";
const labelClass = "block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#a1a1aa] mb-1";
const selectClass = "w-full px-3 py-2 border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none";

function ControlledRow({ member, index, onUpdate, onRemove, showCpf, compact }: {
  member: FamilyMember;
  index: number;
  onUpdate: (index: number, field: keyof FamilyMember, value: string | boolean) => void;
  onRemove: (index: number) => void;
  showCpf?: boolean;
  compact?: boolean;
}) {
  const cols = showCpf ? 'grid-cols-12' : (compact ? 'grid-cols-11' : 'grid-cols-12');

  return (
    <div className={`grid ${cols} gap-2 ${compact ? 'p-3' : 'p-4'} bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 items-start`}>
      <div className={compact ? 'col-span-4' : 'col-span-5'}>
        <label className={labelClass}>Nome</label>
        <input
          type="text"
          value={member.name}
          onChange={(e) => onUpdate(index, 'name', e.target.value)}
          placeholder="Nome do responsável"
          className={inputClass}
        />
      </div>
      <div className="col-span-3">
        <label className={labelClass}>Vínculo</label>
        <select
          value={member.relationship}
          onChange={(e) => onUpdate(index, 'relationship', e.target.value)}
          className={selectClass}
        >
          <option value="">Selecione</option>
          {GUARDIAN_RELATIONSHIPS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <div className={compact ? 'col-span-3' : 'col-span-3'}>
        <label className={labelClass}>Telefone</label>
        <input
          type="text"
          value={member.phone || ''}
          onChange={(e) => onUpdate(index, 'phone', e.target.value)}
          placeholder="(00) 00000-0000"
          className={inputClass}
        />
      </div>
      {showCpf && (
        <div className="col-span-2">
          <label className={labelClass}>CPF</label>
          <input
            type="text"
            value={member.cpf || ''}
            onChange={(e) => onUpdate(index, 'cpf', e.target.value)}
            placeholder="000.000.000-00"
            className={inputClass}
          />
        </div>
      )}
      <div className="col-span-1 pt-5 flex justify-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
          title="Remover"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function RHFRow({ index, register, fieldId, showCpf, compact, onRemove }: {
  index: number;
  register: UseFormRegister<Record<string, unknown>>;
  fieldId: string;
  showCpf?: boolean;
  compact?: boolean;
  onRemove: () => void;
}) {
  const fieldName = 'family_members';
  const cols = showCpf ? 'grid-cols-12' : (compact ? 'grid-cols-11' : 'grid-cols-12');

  return (
    <div key={fieldId} className={`grid ${cols} gap-2 ${compact ? 'p-3' : 'p-4'} bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 items-start animate-in slide-in-from-left-2`}>
      <div className={compact ? 'col-span-4' : 'col-span-5'}>
        <label className={labelClass}>Nome</label>
        <input
          {...register(`${fieldName}.${index}.name` as never)}
          type="text"
          placeholder="Nome do responsável"
          className={inputClass}
        />
      </div>
      <div className="col-span-3">
        <label className={labelClass}>Vínculo</label>
        <select
          {...register(`${fieldName}.${index}.relationship` as never)}
          className={selectClass}
        >
          <option value="">Selecione</option>
          {GUARDIAN_RELATIONSHIPS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <div className={compact ? 'col-span-3' : 'col-span-3'}>
        <label className={labelClass}>Telefone</label>
        <input
          {...register(`${fieldName}.${index}.phone` as never)}
          type="text"
          placeholder="(00) 00000-0000"
          className={inputClass}
        />
      </div>
      {showCpf && (
        <div className="col-span-2">
          <label className={labelClass}>CPF</label>
          <input
            {...register(`${fieldName}.${index}.cpf` as never)}
            type="text"
            placeholder="000.000.000-00"
            className={inputClass}
          />
        </div>
      )}
      <div className="col-span-1 pt-5 flex justify-center">
        <button
          type="button"
          onClick={onRemove}
          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
          title="Remover"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function FamilyMembersField(props: FamilyMembersFieldProps) {
  const { showCpf = false, compact = false, title = 'Responsáveis / Familiares' } = props;

  const handleAdd = () => {
    const empty: FamilyMember = { name: '', relationship: '', phone: '' };
    if (props.mode === 'rhf') {
      props.append(empty as unknown as Record<string, unknown>);
    } else {
      props.onChange([...props.value, empty]);
    }
  };

  const handleControlledUpdate = (index: number, field: keyof FamilyMember, value: string | boolean) => {
    if (props.mode !== 'controlled') return;
    const updated = [...props.value];
    updated[index] = { ...updated[index], [field]: value };
    props.onChange(updated);
  };

  const handleControlledRemove = (index: number) => {
    if (props.mode !== 'controlled') return;
    const updated = props.value.filter((_, i) => i !== index);
    props.onChange(updated);
  };

  const items = props.mode === 'rhf' ? props.fields : props.value;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide">{title}</h3>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="text-xs flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" /> Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">Nenhum responsável cadastrado.</p>
          </div>
        )}

        {props.mode === 'rhf'
          ? props.fields.map((field, index) => (
              <RHFRow
                key={field.id}
                index={index}
                register={props.register}
                fieldId={field.id}
                showCpf={showCpf}
                compact={compact}
                onRemove={() => props.remove(index)}
              />
            ))
          : props.value.map((member, index) => (
              <ControlledRow
                key={index}
                member={member}
                index={index}
                onUpdate={handleControlledUpdate}
                onRemove={handleControlledRemove}
                showCpf={showCpf}
                compact={compact}
              />
            ))
        }
      </div>
    </div>
  );
}
