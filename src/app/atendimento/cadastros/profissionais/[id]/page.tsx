'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useProfessionals } from '@/hooks/useProfessionals';
import ProfessionalForm from '@/components/cadastros/profissionais/ProfessionalForm';
import type { ProfessionalFormData } from '@/components/cadastros/profissionais/ProfessionalForm';
import type { Professional } from '@/types/cadastros';

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
