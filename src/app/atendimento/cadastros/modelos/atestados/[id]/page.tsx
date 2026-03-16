'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, FileText } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useCertificateTemplates } from '@/hooks/useCertificateTemplates';
import { TemplateFormPage } from '@/components/cadastros/TemplateEditorPage';
import type { CertificateTemplate } from '@/types/cadastros';

export default function EditarAtestadoPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getTemplate, updateTemplate } = useCertificateTemplates();

  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const data = await getTemplate(id);
        setTemplate(data);
      } catch {
        toast.error('Modelo não encontrado.');
        router.push('/atendimento/cadastros/modelos/atestados');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getTemplate, toast, router]);

  const handleSubmit = async (data: { name: string; content: string }) => {
    await updateTemplate(id, data);
    toast.success('Modelo de atestado atualizado com sucesso!');
    router.push('/atendimento/cadastros/modelos/atestados');
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
      title="Editar Modelo de Atestado"
      subtitle="Atualize o modelo de atestado"
      backPath="/atendimento/cadastros/modelos/atestados"
      onSubmit={handleSubmit}
      icon={<FileText className="w-5 h-5 text-teal-600" />}
    />
  );
}
