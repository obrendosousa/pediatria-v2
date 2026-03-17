'use client';

import { FlaskConical } from 'lucide-react';
import { useExamTemplates } from '@/hooks/useExamTemplates';
import { TemplateListPage } from '@/components/cadastros/TemplateEditorPage';

export default function ExamesPage() {
  const hook = useExamTemplates();

  return (
    <TemplateListPage
      hook={hook}
      pageTitle="Modelos de Exames"
      basePath="/atendimento/cadastros/modelos/exames"
      entityName="exame"
      icon={<FlaskConical className="w-5 h-5 text-blue-600" />}
    />
  );
}
