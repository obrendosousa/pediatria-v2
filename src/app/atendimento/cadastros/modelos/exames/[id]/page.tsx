'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useExamTemplates } from '@/hooks/useExamTemplates';
import ExamForm from '@/components/cadastros/exames/ExamForm';
import type { ExamFormData } from '@/components/cadastros/exames/ExamForm';
import type { ExamTemplate } from '@/types/cadastros';

export default function EditarExamePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getTemplate, updateTemplate } = useExamTemplates();

  const [template, setTemplate] = useState<ExamTemplate | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const data = await getTemplate(id);
        setTemplate(data);
      } catch {
        toast.error('Modelo não encontrado.');
        router.push('/atendimento/cadastros/modelos/exames');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getTemplate, toast, router]);

  const handleSubmit = async (form: ExamFormData) => {
    await updateTemplate(id, form);
    toast.success('Modelo de exame atualizado com sucesso!');
    router.push('/atendimento/cadastros/modelos/exames');
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <ExamForm
      initialData={template}
      title="Editar Modelo de Exame"
      subtitle="Atualize o modelo de exame"
      onSubmit={handleSubmit}
    />
  );
}
