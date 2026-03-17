'use client';

import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useCertificateTemplates } from '@/hooks/useCertificateTemplates';
import { TemplateFormPage } from '@/components/cadastros/TemplateEditorPage';

export default function CriarAtestadoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createTemplate } = useCertificateTemplates();

  const handleSubmit = async (data: { name: string; content: string }) => {
    await createTemplate(data);
    toast.success('Modelo de atestado criado com sucesso!');
    router.push('/atendimento/cadastros/modelos/atestados');
  };

  return (
    <TemplateFormPage
      title="Novo Modelo de Atestado"
      subtitle="Crie um modelo de atestado com variáveis"
      backPath="/atendimento/cadastros/modelos/atestados"
      onSubmit={handleSubmit}
      icon={<FileText className="w-5 h-5 text-blue-600" />}
    />
  );
}
