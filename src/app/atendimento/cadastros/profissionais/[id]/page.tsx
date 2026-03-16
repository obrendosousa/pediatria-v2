'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useProfessionals } from '@/hooks/useProfessionals';
import { createClient } from '@/lib/supabase/client';
import ProfessionalForm from '@/components/cadastros/profissionais/ProfessionalForm';
import type { ProfessionalFormData } from '@/components/cadastros/profissionais/ProfessionalForm';
import type { Professional } from '@/types/cadastros';

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
    // Upload new files and merge with existing saved attachments
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
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <ProfessionalForm
      initialData={professional}
      title="Editar Profissional"
      subtitle="Atualize os dados do profissional"
      onSubmit={handleSubmit}
    />
  );
}
