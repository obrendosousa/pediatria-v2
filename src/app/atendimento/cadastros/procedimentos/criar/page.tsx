'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useProcedures } from '@/hooks/useProcedures';
import ProcedureForm from '@/components/cadastros/procedimentos/ProcedureForm';
import type { ProcedureFormData, CompositionItem } from '@/components/cadastros/procedimentos/ProcedureForm';
import type { ProcedureType } from '@/types/cadastros';

export default function CriarProcedimentoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createProcedure, setCompositions } = useProcedures();

  const handleSubmit = async (form: ProcedureFormData, compositions: CompositionItem[]) => {
    const procedure = await createProcedure({
      name: form.name,
      procedure_type: form.procedure_type as ProcedureType,
      duration_minutes: form.duration_minutes,
      composition_enabled: form.composition_enabled,
      fee_value: form.fee_value,
      total_value: form.fee_value,
      status: 'active',
    });

    if (form.composition_enabled && compositions.length > 0) {
      await setCompositions(procedure.id, compositions.map(c => ({
        sub_procedure_id: c.sub_procedure_id,
        quantity: c.quantity,
      })));
    }

    toast.success('Procedimento cadastrado com sucesso!');
    router.push('/atendimento/cadastros/procedimentos');
  };

  return (
    <ProcedureForm
      title="Novo Procedimento"
      subtitle="Preencha os dados do procedimento"
      onSubmit={handleSubmit}
    />
  );
}
