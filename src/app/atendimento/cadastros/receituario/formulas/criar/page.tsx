'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useFormulas } from '@/hooks/useFormulas';
import FormulaForm from '@/components/cadastros/formulas/FormulaForm';
import type { FormulaFormData, CompositionRow } from '@/components/cadastros/formulas/FormulaForm';
import type { RecordStatus } from '@/types/cadastros';

export default function CriarFormulaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createFormula, setCompositions } = useFormulas();

  const handleSubmit = async (form: FormulaFormData, compositions: CompositionRow[]) => {
    const formula = await createFormula({
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

    if (compositions.length > 0) {
      await setCompositions(formula.id, compositions.map((c, idx) => ({
        substance_id: c.substance_id,
        quantity: c.quantity,
        unit: c.unit,
        sort_order: idx,
      })));
    }

    toast.success('Fórmula cadastrada com sucesso!');
    router.push('/atendimento/cadastros/receituario/formulas');
  };

  return (
    <FormulaForm
      title="Nova Fórmula"
      subtitle="Preencha os dados da fórmula"
      onSubmit={handleSubmit}
    />
  );
}
