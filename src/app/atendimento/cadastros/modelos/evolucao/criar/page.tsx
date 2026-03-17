'use client';

import { useRouter } from 'next/navigation';
import { Activity } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useEvolutionTemplates } from '@/hooks/useEvolutionTemplates';
import { TemplateFormPage } from '@/components/cadastros/TemplateEditorPage';

export default function CriarEvolucaoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createTemplate } = useEvolutionTemplates();

  const handleSubmit = async (data: { name: string; content: string }) => {
    await createTemplate(data);
    toast.success('Modelo de evolução criado com sucesso!');
    router.push('/atendimento/cadastros/modelos/evolucao');
  };

  return (
    <TemplateFormPage
      title="Novo Modelo de Evolução"
      subtitle="Crie um modelo de evolução com editor estendido"
      backPath="/atendimento/cadastros/modelos/evolucao"
      onSubmit={handleSubmit}
      icon={<Activity className="w-5 h-5 text-blue-600" />}
      extended
      hideVariables
    />
  );
}
