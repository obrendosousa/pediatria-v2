'use client';

import { useRouter } from 'next/navigation';
import { Apple } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useDietTemplates } from '@/hooks/useDietTemplates';
import { TemplateFormPage } from '@/components/cadastros/TemplateEditorPage';

export default function CriarDietaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createTemplate } = useDietTemplates();

  const handleSubmit = async (data: { name: string; content: string }) => {
    await createTemplate(data);
    toast.success('Modelo de dieta criado com sucesso!');
    router.push('/atendimento/cadastros/modelos/dietas');
  };

  return (
    <TemplateFormPage
      title="Novo Modelo de Dieta"
      subtitle="Crie um modelo de dieta com variáveis"
      backPath="/atendimento/cadastros/modelos/dietas"
      onSubmit={handleSubmit}
      icon={<Apple className="w-5 h-5 text-blue-600" />}
    />
  );
}
