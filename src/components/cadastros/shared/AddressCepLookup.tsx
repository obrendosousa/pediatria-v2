'use client';

import { useState, useCallback } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import MaskedInput from './MaskedInput';

// --- Tipos ---

export interface AddressData {
  zip_code: string;
  street: string;
  state: string;
  city: string;
  neighborhood: string;
  number: string;
  complement: string;
}

export const EMPTY_ADDRESS: AddressData = {
  zip_code: '', street: '', state: '', city: '',
  neighborhood: '', number: '', complement: '',
};

export interface AddressCepLookupProps {
  value: AddressData;
  onChange: (data: AddressData) => void;
  disabled?: boolean;
}

// --- Estados brasileiros ---

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;

// --- Componente ---

export default function AddressCepLookup({ value, onChange, disabled = false }: AddressCepLookupProps) {
  const [loading, setLoading] = useState(false);
  const [cepError, setCepError] = useState('');

  const update = useCallback((field: keyof AddressData, val: string) => {
    onChange({ ...value, [field]: val });
  }, [value, onChange]);

  const lookupCep = useCallback(async (raw: string) => {
    update('zip_code', raw);
    setCepError('');

    if (raw.length !== 8) return;

    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();

      if (data.erro) {
        setCepError('CEP não encontrado.');
        return;
      }

      onChange({
        ...value,
        zip_code: raw,
        street: data.logradouro || value.street,
        neighborhood: data.bairro || value.neighborhood,
        city: data.localidade || value.city,
        state: data.uf || value.state,
      });
    } catch {
      setCepError('Erro ao buscar CEP.');
    } finally {
      setLoading(false);
    }
  }, [value, onChange, update]);

  const inputClass = 'w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-4 h-4 text-teal-500" />
        <h4 className="text-sm font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wide">
          Endereço e Localização
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* CEP */}
        <div className="relative">
          <MaskedInput
            mask="cep"
            value={value.zip_code}
            onChange={(raw) => lookupCep(raw)}
            label="CEP"
            error={cepError}
            disabled={disabled}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-8 w-4 h-4 text-teal-500 animate-spin" />
          )}
        </div>

        {/* Estado */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-[#d4d4d8] mb-1">Estado</label>
          <select
            value={value.state}
            onChange={e => update('state', e.target.value)}
            disabled={disabled}
            className={inputClass}
          >
            <option value="">Selecione</option>
            {UF_OPTIONS.map(uf => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>

        {/* Cidade */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-[#d4d4d8] mb-1">Cidade</label>
          <input
            type="text"
            value={value.city}
            onChange={e => update('city', e.target.value)}
            disabled={disabled}
            placeholder="Cidade"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Logradouro */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-[#d4d4d8] mb-1">Logradouro</label>
          <input
            type="text"
            value={value.street}
            onChange={e => update('street', e.target.value)}
            disabled={disabled}
            placeholder="Rua, Avenida..."
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Bairro */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-[#d4d4d8] mb-1">Bairro</label>
          <input
            type="text"
            value={value.neighborhood}
            onChange={e => update('neighborhood', e.target.value)}
            disabled={disabled}
            placeholder="Bairro"
            className={inputClass}
          />
        </div>

        {/* Número */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-[#d4d4d8] mb-1">Número</label>
          <input
            type="text"
            value={value.number}
            onChange={e => update('number', e.target.value)}
            disabled={disabled}
            placeholder="Nº"
            className={inputClass}
          />
        </div>

        {/* Complemento */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-[#d4d4d8] mb-1">Complemento</label>
          <input
            type="text"
            value={value.complement}
            onChange={e => update('complement', e.target.value)}
            disabled={disabled}
            placeholder="Apto, sala..."
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
