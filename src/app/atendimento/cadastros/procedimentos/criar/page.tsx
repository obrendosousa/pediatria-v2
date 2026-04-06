'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useProcedures } from '@/hooks/useProcedures';
import ProcedureForm from '@/components/cadastros/procedimentos/ProcedureForm';
import type { ProcedureFormData, ProductCompositionItem } from '@/components/cadastros/procedimentos/types';
import type { ProcedureType } from '@/types/cadastros';

export default function CriarProcedimentoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createProcedure, setProductCompositions } = useProcedures();

  const handleSubmit = async (form: ProcedureFormData, compositions: ProductCompositionItem[]) => {
    const procedure = await createProcedure({
      name: form.name,
      procedure_type: form.procedure_type as ProcedureType,
      duration_minutes: form.duration_minutes,
      composition_enabled: form.composition_enabled,
      way_id: form.procedure_type === 'injectable' ? form.way_id : null,
      note: form.note || null,
      composition_value: form.composition_value,
      honorarium_value: form.honorarium_value,
      fee_value: form.honorarium_value,
      total_value: form.total_value,
      formula_id: form.formula_id !== 'default' ? form.formula_id : null,
      treatment_composition: form.treatment_composition,
      other_costs: form.other_costs,
      card_tax: form.card_tax,
      commission: form.commission,
      discount: form.discount,
      inss: form.inss,
      irrf: form.irrf,
      irpj: form.irpj,
      csll: form.csll,
      pis: form.pis,
      cofins: form.cofins,
      cpp: form.cpp,
      iss: form.iss,
      other_tax: form.other_tax,
      contribution_margin: form.contribution_margin,
      contribution_margin_type: form.contribution_margin_type,
      status: 'active',
    });

    if (form.composition_enabled && compositions.length > 0) {
      await setProductCompositions(procedure.id, compositions);
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
