'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useProcedures } from '@/hooks/useProcedures';
import ProcedureForm from '@/components/cadastros/procedimentos/ProcedureForm';
import type { ProcedureFormData, ProductCompositionItem } from '@/components/cadastros/procedimentos/types';
import type { Procedure, ProcedureType } from '@/types/cadastros';

export default function EditarProcedimentoPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getProcedure, updateProcedure, getProductCompositions, setProductCompositions } = useProcedures();

  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [initialCompositions, setInitialCompositions] = useState<ProductCompositionItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const [data, comps] = await Promise.all([
          getProcedure(id),
          getProductCompositions(id),
        ]);
        setProcedure(data);

        if (comps.length > 0) {
          const resolved: ProductCompositionItem[] = comps.map(comp => ({
            product_id: comp.is_manual
              ? `manual_${comp.id}`
              : String(comp.product_id),
            product_name: comp.is_manual
              ? (comp.manual_name || '')
              : (comp.product_name || `Produto #${comp.product_id}`),
            quantity: comp.quantity,
            purchase_price: comp.purchase_price,
            cost_price: comp.cost_price,
            stock: 0,
            is_manual: comp.is_manual,
          }));
          setInitialCompositions(resolved);
        }
      } catch {
        toast.error('Procedimento não encontrado.');
        router.push('/atendimento/cadastros/procedimentos');
      } finally {
        setLoadingData(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmit = async (form: ProcedureFormData, compositions: ProductCompositionItem[]) => {
    await updateProcedure(id, {
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
    });

    await setProductCompositions(id, compositions);

    toast.success('Procedimento atualizado com sucesso!');
    router.push('/atendimento/cadastros/procedimentos');
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <ProcedureForm
      initialData={procedure}
      initialCompositions={initialCompositions}
      title="Editar Procedimento"
      subtitle="Atualize os dados do procedimento"
      onSubmit={handleSubmit}
    />
  );
}
