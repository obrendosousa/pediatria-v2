'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Search, X, Loader2,
  FileText, User, ClipboardList,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useToast } from '@/contexts/ToastContext';
import { useInvoices } from '@/hooks/atendimento/useInvoices';
import type { TaxpayerAddress } from '@/types/invoice';

const supabase = createSchemaClient('atendimento');

type PatientOption = { id: number; full_name: string; phone?: string | null };

const SERVICE_OPTIONS = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'procedimento', label: 'Procedimento' },
  { value: 'exame', label: 'Exame' },
  { value: 'outros', label: 'Outros' },
];

// Máscara CPF/CNPJ
function maskDoc(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskCep(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.replace(/(\d{5})(\d{1,3})/, '$1-$2');
}

export default function GerarNfePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createInvoice, isSaving } = useInvoices();

  // ── Paciente (select com busca) ──────────────────────────
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<PatientOption[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const patientRef = useRef<HTMLDivElement>(null);

  // ── Dados do Tomador ─────────────────────────────────────
  const [taxpayerDoc, setTaxpayerDoc] = useState('');
  const [taxpayerName, setTaxpayerName] = useState('');
  const [taxpayerEmail, setTaxpayerEmail] = useState('');
  const [cep, setCep] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [bairro, setBairro] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');

  // ── Informações da Nota ──────────────────────────────────
  const [serviceDescription, setServiceDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [taxInss, setTaxInss] = useState<number>(0);
  const [taxIr, setTaxIr] = useState<number>(0);
  const [taxCofins, setTaxCofins] = useState<number>(0);
  const [taxPis, setTaxPis] = useState<number>(0);
  const [taxCsll, setTaxCsll] = useState<number>(0);
  const [serviceCode, setServiceCode] = useState('consulta');
  const [issRetained, setIssRetained] = useState(false);
  const [sendByEmail, setSendByEmail] = useState(true);

  // ── Busca de pacientes (debounce 300ms) ──────────────────
  useEffect(() => {
    const trimmed = patientSearch.trim();
    if (!trimmed || trimmed.length < 2) {
      const t = setTimeout(() => { setPatientResults([]); setPatientLoading(false); }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      setPatientLoading(true);
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone')
        .or(`full_name.ilike.%${trimmed.replace(/[%_\\]/g, '\\$&')}%,phone.ilike.%${trimmed.replace(/[%_\\]/g, '\\$&')}%`)
        .order('full_name')
        .limit(15);
      setPatientResults(data || []);
      setPatientLoading(false);
      setPatientDropdownOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // Click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) setPatientDropdownOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectPatient = useCallback((p: PatientOption) => {
    setSelectedPatient(p);
    setPatientSearch('');
    setPatientDropdownOpen(false);
  }, []);

  const handleClearPatient = useCallback(() => {
    setSelectedPatient(null);
    setPatientSearch('');
  }, []);

  // ── Busca CEP ────────────────────────────────────────────
  useEffect(() => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
        .then(res => res.json())
        .then(data => {
          if (!data.erro) {
            setEndereco(data.logradouro || '');
            setBairro(data.bairro || '');
            setCidade(data.localidade || '');
            setEstado(data.uf || '');
          }
        })
        .catch(() => {/* silencioso */});
    }
  }, [cep]);

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedPatient) { toast.error('Selecione um paciente.'); return; }
    if (!serviceDescription.trim()) { toast.error('Informe a descrição do serviço.'); return; }
    if (!amount || amount <= 0) { toast.error('Informe o valor da nota.'); return; }

    const taxpayerAddress: TaxpayerAddress = {
      cep: cep.replace(/\D/g, '') || undefined,
      estado: estado || undefined,
      cidade: cidade || undefined,
      bairro: bairro || undefined,
      endereco: endereco || undefined,
      numero: numero || undefined,
      complemento: complemento || undefined,
    };

    try {
      await createInvoice({
        patient_id: selectedPatient.id,
        taxpayer_doc: taxpayerDoc.replace(/\D/g, '') || undefined,
        taxpayer_name: taxpayerName || undefined,
        taxpayer_email: taxpayerEmail || undefined,
        taxpayer_address: taxpayerAddress,
        service_description: serviceDescription.trim(),
        notes: notes || undefined,
        amount,
        tax_inss: taxInss,
        tax_ir: taxIr,
        tax_cofins: taxCofins,
        tax_pis: taxPis,
        tax_csll: taxCsll,
        service_code: serviceCode,
        generated_by: undefined,
        iss_retained: issRetained,
        send_by_email: sendByEmail,
      });
      toast.success('NF-e gerada com sucesso! Aguarde a emissão.');
      router.push('/atendimento/financeiro/nfe');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao gerar NF-e: ' + msg);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118]">
        <button
          onClick={() => router.push('/atendimento/financeiro/nfe')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Gerar NF-e
          </h1>
          <p className="text-xs text-slate-400 dark:text-[#71717a]">Preencha os dados para emissão da nota fiscal</p>
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ─── Paciente ─── */}
          <section className="bg-white dark:bg-[#111118] rounded-xl border border-slate-200 dark:border-[#252530] p-6">
            <div ref={patientRef}>
              <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider">
                Paciente <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">Obrigatório</span>
              </label>
              {selectedPatient ? (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300">
                    {selectedPatient.full_name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">{selectedPatient.full_name}</p>
                    {selectedPatient.phone && <p className="text-xs text-slate-500">{selectedPatient.phone}</p>}
                  </div>
                  <button onClick={handleClearPatient} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    placeholder="Buscar paciente por nome ou telefone..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {patientLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 animate-spin" />}

                  {patientDropdownOpen && patientResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-[#1a1a22] border border-slate-200 dark:border-[#252530] rounded-xl shadow-xl">
                      {patientResults.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectPatient(p)}
                          className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                            {p.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-gray-200">{p.full_name}</p>
                            {p.phone && <p className="text-xs text-slate-400">{p.phone}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ─── Seção 1: Dados do Tomador ─── */}
          <section className="bg-white dark:bg-[#111118] rounded-xl border border-slate-200 dark:border-[#252530] p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Dados do Tomador
            </h2>

            <div className="grid grid-cols-12 gap-4">
              {/* CPF/CNPJ */}
              <div className="col-span-12 md:col-span-4">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">CPF/CNPJ</label>
                <input
                  type="text"
                  value={taxpayerDoc}
                  onChange={e => setTaxpayerDoc(maskDoc(e.target.value))}
                  maxLength={18}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Nome */}
              <div className="col-span-12 md:col-span-5">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Nome / Razão Social</label>
                <input
                  type="text"
                  value={taxpayerName}
                  onChange={e => setTaxpayerName(e.target.value)}
                  placeholder="Nome do tomador"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* E-mail */}
              <div className="col-span-12 md:col-span-3">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">E-mail</label>
                <input
                  type="email"
                  value={taxpayerEmail}
                  onChange={e => setTaxpayerEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* CEP */}
              <div className="col-span-6 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">CEP</label>
                <input
                  type="text"
                  value={cep}
                  onChange={e => setCep(maskCep(e.target.value))}
                  maxLength={9}
                  placeholder="00000-000"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Estado */}
              <div className="col-span-6 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Estado</label>
                <input
                  type="text"
                  value={estado}
                  onChange={e => setEstado(e.target.value)}
                  maxLength={2}
                  placeholder="UF"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Cidade */}
              <div className="col-span-6 md:col-span-4">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Cidade</label>
                <input
                  type="text"
                  value={cidade}
                  onChange={e => setCidade(e.target.value)}
                  placeholder="Cidade"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Bairro */}
              <div className="col-span-6 md:col-span-4">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Bairro</label>
                <input
                  type="text"
                  value={bairro}
                  onChange={e => setBairro(e.target.value)}
                  placeholder="Bairro"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Endereço */}
              <div className="col-span-12 md:col-span-6">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Endereço</label>
                <input
                  type="text"
                  value={endereco}
                  onChange={e => setEndereco(e.target.value)}
                  placeholder="Rua, Av..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Número */}
              <div className="col-span-4 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Número</label>
                <input
                  type="text"
                  value={numero}
                  onChange={e => setNumero(e.target.value)}
                  placeholder="Nº"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Complemento */}
              <div className="col-span-8 md:col-span-4">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Complemento</label>
                <input
                  type="text"
                  value={complemento}
                  onChange={e => setComplemento(e.target.value)}
                  placeholder="Apto, Sala..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          </section>

          {/* ─── Seção 2: Informações da Nota ─── */}
          <section className="bg-white dark:bg-[#111118] rounded-xl border border-slate-200 dark:border-[#252530] p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              Informações da Nota
            </h2>

            <div className="grid grid-cols-12 gap-4">
              {/* Descrição do serviço */}
              <div className="col-span-12">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">
                  Descrição do Serviço <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">Obrigatório</span>
                </label>
                <textarea
                  value={serviceDescription}
                  onChange={e => setServiceDescription(e.target.value)}
                  rows={3}
                  placeholder="Descreva o serviço prestado..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>

              {/* Observações */}
              <div className="col-span-12">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Observações</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Observações adicionais..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>

              {/* Valor da nota */}
              <div className="col-span-6 md:col-span-3">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">
                  Valor da Nota (R$) <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">Obrigatório</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={amount || ''}
                  onChange={e => setAmount(Number(e.target.value))}
                  placeholder="0,00"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-right font-mono"
                />
              </div>

              {/* Serviço */}
              <div className="col-span-6 md:col-span-3">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Serviço</label>
                <select
                  value={serviceCode}
                  onChange={e => setServiceCode(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none cursor-pointer"
                >
                  {SERVICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Impostos */}
              <div className="col-span-12">
                <p className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-2 ml-1 uppercase tracking-wider">Impostos (opcional)</p>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 mb-1 ml-1 block">INSS</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={taxInss || ''}
                      onChange={e => setTaxInss(Number(e.target.value))}
                      placeholder="0,00"
                      className="w-full px-2 py-2 text-xs border border-slate-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-right font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 mb-1 ml-1 block">IR</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={taxIr || ''}
                      onChange={e => setTaxIr(Number(e.target.value))}
                      placeholder="0,00"
                      className="w-full px-2 py-2 text-xs border border-slate-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-right font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 mb-1 ml-1 block">COFINS</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={taxCofins || ''}
                      onChange={e => setTaxCofins(Number(e.target.value))}
                      placeholder="0,00"
                      className="w-full px-2 py-2 text-xs border border-slate-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-right font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 mb-1 ml-1 block">PIS</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={taxPis || ''}
                      onChange={e => setTaxPis(Number(e.target.value))}
                      placeholder="0,00"
                      className="w-full px-2 py-2 text-xs border border-slate-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-right font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 mb-1 ml-1 block">CSLL</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={taxCsll || ''}
                      onChange={e => setTaxCsll(Number(e.target.value))}
                      placeholder="0,00"
                      className="w-full px-2 py-2 text-xs border border-slate-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-right font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="col-span-12 flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={issRetained}
                    onChange={e => setIssRetained(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-[#d4d4d8]">ISS retido na fonte</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendByEmail}
                    onChange={e => setSendByEmail(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-[#d4d4d8]">Enviar nota por e-mail</span>
                </label>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer fixo */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118] flex items-center justify-end gap-3">
        <button
          onClick={() => router.push('/atendimento/financeiro/nfe')}
          className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#d4d4d8] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          GERAR NF-E
        </button>
      </div>
    </div>
  );
}
