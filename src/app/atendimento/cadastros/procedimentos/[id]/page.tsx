'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useProcedures } from '@/hooks/useProcedures';
import ProcedureForm from '@/components/cadastros/procedimentos/ProcedureForm';
import type { ProcedureFormData, CompositionItem } from '@/components/cadastros/procedimentos/ProcedureForm';
import type { Procedure, ProcedureType } from '@/types/cadastros';

export default function EditarProcedimentoPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getProcedure, updateProcedure, getCompositions, setCompositions, procedures, listProcedures } = useProcedures();

  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [initialCompositions, setInitialCompositions] = useState<CompositionItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const [data, comps] = await Promise.all([
          getProcedure(id),
          getCompositions(id),
        ]);
        setProcedure(data);

        if (comps.length > 0) {
          // Carregar nomes dos sub-procedimentos
          await listProcedures({ pageSize: 500 });
        }

        // Mapear composições com nomes (será preenchido quando procedures carregar)
        setInitialCompositions(comps.map(c => ({
          sub_procedure_id: c.sub_procedure_id,
          sub_procedure_name: '',
          quantity: c.quantity,
        })));
      } catch {
        toast.error('Procedimento não encontrado.');
        router.push('/atendimento/cadastros/procedimentos');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getProcedure, getCompositions, listProcedures, toast, router]);

  // Preencher nomes quando procedures carregar
  useEffect(() => {
    if (procedures.length > 0 && initialCompositions.some(c => !c.sub_procedure_name)) {
      setInitialCompositions(prev => prev.map(c => {
        const proc = procedures.find(p => p.id === c.sub_procedure_id);
        return { ...c, sub_procedure_name: proc?.name || 'Procedimento removido' };
      }));
    }
  }, [procedures, initialCompositions]);

  const handleSubmit = async (form: ProcedureFormData, compositions: CompositionItem[]) => {
    await updateProcedure(id, {
      name: form.name,
      procedure_type: form.procedure_type as ProcedureType,
      duration_minutes: form.duration_minutes,
      composition_enabled: form.composition_enabled,
      fee_value: form.fee_value,
      total_value: form.procedure_value,
    });

    await setCompositions(id, compositions.map(c => ({
      sub_procedure_id: c.sub_procedure_id,
      quantity: c.quantity,
    })));

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
