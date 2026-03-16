'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useRecipeTemplates } from '@/hooks/useRecipeTemplates';
import RecipeForm from '@/components/cadastros/receitas/RecipeForm';
import type { RecipeFormData } from '@/components/cadastros/receitas/RecipeForm';
import type { RecipeTemplate } from '@/types/cadastros';

export default function EditarReceitaPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getTemplate, updateTemplate } = useRecipeTemplates();

  const [template, setTemplate] = useState<RecipeTemplate | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const data = await getTemplate(id);
        setTemplate(data);
      } catch {
        toast.error('Modelo não encontrado.');
        router.push('/atendimento/cadastros/modelos/receitas');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getTemplate, toast, router]);

  const handleSubmit = async (form: RecipeFormData) => {
    await updateTemplate(id, form);
    toast.success('Modelo de receita atualizado com sucesso!');
    router.push('/atendimento/cadastros/modelos/receitas');
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <RecipeForm
      initialData={template}
      title="Editar Modelo de Receita"
      subtitle="Atualize o modelo de receita"
      onSubmit={handleSubmit}
    />
  );
}
