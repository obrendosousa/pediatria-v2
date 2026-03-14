'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useProfessionals } from '@/hooks/useProfessionals';
import ProfessionalForm from '@/components/cadastros/profissionais/ProfessionalForm';
import type { ProfessionalFormData } from '@/components/cadastros/profissionais/ProfessionalForm';

export default function CriarProfissionalPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createProfessional } = useProfessionals();

  const handleSubmit = async (form: ProfessionalFormData) => {
    await createProfessional({
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
      attachments: [],
      notes: form.notes || null,
      status: 'active',
    });

    toast.success('Profissional cadastrado com sucesso!');
    router.push('/atendimento/cadastros/profissionais');
  };

  return (
    <ProfessionalForm
      title="Novo Profissional"
      subtitle="Preencha os dados do profissional"
      onSubmit={handleSubmit}
    />
  );
}
