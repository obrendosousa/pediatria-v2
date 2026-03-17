'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, FileSearch } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useReportTemplates } from '@/hooks/useReportTemplates';
import { TemplateFormPage } from '@/components/cadastros/TemplateEditorPage';
import type { ReportTemplate } from '@/types/cadastros';

export default function EditarLaudoPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getTemplate, updateTemplate } = useReportTemplates();

  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const data = await getTemplate(id);
        setTemplate(data);
      } catch {
        toast.error('Modelo não encontrado.');
        router.push('/atendimento/cadastros/modelos/laudos');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getTemplate, toast, router]);

  const handleSubmit = async (data: { name: string; content: string }) => {
    await updateTemplate(id, data);
    toast.success('Modelo de laudo atualizado com sucesso!');
    router.push('/atendimento/cadastros/modelos/laudos');
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <TemplateFormPage
      initialData={template}
      title="Editar Modelo de Laudo"
      subtitle="Atualize o modelo de laudo"
      backPath="/atendimento/cadastros/modelos/laudos"
      onSubmit={handleSubmit}
      icon={<FileSearch className="w-5 h-5 text-blue-600" />}
    />
  );
}
