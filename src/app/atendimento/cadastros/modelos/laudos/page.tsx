'use client';

import { FileSearch } from 'lucide-react';
import { useReportTemplates } from '@/hooks/useReportTemplates';
import { TemplateListPage } from '@/components/cadastros/TemplateEditorPage';

export default function LaudosPage() {
  const hook = useReportTemplates();

  return (
    <TemplateListPage
      hook={hook}
      pageTitle="Modelos de Laudos"
      basePath="/atendimento/cadastros/modelos/laudos"
      entityName="laudo"
      icon={<FileSearch className="w-5 h-5 text-blue-600" />}
    />
  );
}
