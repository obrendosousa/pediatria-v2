'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useAnamnesisTemplates } from '@/hooks/useAnamnesisTemplates';
import AnamnesisForm from '@/components/cadastros/anamneses/AnamnesisForm';
import type { AnamnesisFormData } from '@/components/cadastros/anamneses/AnamnesisForm';

export default function CriarAnamnesesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createTemplate } = useAnamnesisTemplates();

  const handleSubmit = async (form: AnamnesisFormData) => {
    await createTemplate(
      {
        title: form.title.trim(),
        allow_send_on_scheduling: form.allow_send_on_scheduling,
      },
      form.questions.map((q, idx) => ({
        question: q.question,
        type: q.type,
        options: q.options,
        sort_order: idx,
      })),
    );

    toast.success('Modelo de anamnese criado com sucesso!');
    router.push('/atendimento/cadastros/modelos/anamneses');
  };

  return (
    <AnamnesisForm
      title="Novo Modelo de Anamnese"
      subtitle="Crie um questionário de anamnese"
      onSubmit={handleSubmit}
    />
  );
}
