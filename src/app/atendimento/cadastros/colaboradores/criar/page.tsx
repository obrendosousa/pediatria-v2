'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useCollaborators } from '@/hooks/useCollaborators';
import CollaboratorForm from '@/components/cadastros/colaboradores/CollaboratorForm';
import type { CollaboratorFormData } from '@/components/cadastros/colaboradores/CollaboratorForm';
import type { CollaboratorRole, ScheduleAccess } from '@/types/cadastros';

export default function CriarColaboradorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createCollaborator } = useCollaborators();

  const handleSubmit = async (form: CollaboratorFormData) => {
    await createCollaborator({
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
      role: form.role as CollaboratorRole,
      schedule_access: form.schedule_access as ScheduleAccess,
      is_admin: form.is_admin,
      attachments: [],
      notes: form.notes || null,
      status: 'active',
    });

    toast.success('Colaborador cadastrado com sucesso!');
    router.push('/atendimento/cadastros/colaboradores');
  };

  return (
    <CollaboratorForm
      title="Novo Colaborador"
      subtitle="Preencha os dados do colaborador"
      onSubmit={handleSubmit}
    />
  );
}
