'use client';

import React, { useState, useEffect } from 'react';
import { useForm, UseFormRegister, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X, User, Save, Loader2, MapPin, Phone,
  CreditCard, Sparkles, Users, BookOpen, Heart,
} from 'lucide-react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useToast } from '@/contexts/ToastContext';
import {
  atendimentoPatientSchema,
  type AtendimentoPatientFormData,
} from '@/schemas/atendimentoPatientSchema';
import type { AtendimentoPatient } from '@/types/atendimento-patient';

const supabase = createSchemaClient('atendimento');

type TabKey = 'personal' | 'contact' | 'address' | 'extra' | 'insurance' | 'responsible';

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId?: number | null;
}

export default function NewPatientModal({ isOpen, onClose, onSuccess, patientId }: NewPatientModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AtendimentoPatientFormData>({
    resolver: zodResolver(atendimentoPatientSchema),
    defaultValues: {
      full_name: '',
      social_name: '',
      use_social_name: false,
      sex: undefined,
      birth_date: '',
      cpf: '',
      rg: '',
      cns_number: '',
      phone: '',
      phone_work: '',
      phone_home: '',
      email: '',
      address_zip: '',
      address_street: '',
      address_number: '',
      address_complement: '',
      address_neighborhood: '',
      address_city: '',
      address_state: '',
      nationality: 'Brasileira',
      ethnicity: '',
      religion: '',
      marital_status: '',
      education_level: '',
      profession: '',
      how_found_us: '',
      insurance: '',
      insurance_plan: '',
      insurance_card_number: '',
      insurance_validity: '',
      insurance_accommodation: '',
      active: true,
      notes: '',
      mother_name: '',
      father_name: '',
      responsible_name: '',
      responsible_cpf: '',
    },
  });

  // Animação de entrada
  useEffect(() => {
    if (isOpen) setTimeout(() => setShowModal(true), 10);
    else {
      setShowModal(false);
      setActiveTab('personal');
    }
  }, [isOpen]);

  // Carregar dados em modo edição
  useEffect(() => {
    if (!patientId || !isOpen) return;
    const loadPatient = async () => {
      const { data: p } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();
      if (!p) return;
      const patient = p as AtendimentoPatient;
      setValue('full_name', patient.full_name || '');
      setValue('social_name', patient.social_name || '');
      setValue('use_social_name', patient.use_social_name || false);
      setValue('sex', patient.sex || undefined);
      setValue('birth_date', patient.birth_date || '');
      setValue('cpf', patient.cpf || '');
      setValue('rg', patient.rg || '');
      setValue('cns_number', patient.cns_number || '');
      setValue('phone', patient.phone || '');
      setValue('phone_work', patient.phone_work || '');
      setValue('phone_home', patient.phone_home || '');
      setValue('email', patient.email || '');
      // Endereço (JSONB → campos flat)
      const addr = patient.address;
      if (addr) {
        setValue('address_zip', addr.zip || '');
        setValue('address_street', addr.street || '');
        setValue('address_number', addr.number || '');
        setValue('address_complement', addr.complement || '');
        setValue('address_neighborhood', addr.neighborhood || '');
        setValue('address_city', addr.city || '');
        setValue('address_state', addr.state || '');
      }
      setValue('nationality', patient.nationality || 'Brasileira');
      setValue('ethnicity', patient.ethnicity || '');
      setValue('religion', patient.religion || '');
      setValue('marital_status', patient.marital_status || '');
      setValue('education_level', patient.education_level || '');
      setValue('profession', patient.profession || '');
      setValue('how_found_us', patient.how_found_us || '');
      setValue('insurance', patient.insurance || '');
      setValue('insurance_plan', patient.insurance_plan || '');
      setValue('insurance_card_number', patient.insurance_card_number || '');
      setValue('insurance_validity', patient.insurance_validity || '');
      setValue('insurance_accommodation', patient.insurance_accommodation || '');
      setValue('active', patient.active ?? true);
      setValue('notes', patient.notes || '');
      setValue('mother_name', patient.mother_name || '');
      setValue('father_name', patient.father_name || '');
      setValue('responsible_name', patient.responsible_name || '');
      setValue('responsible_cpf', patient.responsible_cpf || '');
    };
    loadPatient();
  }, [patientId, isOpen, setValue]);

  // Watchers
  const watchZip = watch('address_zip');
  const watchUseSocialName = watch('use_social_name');
  const watchSex = watch('sex');

  // Busca CEP
  useEffect(() => {
    if (watchZip && watchZip.length >= 8) {
      const cleanZip = watchZip.replace(/\D/g, '');
      if (cleanZip.length === 8) {
        fetch(`https://viacep.com.br/ws/${cleanZip}/json/`)
          .then(res => res.json())
          .then(data => {
            if (!data.erro) {
              setValue('address_street', data.logradouro);
              setValue('address_neighborhood', data.bairro);
              setValue('address_city', data.localidade);
              setValue('address_state', data.uf);
            }
          })
          .catch(() => {/* silencioso */});
      }
    }
  }, [watchZip, setValue]);

  // Mapear campo com erro para aba correta
  const getTabFromField = (field: string): TabKey => {
    if (['phone', 'phone_work', 'phone_home', 'email'].includes(field)) return 'contact';
    if (field.startsWith('address_')) return 'address';
    if (['nationality', 'ethnicity', 'religion', 'marital_status', 'education_level', 'profession', 'how_found_us', 'notes'].includes(field)) return 'extra';
    if (field.startsWith('insurance')) return 'insurance';
    if (['mother_name', 'father_name', 'responsible_name', 'responsible_cpf'].includes(field)) return 'responsible';
    return 'personal';
  };

  const handleInvalidSubmit = (formErrors: FieldErrors) => {
    const entries = Object.entries(formErrors);
    if (entries.length > 0) {
      const [fieldName, errorValue] = entries[0];
      setActiveTab(getTabFromField(fieldName));
      const msg = (errorValue as { message?: string })?.message || 'Campo inválido';
      toast.error(`Validação: ${msg}`);
    }
  };

  const onSubmit = async (data: AtendimentoPatientFormData) => {
    setIsSubmitting(true);
    try {
      // Serializar endereço como JSONB
      const address = (data.address_zip || data.address_street || data.address_city)
        ? {
            zip: data.address_zip || '',
            street: data.address_street || '',
            number: data.address_number || '',
            complement: data.address_complement || '',
            neighborhood: data.address_neighborhood || '',
            city: data.address_city || '',
            state: data.address_state || '',
          }
        : null;

      const payload = {
        full_name: data.full_name,
        social_name: data.use_social_name ? data.social_name : null,
        use_social_name: data.use_social_name ?? false,
        sex: data.sex || null,
        birth_date: data.birth_date || null,
        cpf: data.cpf || null,
        rg: data.rg || null,
        cns_number: data.cns_number || null,
        phone: data.phone || null,
        phone_work: data.phone_work || null,
        phone_home: data.phone_home || null,
        email: data.email || null,
        address,
        nationality: data.nationality || 'Brasileira',
        ethnicity: data.ethnicity || null,
        religion: data.religion || null,
        marital_status: data.marital_status || null,
        education_level: data.education_level || null,
        profession: data.profession || null,
        how_found_us: data.how_found_us || null,
        insurance: data.insurance || null,
        insurance_plan: data.insurance_plan || null,
        insurance_card_number: data.insurance_card_number || null,
        insurance_validity: data.insurance_validity || null,
        insurance_accommodation: data.insurance_accommodation || null,
        active: data.active ?? true,
        notes: data.notes || null,
        mother_name: data.mother_name || null,
        father_name: data.father_name || null,
        responsible_name: data.responsible_name || null,
        responsible_cpf: data.responsible_cpf || null,
      };

      if (patientId) {
        const { error } = await supabase
          .from('patients')
          .update(payload)
          .eq('id', patientId);
        if (error) throw error;
        toast.success('Paciente atualizado!');
      } else {
        const { error } = await supabase
          .from('patients')
          .insert(payload);
        if (error) throw error;
        toast.success('Paciente cadastrado!');
      }

      onSuccess();
      onClose();
      reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao salvar: ' + msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const tabs: { key: TabKey; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'personal', label: 'Dados Pessoais', desc: 'Identificação', icon: User },
    { key: 'contact', label: 'Contato', desc: 'Telefones e E-mail', icon: Phone },
    { key: 'address', label: 'Endereço', desc: 'Localização', icon: MapPin },
    { key: 'extra', label: 'Complementares', desc: 'Demografia', icon: BookOpen },
    { key: 'insurance', label: 'Convênio', desc: 'Plano de Saúde', icon: CreditCard },
    { key: 'responsible', label: 'Responsável', desc: 'Família', icon: Users },
  ];

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-300 ${showModal ? 'bg-black/40 backdrop-blur-sm' : 'bg-transparent invisible'}`}>
      <div className={`
        bg-white dark:bg-[#111118] w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden transform transition-all duration-500
        ${showModal ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}
      `}>

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-[#1e1e28] bg-white/80 dark:bg-[#111118]/90 backdrop-blur-md z-20">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <User className="w-5 h-5" />
              </div>
              {patientId ? 'Editar Paciente' : 'Novo Paciente'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#a1a1aa] mt-0.5 ml-11">
              {patientId ? 'Atualize os dados do paciente' : 'Preencha os dados para cadastrar'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="group p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-white/10"
          >
            <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-gray-200 transition-colors" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar com abas */}
          <aside className="w-56 bg-slate-50/50 dark:bg-[#181a20] border-r border-slate-200/60 dark:border-[#1e1e28] flex flex-col py-4 px-3 gap-1.5 overflow-y-auto">
            {tabs.map(t => (
              <NavButton
                key={t.key}
                active={activeTab === t.key}
                onClick={() => setActiveTab(t.key)}
                label={t.label}
                desc={t.desc}
                icon={t.icon}
              />
            ))}
          </aside>

          {/* Form */}
          <main className="flex-1 overflow-y-auto bg-white dark:bg-[#111118] relative scroll-smooth">
            <form
              id="atendimento-patient-form"
              onSubmit={handleSubmit(onSubmit, handleInvalidSubmit)}
              className="p-8 max-w-3xl mx-auto pb-32"
            >
              {/* ─── Aba 1: Dados Pessoais ─── */}
              {activeTab === 'personal' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                  <SectionHeader icon={User} title="Identificação" />
                  <div className="grid grid-cols-12 gap-5">
                    <div className="col-span-12">
                      <ModernInput
                        label="Nome Completo"
                        register={register}
                        name="full_name"
                        placeholder="Digite o nome completo"
                        error={errors.full_name}
                        requiredField
                        autoFocus
                      />
                    </div>
                    <div className="col-span-12 md:col-span-5">
                      <ModernInput
                        label="Data de Nascimento"
                        type="date"
                        register={register}
                        name="birth_date"
                        error={errors.birth_date}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-7">
                      <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 block ml-1 uppercase tracking-wider">
                        Sexo
                      </label>
                      <div className="flex gap-0 bg-slate-50 dark:bg-[#15171e] p-1 rounded-lg border border-slate-200 dark:border-slate-700/60">
                        <button
                          type="button"
                          onClick={() => setValue('sex', 'M')}
                          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all shadow-sm ${watchSex === 'M' ? 'bg-white text-blue-600 shadow-sm dark:bg-[#1a1a22] dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                          Masculino
                        </button>
                        <button
                          type="button"
                          onClick={() => setValue('sex', 'F')}
                          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all shadow-sm ${watchSex === 'F' ? 'bg-white text-pink-600 shadow-sm dark:bg-[#1a1a22] dark:text-pink-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                          Feminino
                        </button>
                      </div>
                    </div>

                    {/* Nome Social */}
                    <div className="col-span-12 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-slate-700 dark:text-gray-200 block">Nome Social</span>
                            <span className="text-xs text-slate-500">Prefere ser chamado por outro nome?</span>
                          </div>
                        </div>
                        <Switch register={register} name="use_social_name" />
                      </div>
                      {watchUseSocialName && (
                        <div className="animate-in slide-in-from-top-2 fade-in">
                          <ModernInput
                            label="Nome Social"
                            register={register}
                            name="social_name"
                            error={errors.social_name}
                          />
                        </div>
                      )}
                    </div>

                    {/* Documentos */}
                    <div className="col-span-12 border-t border-dashed border-slate-200 dark:border-slate-700 my-1" />
                    <div className="col-span-4"><ModernInput label="CPF" register={register} name="cpf" placeholder="000.000.000-00" /></div>
                    <div className="col-span-4"><ModernInput label="RG" register={register} name="rg" /></div>
                    <div className="col-span-4"><ModernInput label="CNS" register={register} name="cns_number" placeholder="Cartão Nacional de Saúde" /></div>
                  </div>
                </div>
              )}

              {/* ─── Aba 2: Contato ─── */}
              {activeTab === 'contact' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                  <SectionHeader icon={Phone} title="Canais de Contato" />
                  <div className="grid grid-cols-12 gap-5">
                    <div className="col-span-12 md:col-span-5">
                      <ModernInput label="Celular (WhatsApp)" register={register} name="phone" placeholder="(99) 99999-9999" error={errors.phone} />
                    </div>
                    <div className="col-span-12 md:col-span-7">
                      <ModernInput label="E-mail" type="email" register={register} name="email" error={errors.email} />
                    </div>
                    <div className="col-span-6">
                      <ModernInput label="Telefone Comercial" register={register} name="phone_work" placeholder="(99) 9999-9999" />
                    </div>
                    <div className="col-span-6">
                      <ModernInput label="Telefone Residencial" register={register} name="phone_home" placeholder="(99) 9999-9999" />
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Aba 3: Endereço ─── */}
              {activeTab === 'address' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                  <SectionHeader icon={MapPin} title="Localização" />
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-4 md:col-span-3">
                      <ModernInput label="CEP" register={register} name="address_zip" placeholder="00000-000" />
                    </div>
                    <div className="col-span-8 md:col-span-9 flex items-end pb-1 text-xs text-slate-400">
                      * Endereço preenchido automaticamente pelo CEP
                    </div>
                    <div className="col-span-8"><ModernInput label="Rua / Avenida" register={register} name="address_street" /></div>
                    <div className="col-span-4"><ModernInput label="Número" register={register} name="address_number" /></div>
                    <div className="col-span-6"><ModernInput label="Bairro" register={register} name="address_neighborhood" /></div>
                    <div className="col-span-4"><ModernInput label="Cidade" register={register} name="address_city" /></div>
                    <div className="col-span-2"><ModernInput label="UF" register={register} name="address_state" /></div>
                    <div className="col-span-12"><ModernInput label="Complemento" register={register} name="address_complement" placeholder="Apto, Bloco, Referência..." /></div>
                  </div>
                </div>
              )}

              {/* ─── Aba 4: Complementares ─── */}
              {activeTab === 'extra' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                  <SectionHeader icon={BookOpen} title="Dados Complementares" />
                  <div className="grid grid-cols-12 gap-5">
                    <div className="col-span-6 md:col-span-4"><ModernInput label="Nacionalidade" register={register} name="nationality" /></div>
                    <div className="col-span-6 md:col-span-4">
                      <ModernSelect label="Etnia" register={register} name="ethnicity">
                        <option value="">Não informado</option>
                        <option value="branca">Branca</option>
                        <option value="parda">Parda</option>
                        <option value="negra">Negra</option>
                        <option value="amarela">Amarela</option>
                        <option value="indigena">Indígena</option>
                      </ModernSelect>
                    </div>
                    <div className="col-span-12 md:col-span-4">
                      <ModernInput label="Religião" register={register} name="religion" />
                    </div>
                    <div className="col-span-6">
                      <ModernSelect label="Estado Civil" register={register} name="marital_status">
                        <option value="">Selecione</option>
                        <option value="solteiro">Solteiro(a)</option>
                        <option value="casado">Casado(a)</option>
                        <option value="divorciado">Divorciado(a)</option>
                        <option value="viuvo">Viúvo(a)</option>
                        <option value="uniao_estavel">União Estável</option>
                      </ModernSelect>
                    </div>
                    <div className="col-span-6">
                      <ModernSelect label="Escolaridade" register={register} name="education_level">
                        <option value="">Selecione</option>
                        <option value="fundamental_incompleto">Fundamental Incompleto</option>
                        <option value="fundamental_completo">Fundamental Completo</option>
                        <option value="medio_incompleto">Médio Incompleto</option>
                        <option value="medio_completo">Médio Completo</option>
                        <option value="superior_incompleto">Superior Incompleto</option>
                        <option value="superior_completo">Superior Completo</option>
                        <option value="pos_graduacao">Pós-Graduação</option>
                      </ModernSelect>
                    </div>
                    <div className="col-span-6"><ModernInput label="Profissão" register={register} name="profession" /></div>
                    <div className="col-span-6">
                      <ModernSelect label="Como conheceu?" register={register} name="how_found_us">
                        <option value="">Selecione...</option>
                        <option value="google">Google</option>
                        <option value="instagram">Instagram</option>
                        <option value="facebook">Facebook</option>
                        <option value="indicacao">Indicação</option>
                        <option value="convenio">Convênio</option>
                        <option value="outros">Outros</option>
                      </ModernSelect>
                    </div>
                    <div className="col-span-12">
                      <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider">
                        Observações
                      </label>
                      <textarea
                        {...register('notes')}
                        rows={3}
                        className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-gray-200 placeholder:text-slate-400 transition-all duration-200 focus:bg-white dark:focus:bg-[#1a1d24] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none resize-none"
                        placeholder="Observações gerais sobre o paciente..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Aba 5: Convênio ─── */}
              {activeTab === 'insurance' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                  <SectionHeader icon={CreditCard} title="Convênio / Plano de Saúde" />
                  <div className="grid grid-cols-12 gap-5">
                    <div className="col-span-6"><ModernInput label="Convênio" register={register} name="insurance" placeholder="Nome do convênio" /></div>
                    <div className="col-span-6"><ModernInput label="Plano" register={register} name="insurance_plan" /></div>
                    <div className="col-span-4"><ModernInput label="Nº Carteirinha" register={register} name="insurance_card_number" /></div>
                    <div className="col-span-4"><ModernInput label="Validade" type="date" register={register} name="insurance_validity" /></div>
                    <div className="col-span-4">
                      <ModernSelect label="Acomodação" register={register} name="insurance_accommodation">
                        <option value="">Selecione</option>
                        <option value="Enfermaria">Enfermaria</option>
                        <option value="Apartamento">Apartamento</option>
                        <option value="UTI">UTI</option>
                      </ModernSelect>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Aba 6: Responsável ─── */}
              {activeTab === 'responsible' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                  <SectionHeader icon={Heart} title="Família e Responsável" />
                  <div className="grid grid-cols-12 gap-5">
                    <div className="col-span-6"><ModernInput label="Nome da Mãe" register={register} name="mother_name" /></div>
                    <div className="col-span-6"><ModernInput label="Nome do Pai" register={register} name="father_name" /></div>
                    <div className="col-span-12 border-t border-dashed border-slate-200 dark:border-slate-700 my-1" />
                    <div className="col-span-6"><ModernInput label="Responsável Legal" register={register} name="responsible_name" /></div>
                    <div className="col-span-6"><ModernInput label="CPF do Responsável" register={register} name="responsible_cpf" placeholder="000.000.000-00" /></div>
                  </div>
                </div>
              )}
            </form>
          </main>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 dark:border-[#1e1e28] bg-white/90 dark:bg-[#111118]/95 backdrop-blur z-30 flex justify-between items-center">
          <div className="text-xs text-slate-400 pl-4 hidden md:block">
            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 mr-1 align-middle">Obrigatório</span>
            Destaque nos campos obrigatórios
          </div>
          <div className="flex gap-3 w-full md:w-auto justify-end px-4 md:px-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-slate-600 dark:text-[#d4d4d8] font-semibold text-sm hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="atendimento-patient-form"
              disabled={isSubmitting}
              className="relative overflow-hidden group px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-600/40 transition-all duration-300 transform active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center gap-2"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {patientId ? 'Salvar Alterações' : 'Salvar Paciente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── UI Kit (blue theme) ────────────────────────────────────────────────────

const NavButton = ({ active, label, desc, onClick, icon: Icon }: {
  active: boolean; label: string; desc: string; onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <button
    onClick={onClick}
    type="button"
    className={`w-full text-left p-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
      active
        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800'
    }`}
  >
    <div className="flex items-start gap-3 relative z-10">
      <div className={`mt-0.5 p-1.5 rounded-lg transition-colors ${active ? 'bg-blue-200/50 dark:bg-blue-800/50' : 'bg-slate-200/50 dark:bg-slate-800'}`}>
        <Icon className={`w-4 h-4 ${active ? 'text-blue-600 dark:text-blue-300' : 'text-slate-400'}`} />
      </div>
      <div>
        <span className="block text-sm font-bold">{label}</span>
        <span className={`text-[10px] block mt-0.5 ${active ? 'text-blue-600/70 dark:text-blue-300/70' : 'text-slate-400'}`}>
          {desc}
        </span>
      </div>
    </div>
    {active && <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-full" />}
  </button>
);

interface ModernInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  register: UseFormRegister<AtendimentoPatientFormData>;
  name: keyof AtendimentoPatientFormData;
  error?: FieldErrors[string];
  icon?: React.ReactNode;
  requiredField?: boolean;
}

const ModernInput = ({ label, register, name, error, icon, className = '', requiredField = false, ...props }: ModernInputProps) => (
  <div className="w-full group">
    {label && (
      <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400">
        <span>{label}</span>
        {requiredField && (
          <span className="ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 align-middle">
            Obrigatório
          </span>
        )}
      </label>
    )}
    <div className="relative">
      <input
        {...register(name)}
        {...props}
        className={`w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all duration-200 focus:bg-white dark:focus:bg-[#1a1d24] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
          requiredField ? 'border-amber-300/80 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-900/10' : ''
        } ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10 bg-red-50/30' : ''} ${icon ? 'pl-9' : ''} ${className}`}
      />
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{icon}</div>}
    </div>
    {error && <span className="text-red-500 text-[10px] font-medium mt-1 ml-1 block animate-in slide-in-from-left-1">{(error as { message?: string }).message}</span>}
  </div>
);

const ModernSelect = ({ label, register, name, children }: {
  label?: string;
  register: UseFormRegister<AtendimentoPatientFormData>;
  name: keyof AtendimentoPatientFormData;
  children: React.ReactNode;
}) => (
  <div className="w-full group">
    {label && <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider transition-colors group-focus-within:text-blue-600">{label}</label>}
    <div className="relative">
      <select
        {...register(name)}
        className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-gray-200 transition-all duration-200 appearance-none focus:bg-white dark:focus:bg-[#1a1d24] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none cursor-pointer"
      >
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
      </div>
    </div>
  </div>
);

const SectionHeader = ({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
    <Icon className="w-4 h-4 text-blue-500" />
    <h3 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide">{title}</h3>
  </div>
);

const Switch = ({ register, name }: { register: UseFormRegister<AtendimentoPatientFormData>; name: keyof AtendimentoPatientFormData }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" {...register(name)} className="sr-only peer" />
    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/30 dark:peer-focus:ring-blue-800/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
  </label>
);
