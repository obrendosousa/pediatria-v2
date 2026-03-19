'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Briefcase, User, Stethoscope } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useProfessionals } from '@/hooks/useProfessionals';
import { createClient } from '@/lib/supabase/client';
import ProfessionalForm from '@/components/cadastros/profissionais/ProfessionalForm';
import ProfessionalProceduresTab from '@/components/cadastros/profissionais/ProfessionalProceduresTab';
import type { ProfessionalFormData } from '@/components/cadastros/profissionais/ProfessionalForm';
import type { Professional } from '@/types/cadastros';

type TabKey = 'dados' | 'procedimentos';

async function uploadAttachments(files: File[]): Promise<{ name: string; url: string }[]> {
  if (files.length === 0) return [];
  const supabase = createClient();
  const results: { name: string; url: string }[] = [];

  for (const file of files) {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await supabase.storage.from('professional-attachments').upload(path, file);
    if (error) {
      console.error('Erro ao enviar anexo:', error);
      continue;
    }
    const { data: urlData } = supabase.storage.from('professional-attachments').getPublicUrl(path);
    results.push({ name: file.name, url: urlData.publicUrl });
  }
  return results;
}

export default function EditarProfissionalPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getProfessional, updateProfessional } = useProfessionals();

  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('dados');

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const data = await getProfessional(id);
        setProfessional(data);
      } catch {
        toast.error('Profissional não encontrado.');
        router.push('/atendimento/cadastros/profissionais');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getProfessional, toast, router]);

  const handleSubmit = async (form: ProfessionalFormData) => {
    const newUploaded = await uploadAttachments(form.attachments);
    const existingAttachments = (professional?.attachments as { name: string; url: string }[]) || [];
    const allAttachments = [...existingAttachments, ...newUploaded];

    await updateProfessional(id, {
      name: form.name,
      sex: form.sex || null,
      birth_date: form.birth_date || null,
      marital_status: form.marital_status || null,
      cpf: form.cpf,
      rg: form.rg || null,
      street: form.address.street || null,
      zip_code: form.address.zip_code || null,
      state: form.address.state || null,
      city: form.address.city || null,
      neighborhood: form.address.neighborhood || null,
      number: form.address.number || null,
      complement: form.address.complement || null,
      email: form.email,
      phone: form.phone || null,
      mobile: form.mobile || null,
      whatsapp: form.whatsapp || null,
      professional_type: form.professional_type,
      specialty: form.specialty || null,
      registration_state: form.registration_state,
      registration_type: form.registration_type,
      registration_number: form.registration_number,
      schedule_access: form.schedule_access as 'view_appointment' | 'open_record',
      is_admin: form.is_admin,
      restrict_prices: form.restrict_prices,
      has_schedule: form.has_schedule,
      restrict_schedule: form.restrict_schedule,
      attachments: allAttachments,
      notes: form.notes || null,
    });

    toast.success('Profissional atualizado com sucesso!');
    router.push('/atendimento/cadastros/profissionais');
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'dados', label: 'Dados Cadastrais', icon: <User className="w-4 h-4" /> },
    { key: 'procedimentos', label: 'Procedimentos', icon: <Stethoscope className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header com botão voltar */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b]">
        <button
          onClick={() => router.push('/atendimento/cadastros/profissionais')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-teal-600" />
            {professional?.name || 'Editar Profissional'}
          </h1>
          <p className="text-xs text-slate-400 dark:text-[#71717a]">Gerencie os dados e procedimentos do profissional</p>
        </div>
      </div>

      {/* Abas */}
      <div className="px-6 py-2 border-b border-slate-200 dark:border-[#252530] bg-white dark:bg-[#08080b] flex gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'text-slate-500 dark:text-[#a1a1aa] hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'dados' && (
          <ProfessionalForm
            initialData={professional}
            title="Editar Profissional"
            subtitle="Atualize os dados do profissional"
            onSubmit={handleSubmit}
            hideHeader
          />
        )}
        {activeTab === 'procedimentos' && (
          <ProfessionalProceduresTab professionalId={id} />
        )}
      </div>
    </div>
  );
}
