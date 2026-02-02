// src/components/medical-record/NewPatientModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useForm, UseFormRegister, FieldErrors, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  X, User, Shield, Save, Loader2, Info, Plus, 
  MapPin, Phone, HeartPulse, CreditCard, Sparkles, AlertCircle,
  Camera, Trash2, Users
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
// Importamos o Base e o Refinements separadamente para fazer o merge limpo
import { patientBaseSchema, patientRefinements } from '@/schemas/patientSchema';
import { z } from 'zod';

// --- SCHEMA EXTENDIDO ---
const insuranceSchema = z.object({
  insurance_name: z.string().optional(),
  insurance_plan: z.string().optional(),
  insurance_card: z.string().optional(),
  insurance_validity: z.string().optional(),
  insurance_accommodation: z.string().optional(),
  code: z.string().optional(),
});

// USAMOS .merge() PARA EVITAR O ERRO DE TIPO
const extendedSchema = patientBaseSchema
  .merge(insuranceSchema)
  .superRefine(patientRefinements);

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newId: number) => void;
  initialData?: {
    name?: string;
    phone?: string;
    biological_sex?: 'M' | 'F';
    parent_name?: string;
  };
  patientId?: number; // Se fornecido, está em modo edição
  inline?: boolean; // Se true, renderiza sem overlay (inline)
}

