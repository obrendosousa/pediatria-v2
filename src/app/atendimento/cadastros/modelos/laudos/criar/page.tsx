'use client';

import { useRouter } from 'next/navigation';
import { FileSearch } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useReportTemplates } from '@/hooks/useReportTemplates';
import { TemplateFormPage } from '@/components/cadastros/TemplateEditorPage';

export default function CriarLaudoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createTemplate } = useReportTemplates();

  const handleSubmit = async (data: { name: string; content: string }) => {
    await createTemplate(data);
    toast.success('Modelo de laudo criado com sucesso!');
    router.push('/atendimento/cadastros/modelos/laudos');
  };

  return (
    <TemplateFormPage
      title="Novo Modelo de Laudo"
      subtitle="Crie um modelo de laudo com variáveis"
      backPath="/atendimento/cadastros/modelos/laudos"
      onSubmit={handleSubmit}
      icon={<FileSearch className="w-5 h-5 text-blue-600" />}
    />
  );
}
