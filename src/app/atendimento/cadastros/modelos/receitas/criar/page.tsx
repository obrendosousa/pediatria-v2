'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useRecipeTemplates } from '@/hooks/useRecipeTemplates';
import RecipeForm from '@/components/cadastros/receitas/RecipeForm';
import type { RecipeFormData } from '@/components/cadastros/receitas/RecipeForm';

export default function CriarReceitaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createTemplate } = useRecipeTemplates();

  const handleSubmit = async (form: RecipeFormData) => {
    await createTemplate(form);
    toast.success('Modelo de receita criado com sucesso!');
    router.push('/atendimento/cadastros/modelos/receitas');
  };

  return (
    <RecipeForm
      title="Novo Modelo de Receita"
      subtitle="Crie um modelo de receita com itens do receituário"
      onSubmit={handleSubmit}
    />
  );
}
