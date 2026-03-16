'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useAnamnesisTemplates } from '@/hooks/useAnamnesisTemplates';
import AnamnesisForm from '@/components/cadastros/anamneses/AnamnesisForm';
import type { AnamnesisFormData } from '@/components/cadastros/anamneses/AnamnesisForm';
import type { AnamnesisTemplate, AnamnesisQuestion } from '@/types/cadastros';

export default function EditarAnamnesesPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getTemplate, getQuestions, updateTemplate } = useAnamnesisTemplates();

  const [template, setTemplate] = useState<AnamnesisTemplate | null>(null);
  const [questions, setQuestions] = useState<AnamnesisQuestion[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const [tpl, qs] = await Promise.all([
          getTemplate(id),
          getQuestions(id),
        ]);
        setTemplate(tpl);
        setQuestions(qs);
      } catch {
        toast.error('Modelo não encontrado.');
        router.push('/atendimento/cadastros/modelos/anamneses');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getTemplate, getQuestions, toast, router]);

  const handleSubmit = async (form: AnamnesisFormData) => {
    await updateTemplate(
      id,
      {
        title: form.title.trim(),
        allow_send_on_scheduling: form.allow_send_on_scheduling,
      },
      form.questions.map((q, idx) => ({
        question: q.question,
        type: q.type,
        options: q.options,
        sort_order: idx,
      })),
    );

    toast.success('Modelo de anamnese atualizado com sucesso!');
    router.push('/atendimento/cadastros/modelos/anamneses');
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <AnamnesisForm
      initialData={template}
      initialQuestions={questions}
      title="Editar Modelo de Anamnese"
      subtitle="Atualize o questionário de anamnese"
      onSubmit={handleSubmit}
    />
  );
}