export function NewPatientModal({ isOpen, onClose, onSuccess, initialData, patientId }: NewPatientModalProps) {
  const [activeTab, setActiveTab] = useState<'personal' | 'extra' | 'insurance'>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Estado para preview da imagem
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setTimeout(() => setShowModal(true), 10);
    else {
      setShowModal(false);
      setImagePreview(null);
    }
  }, [isOpen]);

  // Hook Form
  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue, 
    reset, 
    control,
    formState: { errors } 
  } = useForm({
    resolver: zodResolver(extendedSchema),
    defaultValues: {
      name: initialData?.name || '',
      phone: initialData?.phone || '',
      biological_sex: initialData?.biological_sex || 'F',
      receive_sms_alerts: true,
      active: true,
      nationality: 'Brasileira',
      use_social_name: false,
      is_deceased: false,
      family_members: [] // Array inicial vazio
    }
  });

  // Carregar dados do paciente se estiver em modo edição
  useEffect(() => {
    if (patientId && isOpen) {
      const loadPatientData = async () => {
        const { data: patient } = await supabase
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .single();

        if (patient) {
          // Preencher formulário com dados do paciente
          setValue('name', patient.name || '');
          setValue('phone', patient.phone || '');
          setValue('biological_sex', patient.biological_sex || 'F');
          // Garantir que birth_date sempre tenha um valor (obrigatório no schema)
          setValue('birth_date', patient.birth_date || '2000-01-01');
          setValue('email', patient.email || '');
          setValue('cpf', patient.cpf || '');
          setValue('rg', patient.rg || '');
          setValue('social_name', patient.social_name || '');
          setValue('use_social_name', patient.use_social_name || false);
          setValue('gender_identity', patient.gender_identity || null);
          setValue('use_gender_identity', !!patient.gender_identity);
          setValue('address_zip', patient.address_zip || '');
          setValue('address_street', patient.address_street || '');
          setValue('address_number', patient.address_number || '');
          setValue('address_complement', patient.address_complement || '');
          setValue('address_neighborhood', patient.address_neighborhood || '');
          setValue('address_city', patient.address_city || '');
          setValue('address_state', patient.address_state || '');
          setValue('nationality', patient.nationality || 'Brasileira');
          setValue('naturality_city', patient.naturality_city || '');
          setValue('ethnicity', patient.ethnicity || '');
          setValue('marital_status', patient.marital_status || '');
          setValue('profession', patient.profession || '');
          setValue('receive_sms_alerts', patient.receive_sms_alerts ?? true);
          setValue('is_deceased', patient.is_deceased || false);
          setValue('cause_of_death', patient.cause_of_death || '');
          setValue('how_found_us', patient.how_found_us || '');
          
          if (patient.profile_picture) {
            setImagePreview(patient.profile_picture);
            // Também definir no form para manter a URL existente
            setValue('profile_picture', patient.profile_picture);
          }

          // Carregar familiares
          if (patient.family_members && Array.isArray(patient.family_members)) {
            setValue('family_members', patient.family_members);
          }
        }
      };
      loadPatientData();
    } else if (initialData) {
      // Modo criação com initialData
      if (initialData.name) setValue('name', initialData.name);
      if (initialData.phone) setValue('phone', initialData.phone);
      if (initialData.biological_sex) setValue('biological_sex', initialData.biological_sex);
      if (initialData.parent_name) {
        setValue('family_members', [{
          name: initialData.parent_name,
          relationship: 'Responsável',
          phone: ''
        }]);
      }
    }
  }, [patientId, initialData, isOpen, setValue]);

  // Array de Familiares
  const { fields, append, remove } = useFieldArray({
    control,
    name: "family_members" as any
  });

  // Watchers
  const watchZip = watch('address_zip');
  const watchUseSocialName = watch('use_social_name');
  const watchUseGenderIdentity = watch('use_gender_identity');
  const watchIsDeceased = watch('is_deceased');
  const watchBiologicalSex = watch('biological_sex');

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
          .catch(() => console.log('Erro ao buscar CEP'));
      }
    }
  }, [watchZip, setValue]);

  // Handler de Imagem
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setValue('profile_picture', file);
    }
  };

  const onSubmit = async (data: any) => {
    console.log('[NewPatientModal] onSubmit INICIADO', { patientId, hasBirthDate: !!data.birth_date, birthDate: data.birth_date });
    setIsSubmitting(true);
    try {
      console.log('[NewPatientModal] onSubmit chamado', { patientId, data: { ...data, profile_picture: data.profile_picture instanceof File ? 'File' : typeof data.profile_picture } });
      
      let photoUrl = null;

      // 1. Upload da Imagem (apenas se for um novo arquivo)
      if (data.profile_picture && data.profile_picture instanceof File) {
        const file = data.profile_picture;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `patients/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file);

        if (uploadError) {
           console.error('Erro upload imagem:', uploadError);
           // Continua sem foto se der erro no bucket
        } else {
           const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
           photoUrl = publicUrlData.publicUrl;
        }
      } else if (patientId && data.profile_picture && typeof data.profile_picture === 'string') {
        // Se estiver em modo edição e a foto for uma string (URL), manter a URL existente
        photoUrl = data.profile_picture;
      }

      // 2. Preparar Payload do Paciente
      const patientPayload = {
        name: data.name, // Nome Civil (Principal)
        
        // --- CORREÇÃO AQUI: ADICIONADO O CAMPO OBRIGATÓRIO ---
        birth_date: data.birth_date, 
        
        social_name: data.use_social_name ? data.social_name : null,
        use_social_name: data.use_social_name,

        biological_sex: data.biological_sex,
        gender_identity: data.use_gender_identity ? data.gender_identity : null,
        cpf: data.cpf,
        rg: data.rg,
        email: data.email || null,
        phone: data.phone,
        phone_work: data.phone_work,
        phone_home: data.phone_home,
        receive_sms_alerts: data.receive_sms_alerts,
        
        address_zip: data.address_zip,
        address_street: data.address_street,
        address_number: data.address_number,
        address_complement: data.address_complement || null,
        address_neighborhood: data.address_neighborhood,
        address_city: data.address_city,
        address_state: data.address_state,
        
        nationality: data.nationality,
        naturality_city: data.naturality_city,
        ethnicity: data.ethnicity || null,
        marital_status: data.marital_status || null,
        profession: data.profession,
        
        is_deceased: data.is_deceased,
        cause_of_death: data.is_deceased ? data.cause_of_death : null,
        
        // Campos Novos
        family_members: data.family_members,
        // Incluir profile_picture se houver nova foto ou se já existir uma URL
        ...(photoUrl ? { profile_picture: photoUrl } : (patientId && imagePreview && typeof imagePreview === 'string' ? { profile_picture: imagePreview } : {})),

        how_found_us: data.how_found_us || null
      };

      let updatedPatientId: number;

      if (patientId) {
        // Modo edição: atualizar paciente existente
        console.log('[NewPatientModal] Atualizando paciente', { patientId, patientPayload });
        const { data: updatedPatient, error: patientError } = await supabase
          .from('patients')
          .update(patientPayload)
          .eq('id', patientId)
          .select()
          .single();

        if (patientError) {
          console.error('[NewPatientModal] Erro ao atualizar paciente:', patientError);
          throw patientError;
        }
        console.log('[NewPatientModal] Paciente atualizado com sucesso:', updatedPatient);
        updatedPatientId = updatedPatient.id;
      } else {
        // Modo criação: inserir novo paciente
        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert(patientPayload)
          .select()
          .single();

        if (patientError) throw patientError;
        updatedPatientId = newPatient.id;

        // 3. Convênio (apenas na criação)
        if (data.insurance_name) {
          await supabase.from('patient_insurances').insert({
            patient_id: newPatient.id,
            insurance_name: data.insurance_name,
            plan_name: data.insurance_plan,
            card_number: data.insurance_card,
            validity_date: data.insurance_validity || null,
            accommodation: data.insurance_accommodation
          });
        }
      }

      console.log('[NewPatientModal] Chamando onSuccess com patientId:', updatedPatientId);
      onSuccess(updatedPatientId);
      onClose();
      reset();
      setImagePreview(null);
      
    } catch (err: any) {
      console.error('[NewPatientModal] Erro completo:', err);
      const errorMessage = err.message || err.details || 'Erro desconhecido ao salvar';
      alert('Erro ao salvar: ' + errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-300 ${showModal ? 'bg-black/40 backdrop-blur-sm' : 'bg-transparent invisible'}`}>
      
      {/* CARD DO MODAL */}
      <div className={`
        bg-white dark:bg-[#1e2028] w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden transform transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)
        ${showModal ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}
      `}>
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-gray-800 bg-white/80 dark:bg-[#1e2028]/90 backdrop-blur-md z-20">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <User className="w-5 h-5" />
              </div>
              {patientId ? 'Editar Paciente' : 'Novo Paciente'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 ml-11">
              {patientId 
                ? 'Atualize os dados do paciente abaixo' 
                : 'Preencha os dados para iniciar o prontuário'
              }
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
          
          {/* SIDEBAR */}
          <aside className="w-64 bg-slate-50/50 dark:bg-[#181a20] border-r border-slate-200/60 dark:border-gray-800 flex flex-col py-6 px-4 gap-2">
            <NavButton 
              active={activeTab === 'personal'} 
              onClick={() => setActiveTab('personal')} 
              label="Dados Pessoais" 
              desc="Identificação e Contato"
              icon={User}
            />
            <NavButton 
              active={activeTab === 'extra'} 
              onClick={() => setActiveTab('extra')} 
              label="Complementares" 
              desc="Família e Demografia"
              icon={Plus}
            />
            <NavButton 
              active={activeTab === 'insurance'} 
              onClick={() => setActiveTab('insurance')} 
              label="Convênios" 
              desc="Planos e Carteirinha"
              icon={Shield}
            />
          </aside>

          {/* MAIN FORM */}
          <main className="flex-1 overflow-y-auto bg-white dark:bg-[#1e2028] relative scroll-smooth">
            <form 
              id="patient-form" 
              onSubmit={handleSubmit(onSubmit, (errors) => {
                console.error('[NewPatientModal] Erros de validação:', errors);
                console.log('[NewPatientModal] Estado do formulário:', { 
                  patientId, 
                  isSubmitting,
                  errorsCount: Object.keys(errors).length 
                });
                // Mostrar primeiro erro encontrado
                const errorEntries = Object.entries(errors);
                if (errorEntries.length > 0) {
                  const [fieldName, error] = errorEntries[0];
                  const errorMessage = (error as any)?.message || `Campo ${fieldName} inválido`;
                  alert(`Erro de validação: ${errorMessage}`);
                } else {
                  console.warn('[NewPatientModal] handleSubmit chamado mas onSubmit não foi executado - sem erros de validação');
                }
              })} 
              className="p-8 max-w-4xl mx-auto pb-32"
            >
              
              {/* === ABA 1: DADOS PESSOAIS === */}
              {activeTab === 'personal' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                  
                  {/* IDENTIFICAÇÃO COM FOTO */}
                  <div className="space-y-6">
                    <SectionHeader icon={User} title="Identificação Básica" />
                    
                    <div className="grid grid-cols-12 gap-6">
                      
                      {/* === FOTO DE PERFIL === */}
                      <div className="col-span-12 flex flex-col items-center sm:flex-row sm:items-start gap-6 mb-4">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                           <div className={`
                             w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden flex items-center justify-center
                             ${imagePreview ? 'bg-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}
                             transition-all duration-300 group-hover:scale-105 group-hover:border-blue-200 dark:group-hover:border-blue-900
                           `}>
                             {imagePreview ? (
                               <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                             ) : (
                               <User className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                             )}
                             
                             {/* Overlay de Câmera */}
                             <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                               <Camera className="w-6 h-6 text-white" />
                             </div>
                           </div>
                           <input 
                              type="file" 
                              ref={fileInputRef} 
                              className="hidden" 
                              accept="image/*"
                              onChange={handleImageChange}
                           />
                           <p className="text-[10px] text-center mt-2 text-slate-400 font-medium">Alterar Foto</p>
                        </div>

                        <div className="flex-1 w-full grid grid-cols-12 gap-5">
                            <div className="col-span-12">
                                <ModernInput 
                                  label="Nome Completo *" 
                                  register={register} 
                                  name="name" 
                                  placeholder="Digite o nome completo"
                                  error={errors.name}
                                  autoFocus
                                />
                            </div>
                            <div className="col-span-12 md:col-span-5">
                              <ModernInput 
                                label="Data de Nascimento *" 
                                type="date" 
                                register={register} 
                                name="birth_date" 
                                error={errors.birth_date} 
                              />
                            </div>
                            <div className="col-span-12 md:col-span-7">
                                <label className="text-xs font-bold text-slate-500 dark:text-gray-400 mb-1.5 block ml-1 uppercase tracking-wider">Sexo Biológico *</label>
                                <div className="flex gap-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                  <button
                                    type="button"
                                    onClick={() => setValue('biological_sex', 'M')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all shadow-sm ${watchBiologicalSex === 'M' ? 'bg-white text-blue-600 shadow-sm dark:bg-[#2a2d36] dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                  >
                                    Masculino
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setValue('biological_sex', 'F')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all shadow-sm ${watchBiologicalSex === 'F' ? 'bg-white text-pink-600 shadow-sm dark:bg-[#2a2d36] dark:text-pink-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                  >
                                    Feminino
                                  </button>
                                </div>
                                {errors.biological_sex && <span className="text-red-500 text-[10px] ml-1 mt-1 block">{errors.biological_sex.message as string}</span>}
                            </div>
                        </div>
                      </div>

                      {/* Nome Social Switch */}
                      <div className="col-span-12 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400">
                               <Sparkles className="w-4 h-4" />
                             </div>
                             <div>
                               <label className="text-sm font-medium text-slate-700 dark:text-gray-200 block">Nome Social</label>
                               <span className="text-xs text-slate-500">O paciente prefere ser chamado por outro nome?</span>
                             </div>
                          </div>
                          <Switch register={register} name="use_social_name" />
                        </div>

                        {watchUseSocialName && (
                          <div className="animate-in slide-in-from-top-2 fade-in">
                            <ModernInput 
                              label="Nome Social (Como prefere ser chamado)" 
                              register={register} 
                              name="social_name" 
                              error={errors.social_name}
                              className="border-purple-200 focus:border-purple-500 focus:ring-purple-500/20"
                            />
                          </div>
                        )}
                      </div>

                      <div className="col-span-12 border-t border-dashed border-slate-200 dark:border-slate-700 my-1"></div>

                      <div className="col-span-12 flex flex-wrap gap-4 items-end">
                         <div className="flex items-center gap-3 py-2">
                            <Switch register={register} name="use_gender_identity" />
                            <span className="text-sm text-slate-600 dark:text-gray-300">Incluir Identidade de Gênero?</span>
                         </div>
                         {watchUseGenderIdentity && (
                            <div className="flex-1 min-w-[200px] animate-in fade-in slide-in-from-left-2">
                               <ModernSelect register={register} name="gender_identity">
                                  <option value="">Selecione...</option>
                                  <option value="trans_male">Homem Trans</option>
                                  <option value="trans_female">Mulher Trans</option>
                                  <option value="non_binary">Não-binário</option>
                                  <option value="other">Outro</option>
                               </ModernSelect>
                            </div>
                         )}
                      </div>

                      <div className="col-span-4"><ModernInput label="CPF" register={register} name="cpf" placeholder="000.000.000-00" error={errors.cpf} /></div>
                      <div className="col-span-4"><ModernInput label="RG" register={register} name="rg" /></div>
                      <div className="col-span-4">
                        <ModernSelect label="Como conheceu?" register={register} name="how_found_us">
                            <option value="">Selecione...</option>
                            <option value="google">Google</option>
                            <option value="instagram">Instagram</option>
                            <option value="indication">Indicação</option>
                        </ModernSelect>
                      </div>
                    </div>
                  </div>

                  {/* CONTATO */}
                  <div className="space-y-6 pt-4">
                    <SectionHeader icon={Phone} title="Canais de Contato" />
                    <div className="grid grid-cols-12 gap-5">
                       <div className="col-span-5"><ModernInput label="Celular (WhatsApp) *" register={register} name="phone" placeholder="(99) 99999-9999" error={errors.phone} /></div>
                       <div className="col-span-7"><ModernInput label="E-mail" type="email" register={register} name="email" error={errors.email} icon={<span className="text-slate-400">@</span>} /></div>
                       
                       <div className="col-span-12 flex items-center gap-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20">
                          <Switch register={register} name="receive_sms_alerts" />
                          <div className="flex flex-col">
                             <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Notificações Automáticas</span>
                             <span className="text-xs text-blue-600/70 dark:text-blue-400/70">Receber lembretes de consulta via SMS/WhatsApp</span>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* ENDEREÇO */}
                  <div className="space-y-6 pt-4">
                     <SectionHeader icon={MapPin} title="Localização" />
                     <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-4 md:col-span-3">
                           <ModernInput label="CEP" register={register} name="address_zip" placeholder="00000-000" />
                        </div>
                        <div className="col-span-8 md:col-span-9 flex items-end pb-1 text-xs text-slate-400">
                           * O endereço será preenchido automaticamente
                        </div>
                        
                        <div className="col-span-8"><ModernInput label="Rua / Avenida" register={register} name="address_street" /></div>
                        <div className="col-span-4"><ModernInput label="Número" register={register} name="address_number" /></div>
                        
                        <div className="col-span-6"><ModernInput label="Bairro" register={register} name="address_neighborhood" /></div>
                        <div className="col-span-4"><ModernInput label="Cidade" register={register} name="address_city" /></div>
                        <div className="col-span-2"><ModernInput label="UF" register={register} name="address_state" /></div>
                        
                        <div className="col-span-12"><ModernInput label="Complemento" register={register} name="address_complement" placeholder="Apto, Bloco, Referência..." /></div>
                     </div>
                  </div>

                </div>
              )}

              {/* === ABA 2: DADOS COMPLEMENTARES === */}
              {activeTab === 'extra' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                   
                   {/* DADOS SÓCIO-DEMOGRÁFICOS */}
                   <div className="space-y-6">
                      <SectionHeader icon={Info} title="Dados Sócio-Demográficos" />
                      <div className="grid grid-cols-12 gap-5">
                          <div className="col-span-6 md:col-span-4"><ModernInput label="Naturalidade" register={register} name="naturality_city" /></div>
                          <div className="col-span-6 md:col-span-4"><ModernInput label="Nacionalidade" register={register} name="nationality" /></div>
                          <div className="col-span-12 md:col-span-4">
                             <ModernSelect label="Etnia" register={register} name="ethnicity">
                                <option value="">Não informado</option>
                                <option value="branca">Branca</option>
                                <option value="parda">Parda</option>
                                <option value="negra">Negra</option>
                                <option value="amarela">Amarela</option>
                                <option value="indigena">Indígena</option>
                             </ModernSelect>
                          </div>
                          
                          <div className="col-span-6"><ModernInput label="Profissão" register={register} name="profession" /></div>
                          <div className="col-span-6">
                             <ModernSelect label="Estado Civil" register={register} name="marital_status">
                                <option value="">Selecione</option>
                                <option value="solteiro">Solteiro(a)</option>
                                <option value="casado">Casado(a)</option>
                                <option value="divorciado">Divorciado(a)</option>
                                <option value="viuvo">Viúvo(a)</option>
                             </ModernSelect>
                          </div>
                      </div>
                   </div>

                   {/* --- NÚCLEO FAMILIAR DINÂMICO --- */}
                   <div className="space-y-6 pt-4">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                         <div className="flex items-center gap-2">
                           <Users className="w-4 h-4 text-blue-500" />
                           <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Núcleo Familiar</h3>
                         </div>
                         <button 
                           type="button" 
                           onClick={() => append({ name: '', relationship: '', phone: '' })}
                           className="text-xs flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                         >
                           <Plus className="w-3 h-3" /> Adicionar Parente
                         </button>
                      </div>

                      {/* Lista de Parentes */}
                      <div className="space-y-3">
                        {fields.length === 0 && (
                          <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                             <p className="text-sm text-slate-500">Nenhum familiar cadastrado.</p>
                          </div>
                        )}

                        {fields.map((field, index) => (
                           <div key={field.id} className="grid grid-cols-12 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 items-start animate-in slide-in-from-left-2">
                              <div className="col-span-5">
                                 <ModernInput label="Nome" register={register} name={`family_members.${index}.name`} placeholder="Nome do familiar" />
                              </div>
                              <div className="col-span-3">
                                 <ModernSelect label="Vínculo" register={register} name={`family_members.${index}.relationship`}>
                                    <option value="">Selecione</option>
                                    <option value="Mãe">Mãe</option>
                                    <option value="Pai">Pai</option>
                                    <option value="Cônjuge">Cônjuge</option>
                                    <option value="Filho(a)">Filho(a)</option>
                                    <option value="Irmão(ã)">Irmão(ã)</option>
                                    <option value="Avó/Avô">Avó/Avô</option>
                                    <option value="Responsável">Responsável</option>
                                    <option value="Outro">Outro</option>
                                 </ModernSelect>
                              </div>
                              <div className="col-span-3">
                                 <ModernInput label="Telefone" register={register} name={`family_members.${index}.phone`} placeholder="(00) 0000-0000" />
                              </div>
                              <div className="col-span-1 pt-6 flex justify-center">
                                 <button 
                                   type="button" 
                                   onClick={() => remove(index)}
                                   className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                   title="Remover"
                                 >
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           </div>
                        ))}
                      </div>
                   </div>

                   {/* ÓBITO */}
                   <div className="mt-8 border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 rounded-xl overflow-hidden transition-all duration-300">
                      <div className="p-5 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/40 dark:text-red-400">
                               <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                               <label className="text-sm font-bold text-red-800 dark:text-red-300 block">Registro de Óbito</label>
                               <span className="text-xs text-red-600/70 dark:text-red-400/70">Marque apenas se o paciente vier a falecer</span>
                            </div>
                         </div>
                         <Switch register={register} name="is_deceased" colorClass="bg-red-500" />
                      </div>
                      
                      {watchIsDeceased && (
                          <div className="px-5 pb-5 animate-in slide-in-from-top-2">
                             <ModernInput 
                                label="Causa da Morte (CID ou Descrição)" 
                                register={register} 
                                name="cause_of_death" 
                                error={errors.cause_of_death}
                                className="bg-white dark:bg-black/20 border-red-200 focus:border-red-400 focus:ring-red-400/20"
                             />
                          </div>
                      )}
                   </div>
                </div>
              )}

              {/* === ABA 3: CONVÊNIOS === */}
              {activeTab === 'insurance' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 shadow-sm relative overflow-hidden">
                        <CreditCard className="absolute -right-6 -bottom-6 w-32 h-32 text-blue-200/50 dark:text-blue-800/30 rotate-12 pointer-events-none" />
                        
                        <h3 className="text-blue-900 dark:text-blue-100 font-bold mb-6 flex items-center gap-2 relative z-10">
                          <Shield className="w-5 h-5 text-blue-600" /> Novo Convênio
                        </h3>

                        <div className="grid grid-cols-12 gap-5 relative z-10">
                          <div className="col-span-12 md:col-span-6">
                             <ModernSelect label="Operadora" register={register} name="insurance_name">
                                <option value="">Particular / Sem Convênio</option>
                                <option value="Unimed">Unimed</option>
                                <option value="Bradesco">Bradesco Saúde</option>
                                <option value="Amil">Amil</option>
                                <option value="SulAmerica">SulAmérica</option>
                                <option value="Porto Seguro">Porto Seguro</option>
                             </ModernSelect>
                          </div>
                          <div className="col-span-12 md:col-span-6">
                             <ModernInput label="Nome do Plano" register={register} name="insurance_plan" placeholder="Ex: Especial, Básico" />
                          </div>
                          <div className="col-span-12 md:col-span-8">
                             <ModernInput label="Número da Carteirinha" register={register} name="insurance_card" icon={<CreditCard className="w-4 h-4 text-slate-400" />} />
                          </div>
                          <div className="col-span-6 md:col-span-4">
                             <ModernInput label="Validade" type="date" register={register} name="insurance_validity" />
                          </div>
                          <div className="col-span-6 md:col-span-12">
                             <ModernSelect label="Acomodação Padrão" register={register} name="insurance_accommodation">
                                <option value="">Selecione</option>
                                <option value="Enfermaria">Enfermaria</option>
                                <option value="Apartamento">Apartamento</option>
                                <option value="UTI">UTI</option>
                             </ModernSelect>
                          </div>
                        </div>
                    </div>
                </div>
              )}
            </form>
          </main>
        </div>

        {/* --- FOOTER FLUTUANTE --- */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 dark:border-gray-800 bg-white/90 dark:bg-[#1e2028]/95 backdrop-blur z-30 flex justify-between items-center">
           <div className="text-xs text-slate-400 pl-4 hidden md:block">
             <span className="text-rose-500 font-bold">*</span> Campos obrigatórios
           </div>
           <div className="flex gap-3 w-full md:w-auto justify-end px-4 md:px-0">
              <button 
                onClick={onClose} 
                className="px-6 py-2.5 text-slate-600 dark:text-gray-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              
              <button 
                type="submit"
                form="patient-form"
                disabled={isSubmitting}
                className="
                  relative overflow-hidden group px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl 
                  shadow-lg shadow-blue-500/20 hover:shadow-blue-600/40 
                  transition-all duration-300 transform active:scale-95 disabled:opacity-70 disabled:active:scale-100
                  flex items-center gap-2
                "
              >
                {/* Glow effect */}
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {patientId ? 'Salvar Alterações' : 'Salvar Paciente'}
              </button>
           </div>
        </div>

      </div>
    </div>
  );
}

// --- UI KIT REUTILIZÁVEL ---

// 1. Botão de Navegação
const NavButton = ({ active, label, desc, onClick, icon: Icon }: any) => (
  <button
    onClick={onClick}
    type="button"
    className={`
      w-full text-left p-3 rounded-xl transition-all duration-200 group relative overflow-hidden
      ${active 
        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800' 
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800'
      }
    `}
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

// 2. Input Moderno
interface ModernInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  register: UseFormRegister<any>;
  name: string;
  error?: FieldErrors | any;
  icon?: React.ReactNode;
}
const ModernInput = ({ label, register, name, error, icon, className = "", ...props }: ModernInputProps) => (
  <div className="w-full group">
    {label && <label className="text-xs font-bold text-slate-500 dark:text-gray-400 mb-1.5 ml-1 block uppercase tracking-wider transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400">{label}</label>}
    <div className="relative">
      <input
        {...register(name)}
        {...props}
        className={`
          w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-sm 
          text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-slate-600
          transition-all duration-200
          focus:bg-white dark:focus:bg-[#1a1d24] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none
          disabled:opacity-60 disabled:cursor-not-allowed
          ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10 bg-red-50/30' : ''}
          ${icon ? 'pl-9' : ''}
          ${className}
        `}
      />
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{icon}</div>}
    </div>
    {error && <span className="text-red-500 text-[10px] font-medium mt-1 ml-1 block animate-in slide-in-from-left-1">{error.message as string}</span>}
  </div>
);

// 3. Select Moderno
const ModernSelect = ({ label, register, name, children, ...props }: any) => (
  <div className="w-full group">
    {label && <label className="text-xs font-bold text-slate-500 dark:text-gray-400 mb-1.5 ml-1 block uppercase tracking-wider transition-colors group-focus-within:text-blue-600">{label}</label>}
    <div className="relative">
       <select
          {...register(name)}
          {...props}
          className="
            w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-sm 
            text-slate-700 dark:text-gray-200
            transition-all duration-200 appearance-none
            focus:bg-white dark:focus:bg-[#1a1d24] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none
            cursor-pointer
          "
       >
          {children}
       </select>
       <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
       </div>
    </div>
  </div>
);

// 4. Header de Seção
const SectionHeader = ({ icon: Icon, title }: any) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
    <Icon className="w-4 h-4 text-blue-500" />
    <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">
      {title}
    </h3>
  </div>
);

// 5. Switch Toggle
const Switch = ({ register, name, colorClass = "peer-checked:bg-blue-600" }: any) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" {...register(name)} className="sr-only peer" />
    <div className={`
      w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/30 dark:peer-focus:ring-blue-800/30 
      rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white 
      after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border 
      after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 
      ${colorClass}
    `}></div>
  </label>
);