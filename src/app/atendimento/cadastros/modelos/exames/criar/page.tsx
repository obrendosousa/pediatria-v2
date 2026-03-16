'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useExamTemplates } from '@/hooks/useExamTemplates';
import ExamForm from '@/components/cadastros/exames/ExamForm';
import type { ExamFormData } from '@/components/cadastros/exames/ExamForm';

export default function CriarExamePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createTemplate } = useExamTemplates();

  const handleSubmit = async (form: ExamFormData) => {
    await createTemplate(form);
    toast.success('Modelo de exame criado com sucesso!');
    router.push('/atendimento/cadastros/modelos/exames');
  };

  return (
    <ExamForm
      title="Novo Modelo de Exame"
      subtitle="Crie um modelo de exame com categorias"
      onSubmit={handleSubmit}
    />
  );
}
