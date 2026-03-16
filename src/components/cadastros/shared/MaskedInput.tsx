'use client';

import { useCallback } from 'react';

// --- Tipos ---

export type MaskType = 'cpf' | 'phone' | 'mobile' | 'cep';

export interface MaskedInputProps {
  mask: MaskType;
  value: string;
  onChange: (raw: string, formatted: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

// --- Configuração de máscaras ---

const MASK_CONFIG: Record<MaskType, { pattern: string; maxRaw: number; placeholder: string }> = {
  cpf:    { pattern: '999.999.999-99',    maxRaw: 11, placeholder: '000.000.000-00' },
  phone:  { pattern: '(99) 9999-9999',    maxRaw: 10, placeholder: '(00) 0000-0000' },
  mobile: { pattern: '(99) 99999-9999',   maxRaw: 11, placeholder: '(00) 00000-0000' },
  cep:    { pattern: '99999-999',          maxRaw: 8,  placeholder: '00000-000' },
};

// --- Funções de formatação ---

function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function applyMask(raw: string, maskType: MaskType): string {
  const digits = stripNonDigits(raw).slice(0, MASK_CONFIG[maskType].maxRaw);

  switch (maskType) {
    case 'cpf': {
      let result = digits;
      if (digits.length > 3) result = digits.slice(0, 3) + '.' + digits.slice(3);
      if (digits.length > 6) result = result.slice(0, 7) + '.' + digits.slice(6);
      if (digits.length > 9) result = result.slice(0, 11) + '-' + digits.slice(9);
      return result;
    }
    case 'phone': {
      let result = digits;
      if (digits.length > 0) result = '(' + digits;
      if (digits.length > 2) result = '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
      if (digits.length > 6) result = '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
      return result;
    }
    case 'mobile': {
      let result = digits;
      if (digits.length > 0) result = '(' + digits;
      if (digits.length > 2) result = '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
      if (digits.length > 7) result = '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
      return result;
    }
    case 'cep': {
      let result = digits;
      if (digits.length > 5) result = digits.slice(0, 5) + '-' + digits.slice(5);
      return result;
    }
  }
}

// --- Componente ---

export default function MaskedInput({
  mask,
  value,
  onChange,
  label,
  error,
  required = false,
  placeholder,
  disabled = false,
  name,
  id,
  className = '',
}: MaskedInputProps) {
  const config = MASK_CONFIG[mask];
  const formatted = applyMask(value, mask);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = stripNonDigits(e.target.value).slice(0, config.maxRaw);
    const newFormatted = applyMask(raw, mask);
    onChange(raw, newFormatted);
  }, [mask, config.maxRaw, onChange]);

  const inputId = id ?? name ?? `masked-${mask}`;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-[#d4d4d8] mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        value={formatted}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder ?? config.placeholder}
        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 transition-colors ${
          error
            ? 'border-red-300 dark:border-red-700 focus:ring-red-400'
            : 'border-slate-200 dark:border-[#2e2e33] focus:ring-teal-400'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      {error && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
