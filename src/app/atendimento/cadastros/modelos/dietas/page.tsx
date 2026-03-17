'use client';

import { Apple } from 'lucide-react';
import { useDietTemplates } from '@/hooks/useDietTemplates';
import { TemplateListPage } from '@/components/cadastros/TemplateEditorPage';

export default function DietasPage() {
  const hook = useDietTemplates();

  return (
    <TemplateListPage
      hook={hook}
      pageTitle="Modelos de Dietas"
      basePath="/atendimento/cadastros/modelos/dietas"
      entityName="dieta"
      icon={<Apple className="w-5 h-5 text-blue-600" />}
    />
  );
}
