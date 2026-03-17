'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useFormulas } from '@/hooks/useFormulas';
import { useSubstances } from '@/hooks/useSubstances';
import FormulaForm from '@/components/cadastros/formulas/FormulaForm';
import type { FormulaFormData, CompositionRow } from '@/components/cadastros/formulas/FormulaForm';
import type { Formula, RecordStatus } from '@/types/cadastros';

export default function EditarFormulaPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getFormula, updateFormula, getCompositions, setCompositions } = useFormulas();
  const { listSubstances, substances } = useSubstances();

  const [formula, setFormula] = useState<Formula | null>(null);
  const [initialCompositions, setInitialCompositions] = useState<CompositionRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const [data, comps] = await Promise.all([
          getFormula(id),
          getCompositions(id),
        ]);
        setFormula(data);

        if (comps.length > 0) {
          // Load all substances to resolve names
          await listSubstances('', 0, 5000);

          setInitialCompositions(comps.map(c => ({
            substance_id: c.substance_id,
            substance_name: '',
            quantity: c.quantity,
            unit: c.unit,
          })));
        }
      } catch {
        toast.error('Fórmula não encontrada.');
        router.push('/atendimento/cadastros/receituario/formulas');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getFormula, getCompositions, listSubstances, toast, router]);

  // Resolver nomes das substâncias quando carregarem
  useEffect(() => {
    if (substances.length > 0 && initialCompositions.some(c => !c.substance_name)) {
      setInitialCompositions(prev => prev.map(c => {
        const sub = substances.find(s => s.id === c.substance_id);
        return { ...c, substance_name: sub?.name || 'Substância removida' };
      }));
    }
  }, [substances, initialCompositions]);

  const handleSubmit = async (form: FormulaFormData, compositions: CompositionRow[]) => {
    await updateFormula(id, {
      name: form.name,
      route_of_use: form.route_of_use,
      form: form.form,
      quantity: form.quantity,
      unit: form.unit,
      posology: form.posology,
      reference: form.reference || null,
      notes: form.notes || null,
      status: form.status as RecordStatus,
    });

    await setCompositions(id, compositions.map((c, idx) => ({
      substance_id: c.substance_id,
      quantity: c.quantity,
      unit: c.unit,
      sort_order: idx,
    })));

    toast.success('Fórmula atualizada com sucesso!');
    router.push('/atendimento/cadastros/receituario/formulas');
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <FormulaForm
      initialData={formula}
      initialCompositions={initialCompositions}
      title="Editar Fórmula"
      subtitle="Atualize os dados da fórmula"
      onSubmit={handleSubmit}
    />
  );
}
