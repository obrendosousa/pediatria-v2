'use client';

import { Pill } from 'lucide-react';
import { useRecipeTemplates } from '@/hooks/useRecipeTemplates';
import { TemplateListPage } from '@/components/cadastros/TemplateEditorPage';

export default function ReceitasPage() {
  const hook = useRecipeTemplates();

  return (
    <TemplateListPage
      hook={hook}
      pageTitle="Modelos de Receitas"
      basePath="/atendimento/cadastros/modelos/receitas"
      entityName="receita"
      icon={<Pill className="w-5 h-5 text-teal-600" />}
    />
  );
}
