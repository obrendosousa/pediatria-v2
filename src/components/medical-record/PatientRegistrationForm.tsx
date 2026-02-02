'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  User, Shield, Save, Loader2, Info, Plus, 
  MapPin, Phone, CreditCard, Sparkles, AlertCircle,
  Camera, Trash2, Users, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/types/medical';
import { patientBaseSchema, patientRefinements } from '@/schemas/patientSchema';
import { z } from 'zod';
import { formatCPF, cleanCPF, formatPhone, cleanPhone, formatCEP, cleanCEP, cleanRG } from '@/utils/formatUtils';
import { linkPatientByPhone, addPhoneToPatient } from '@/utils/patientRelations';

// --- SCHEMA EXTENDIDO ---
const insuranceSchema = z.object({
  insurance_name: z.string().optional(),
  insurance_plan: z.string().optional(),
  insurance_card: z.string().optional(),
  insurance_validity: z.string().optional(),
  insurance_accommodation: z.string().optional(),
  code: z.string().optional(),
});

const extendedSchema = patientBaseSchema
  .merge(insuranceSchema)
  .superRefine(patientRefinements);

interface PatientRegistrationFormProps {
  appointment: Appointment;
  onCancel: () => void;
  onSuccess: (newId: number) => void;
}

// Componentes auxiliares
function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 px-1">
      <Icon className="w-5 h-5 text-rose-500" />
      <h2 className="text-lg font-bold text-slate-700 dark:text-gray-200">{title}</h2>
    </div>
  );
}

function ModernInput({ label, register, name, type = 'text', placeholder, error, icon, className = '', autoFocus = false, format, control }: any) {
  // Se há format, usar Controller para gerenciar o valor
  if (format && control) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider ml-1 block">
          {label}
        </label>
        <div className="relative">
          {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>}
          <Controller
            name={name}
            control={control}
            render={({ field }) => {
              const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const inputValue = e.target.value;
                const formatted = format(inputValue);
                field.onChange(formatted);
              };
              
              return (
                <input
                  name={field.name}
                  value={field.value || ''}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  type={type}
                  placeholder={placeholder}
                  autoFocus={autoFocus}
                  onChange={handleChange}
                  className={`
                    w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg 
                    bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 
                    focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 
                    transition-all ${className}
                    ${error ? 'border-red-300 dark:border-red-700' : ''}
                  `}
                />
              );
            }}
          />
        </div>
        {error && <span className="text-red-500 text-[10px] ml-1 block">{error.message as string}</span>}
      </div>
    );
  }
  
  // Caso contrário, usar register normalmente
  const registerResult = register(name);
  
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider ml-1 block">
        {label}
      </label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>}
        <input
          {...registerResult}
          type={type}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`
            w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg 
            bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 
            focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 
            transition-all ${className}
            ${error ? 'border-red-300 dark:border-red-700' : ''}
          `}
        />
      </div>
      {error && <span className="text-red-500 text-[10px] ml-1 block">{error.message as string}</span>}
    </div>
  );
}

function ModernSelect({ label, register, name, children, error }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider ml-1 block">
        {label}
      </label>
      <select
        {...register(name)}
        className={`
          w-full pl-3 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg 
          bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 
          focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 
          transition-all
          ${error ? 'border-red-300 dark:border-red-700' : ''}
        `}
      >
        {children}
      </select>
      {error && <span className="text-red-500 text-[10px] ml-1 block">{error.message as string}</span>}
    </div>
  );
}

function Switch({ register, name, colorClass = 'bg-blue-500' }: any) {
  const [checked, setChecked] = useState(false);
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        {...register(name)}
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="sr-only peer"
      />
      <div className={`
        w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-pink-300 
        dark:peer-focus:ring-pink-800 rounded-full peer dark:bg-gray-700 
        peer-checked:after:translate-x-full peer-checked:after:border-white 
        after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
        after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 
        after:transition-all dark:border-gray-600 peer-checked:${colorClass}
      `}></div>
    </label>
  );
}

