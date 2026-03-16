'use client';

import { FileText } from 'lucide-react';
import { useCertificateTemplates } from '@/hooks/useCertificateTemplates';
import { TemplateListPage } from '@/components/cadastros/TemplateEditorPage';

export default function AtestadosPage() {
  const hook = useCertificateTemplates();

  return (
    <TemplateListPage
      hook={hook}
      pageTitle="Modelos de Atestados"
      basePath="/atendimento/cadastros/modelos/atestados"
      entityName="atestado"
      icon={<FileText className="w-5 h-5 text-teal-600" />}
    />
  );
}
