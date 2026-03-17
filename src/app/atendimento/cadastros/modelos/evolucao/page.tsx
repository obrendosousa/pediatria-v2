'use client';

import { Activity } from 'lucide-react';
import { useEvolutionTemplates } from '@/hooks/useEvolutionTemplates';
import { TemplateListPage } from '@/components/cadastros/TemplateEditorPage';

export default function EvolucaoPage() {
  const hook = useEvolutionTemplates();

  return (
    <TemplateListPage
      hook={hook}
      pageTitle="Modelos de Evolução"
      basePath="/atendimento/cadastros/modelos/evolucao"
      entityName="evolução"
      icon={<Activity className="w-5 h-5 text-blue-600" />}
    />
  );
}