export function PatientRegistrationForm({ appointment, onCancel, onSuccess, chatId }: PatientRegistrationFormProps) {
  const [activeTab, setActiveTab] = useState<'personal' | 'extra' | 'insurance'>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue, 
    control,
    formState: { errors } 
  } = useForm({
    resolver: zodResolver(extendedSchema),
    defaultValues: {
      name: appointment.patient_name || '',
      phone: appointment.patient_phone || '',
      biological_sex: appointment.patient_sex || 'F',
      receive_sms_alerts: true,
      active: true,
      nationality: 'Brasileira',
      use_social_name: false,
      is_deceased: false,
      family_members: appointment.parent_name ? [{
        name: appointment.parent_name,
        relationship: 'Responsável',
        phone: ''
      }] : []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "family_members" as any
  });

  const watchZip = watch('address_zip');
  const watchUseSocialName = watch('use_social_name');
  const watchUseGenderIdentity = watch('use_gender_identity');
  const watchIsDeceased = watch('is_deceased');
  const watchBiologicalSex = watch('biological_sex');

  // Busca CEP
  useEffect(() => {
    if (watchZip) {
      const cleanZip = cleanCEP(watchZip);
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
          .catch(() => {});
      }
    }
  }, [watchZip, setValue]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      let photoUrl = null;
      if (imagePreview && fileInputRef.current?.files?.[0]) {
        const file = fileInputRef.current.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `patients/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('patient-photos')
          .upload(filePath, file);

        if (!uploadError) {
          const { data: publicUrlData } = await supabase.storage
            .from('patient-photos')
            .getPublicUrl(filePath);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      // Limpar formatação dos campos antes de salvar
      const cleanFamilyMembers = (data.family_members || []).map((member: any) => ({
        ...member,
        phone: member.phone ? cleanPhone(member.phone) : null
      }));

      const patientPayload = {
        name: data.name,
        birth_date: data.birth_date,
        social_name: data.use_social_name ? data.social_name : null,
        use_social_name: data.use_social_name,
        biological_sex: data.biological_sex,
        gender_identity: data.use_gender_identity ? data.gender_identity : null,
        cpf: data.cpf ? cleanCPF(data.cpf) : null,
        rg: data.rg ? cleanRG(data.rg) : null,
        email: data.email || null,
        phone: cleanPhone(data.phone),
        phone_work: data.phone_work ? cleanPhone(data.phone_work) : null,
        phone_home: data.phone_home ? cleanPhone(data.phone_home) : null,
        receive_sms_alerts: data.receive_sms_alerts,
        address_zip: data.address_zip ? cleanCEP(data.address_zip) : null,
        address_street: data.address_street || null,
        address_number: data.address_number || null,
        address_complement: data.address_complement || null,
        address_neighborhood: data.address_neighborhood || null,
        address_city: data.address_city || null,
        address_state: data.address_state || null,
        nationality: data.nationality || 'Brasileira',
        naturality_city: data.naturality_city || null,
        ethnicity: data.ethnicity || null,
        marital_status: data.marital_status || null,
        profession: data.profession || null,
        is_deceased: data.is_deceased || false,
        cause_of_death: data.is_deceased ? (data.cause_of_death || null) : null,
        family_members: cleanFamilyMembers,
        profile_picture: photoUrl,
        how_found_us: data.how_found_us || null
      };

      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert(patientPayload)
        .select()
        .single();

      if (patientError) throw patientError;

      // Adicionar número do appointment à tabela patient_phones
      if (appointment.patient_phone) {
        await addPhoneToPatient(
          newPatient.id,
          appointment.patient_phone,
          'appointment',
          true // Primeiro número é principal
        );
      }

      // Adicionar número do formulário se diferente
      if (data.phone && cleanPhone(data.phone) !== cleanPhone(appointment.patient_phone || '')) {
        await addPhoneToPatient(
          newPatient.id,
          data.phone,
          'patient_registration',
          false
        );
      }

      // Vincular appointment ao paciente
      if (appointment.id) {
        await supabase
          .from('appointments')
          .update({ patient_id: newPatient.id })
          .eq('id', appointment.id);
      }

      // Vincular chat ao paciente se disponível
      if (chatId) {
        await supabase
          .from('chats')
          .update({ patient_id: newPatient.id })
          .eq('id', chatId);
        
        // Adicionar número do chat se diferente
        const { data: chatData } = await supabase
          .from('chats')
          .select('phone')
          .eq('id', chatId)
          .single();
        
        if (chatData?.phone) {
          const chatPhoneClean = cleanPhone(chatData.phone);
          const patientPhoneClean = cleanPhone(data.phone);
          const appointmentPhoneClean = cleanPhone(appointment.patient_phone || '');
          
          if (chatPhoneClean !== patientPhoneClean && chatPhoneClean !== appointmentPhoneClean) {
            await addPhoneToPatient(
              newPatient.id,
              chatData.phone,
              'chat',
              false
            );
          }
        }
      }

      // Convênio
      if (data.insurance_name) {
        await supabase.from('patient_insurances').insert({
          patient_id: newPatient.id,
          insurance_name: data.insurance_name,
          insurance_plan: data.insurance_plan,
          insurance_card: data.insurance_card,
          insurance_validity: data.insurance_validity,
          insurance_accommodation: data.insurance_accommodation
        });
      }

      onSuccess(newPatient.id);
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-[#181a20]">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <User className="w-4 h-4" />
            </div>
            Cadastrar Paciente
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 ml-9">
            Complete os dados para iniciar o prontuário
          </p>
        </div>
        <button 
          onClick={onCancel} 
          className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 bg-slate-50/50 dark:bg-[#181a20] border-r border-slate-200 dark:border-gray-800 flex flex-col py-4 px-3 gap-2">
          <button
            onClick={() => setActiveTab('personal')}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-3 ${
              activeTab === 'personal'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <User className="w-4 h-4" />
            <div className="flex-1">
              <div className="text-sm font-semibold">Dados Pessoais</div>
              <div className="text-[10px] text-slate-500 dark:text-gray-500">Identificação</div>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('extra')}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-3 ${
              activeTab === 'extra'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Plus className="w-4 h-4" />
            <div className="flex-1">
              <div className="text-sm font-semibold">Complementares</div>
              <div className="text-[10px] text-slate-500 dark:text-gray-500">Família</div>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('insurance')}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-3 ${
              activeTab === 'insurance'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Shield className="w-4 h-4" />
            <div className="flex-1">
              <div className="text-sm font-semibold">Convênios</div>
              <div className="text-[10px] text-slate-500 dark:text-gray-500">Planos</div>
            </div>
          </button>
        </aside>

        {/* Main Form */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-[#1e2028]">
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 max-w-4xl mx-auto pb-24">
            {activeTab === 'personal' && (
              <div className="space-y-6">
                <SectionHeader icon={User} title="Identificação Básica" />
                
                <div className="grid grid-cols-12 gap-5">
                  <div className="col-span-12 flex items-start gap-6 mb-4">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className={`
                        w-20 h-20 rounded-full border-2 border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center
                        ${imagePreview ? 'bg-white' : 'bg-slate-100 dark:bg-slate-800'}
                        transition-all duration-300 group-hover:scale-105
                      `}>
                        {imagePreview ? (
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                          <Camera className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                      <p className="text-[10px] text-center mt-1 text-slate-400">Alterar Foto</p>
                    </div>

                    <div className="flex-1 grid grid-cols-12 gap-4">
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
                        <label className="text-xs font-bold text-slate-500 dark:text-gray-400 mb-1.5 block ml-1 uppercase">Sexo Biológico *</label>
                        <div className="flex gap-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setValue('biological_sex', 'M')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                              watchBiologicalSex === 'M' 
                                ? 'bg-white text-blue-600 shadow-sm dark:bg-[#2a2d36] dark:text-blue-400' 
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            Masculino
                          </button>
                          <button
                            type="button"
                            onClick={() => setValue('biological_sex', 'F')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                              watchBiologicalSex === 'F' 
                                ? 'bg-white text-pink-600 shadow-sm dark:bg-[#2a2d36] dark:text-pink-400' 
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            Feminino
                          </button>
                        </div>
                        {errors.biological_sex && <span className="text-red-500 text-[10px] ml-1 mt-1 block">{errors.biological_sex.message as string}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
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
                    <div className="col-span-12">
                      <ModernInput 
                        label="Nome Social" 
                        register={register} 
                        name="social_name" 
                        error={errors.social_name}
                      />
                    </div>
                  )}

                  <div className="col-span-12 flex items-center gap-3">
                    <Switch register={register} name="use_gender_identity" />
                    <span className="text-sm text-slate-600 dark:text-gray-300">Incluir Identidade de Gênero?</span>
                  </div>

                  {watchUseGenderIdentity && (
                    <div className="col-span-12">
                      <ModernSelect register={register} name="gender_identity">
                        <option value="">Selecione...</option>
                        <option value="trans_male">Homem Trans</option>
                        <option value="trans_female">Mulher Trans</option>
                        <option value="non_binary">Não-binário</option>
                        <option value="other">Outro</option>
                      </ModernSelect>
                    </div>
                  )}

                  <div className="col-span-4">
                    <ModernInput 
                      label="CPF" 
                      register={register} 
                      name="cpf" 
                      placeholder="000.000.000-00" 
                      error={errors.cpf}
                      format={formatCPF}
                      control={control}
                    />
                  </div>
                  <div className="col-span-4">
                    <ModernInput label="RG" register={register} name="rg" />
                  </div>
                  <div className="col-span-4">
                    <ModernSelect label="Como conheceu?" register={register} name="how_found_us">
                      <option value="">Selecione...</option>
                      <option value="google">Google</option>
                      <option value="instagram">Instagram</option>
                      <option value="indication">Indicação</option>
                    </ModernSelect>
                  </div>
                </div>

                <SectionHeader icon={Phone} title="Canais de Contato" />
                <div className="grid grid-cols-12 gap-5">
                  <div className="col-span-5">
                    <ModernInput 
                      label="Celular (WhatsApp) *" 
                      register={register} 
                      name="phone" 
                      placeholder="(99) 99999-9999" 
                      error={errors.phone}
                      format={formatPhone}
                      control={control}
                    />
                  </div>
                  <div className="col-span-7">
                    <ModernInput label="E-mail" type="email" register={register} name="email" error={errors.email} />
                  </div>
                  <div className="col-span-12 flex items-center gap-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20">
                    <Switch register={register} name="receive_sms_alerts" />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Notificações Automáticas</span>
                      <span className="text-xs text-blue-600/70 dark:text-blue-400/70">Receber lembretes via SMS/WhatsApp</span>
                    </div>
                  </div>
                </div>

                <SectionHeader icon={MapPin} title="Localização" />
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-4">
                    <ModernInput 
                      label="CEP" 
                      register={register} 
                      name="address_zip" 
                      placeholder="00000-000"
                      format={formatCEP}
                      control={control}
                    />
                  </div>
                  <div className="col-span-8 flex items-end pb-1 text-xs text-slate-400">
                    * O endereço será preenchido automaticamente
                  </div>
                  <div className="col-span-8">
                    <ModernInput label="Rua / Avenida" register={register} name="address_street" />
                  </div>
                  <div className="col-span-4">
                    <ModernInput label="Número" register={register} name="address_number" />
                  </div>
                  <div className="col-span-6">
                    <ModernInput label="Bairro" register={register} name="address_neighborhood" />
                  </div>
                  <div className="col-span-4">
                    <ModernInput label="Cidade" register={register} name="address_city" />
                  </div>
                  <div className="col-span-2">
                    <ModernInput label="UF" register={register} name="address_state" />
                  </div>
                  <div className="col-span-12">
                    <ModernInput label="Complemento" register={register} name="address_complement" placeholder="Apto, Bloco..." />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'extra' && (
              <div className="space-y-6">
                <SectionHeader icon={Info} title="Dados Sócio-Demográficos" />
                <div className="grid grid-cols-12 gap-5">
                  <div className="col-span-4">
                    <ModernInput label="Naturalidade" register={register} name="naturality_city" />
                  </div>
                  <div className="col-span-4">
                    <ModernInput label="Nacionalidade" register={register} name="nationality" />
                  </div>
                  <div className="col-span-4">
                    <ModernSelect label="Etnia" register={register} name="ethnicity">
                      <option value="">Não informado</option>
                      <option value="branca">Branca</option>
                      <option value="parda">Parda</option>
                      <option value="negra">Negra</option>
                      <option value="amarela">Amarela</option>
                      <option value="indigena">Indígena</option>
                    </ModernSelect>
                  </div>
                  <div className="col-span-6">
                    <ModernInput label="Profissão" register={register} name="profession" />
                  </div>
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

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase">Núcleo Familiar</h3>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => append({ name: '', relationship: '', phone: '' })}
                      className="text-xs flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Adicionar
                    </button>
                  </div>

                  <div className="space-y-3">
                    {fields.length === 0 && (
                      <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-sm text-slate-500">Nenhum familiar cadastrado.</p>
                      </div>
                    )}

                    {fields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-12 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
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
                          <ModernInput 
                            label="Telefone" 
                            register={register} 
                            name={`family_members.${index}.phone`} 
                            placeholder="(00) 0000-0000"
                            format={formatPhone}
                            setValue={setValue}
                            watch={watch}
                          />
                        </div>
                        <div className="col-span-1 pt-6 flex justify-center">
                          <button 
                            type="button" 
                            onClick={() => remove(index)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'insurance' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <h3 className="text-blue-900 dark:text-blue-100 font-bold mb-6 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" /> Novo Convênio
                  </h3>
                  <div className="grid grid-cols-12 gap-5">
                    <div className="col-span-6">
                      <ModernSelect label="Operadora" register={register} name="insurance_name">
                        <option value="">Particular / Sem Convênio</option>
                        <option value="Unimed">Unimed</option>
                        <option value="Bradesco">Bradesco Saúde</option>
                        <option value="Amil">Amil</option>
                        <option value="SulAmerica">SulAmérica</option>
                        <option value="Porto Seguro">Porto Seguro</option>
                      </ModernSelect>
                    </div>
                    <div className="col-span-6">
                      <ModernInput label="Nome do Plano" register={register} name="insurance_plan" placeholder="Ex: Especial, Básico" />
                    </div>
                    <div className="col-span-8">
                      <ModernInput label="Número da Carteirinha" register={register} name="insurance_card" />
                    </div>
                    <div className="col-span-4">
                      <ModernInput label="Validade" type="date" register={register} name="insurance_validity" />
                    </div>
                    <div className="col-span-12">
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

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-slate-200 dark:border-gray-800 bg-white/90 dark:bg-[#1e2028]/95 backdrop-blur z-30 flex justify-between items-center">
              <div className="text-xs text-slate-400 pl-4">
                <span className="text-rose-500 font-bold">*</span> Campos obrigatórios
              </div>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={onCancel} 
                  className="px-6 py-2.5 text-slate-600 dark:text-gray-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Paciente
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
