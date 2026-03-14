'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useCollaborators } from '@/hooks/useCollaborators';
import CollaboratorForm from '@/components/cadastros/colaboradores/CollaboratorForm';
import type { CollaboratorFormData } from '@/components/cadastros/colaboradores/CollaboratorForm';
import type { Collaborator, CollaboratorRole, ScheduleAccess } from '@/types/cadastros';

export default function EditarColaboradorPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getCollaborator, updateCollaborator } = useCollaborators();

  const [collaborator, setCollaborator] = useState<Collaborator | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const data = await getCollaborator(id);
        setCollaborator(data);
      } catch {
        toast.error('Colaborador não encontrado.');
        router.push('/atendimento/cadastros/colaboradores');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getCollaborator, toast, router]);

  const handleSubmit = async (form: CollaboratorFormData) => {
    await updateCollaborator(id, {
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
      notes: form.notes || null,
    });

    toast.success('Colaborador atualizado com sucesso!');
    router.push('/atendimento/cadastros/colaboradores');
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <CollaboratorForm
      initialData={collaborator}
      title="Editar Colaborador"
      subtitle="Atualize os dados do colaborador"
      onSubmit={handleSubmit}
    />
  );
}
