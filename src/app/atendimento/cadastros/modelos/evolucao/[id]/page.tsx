'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Activity } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useEvolutionTemplates } from '@/hooks/useEvolutionTemplates';
import { TemplateFormPage } from '@/components/cadastros/TemplateEditorPage';
import type { EvolutionTemplate } from '@/types/cadastros';

export default function EditarEvolucaoPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getTemplate, updateTemplate } = useEvolutionTemplates();

  const [template, setTemplate] = useState<EvolutionTemplate | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const data = await getTemplate(id);
        setTemplate(data);
      } catch {
        toast.error('Modelo não encontrado.');
        router.push('/atendimento/cadastros/modelos/evolucao');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getTemplate, toast, router]);

  const handleSubmit = async (data: { name: string; content: string }) => {
    await updateTemplate(id, data);
    toast.success('Modelo de evolução atualizado com sucesso!');
    router.push('/atendimento/cadastros/modelos/evolucao');
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <TemplateFormPage
      initialData={template}
      title="Editar Modelo de Evolução"
      subtitle="Atualize o modelo de evolução"
      backPath="/atendimento/cadastros/modelos/evolucao"
      onSubmit={handleSubmit}
      icon={<Activity className="w-5 h-5 text-teal-600" />}
      extended
      hideVariables
    />
  );
}
