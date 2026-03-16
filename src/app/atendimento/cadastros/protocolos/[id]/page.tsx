'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useClinicalProtocols } from '@/hooks/useClinicalProtocols';
import ProtocoloClinicoForm from '@/components/cadastros/protocolos/ProtocoloClinicoForm';
import type { ProtocoloClinicoFormData } from '@/components/cadastros/protocolos/ProtocoloClinicoForm';
import type { ProtocolItemWithDetails } from '@/hooks/useClinicalProtocols';
import type { ClinicalProtocol } from '@/types/cadastros';

export default function EditarProtocoloClinicoPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getProtocol, getProtocolItems, updateProtocol, setProtocolItems } = useClinicalProtocols();

  const [protocol, setProtocol] = useState<ClinicalProtocol | null>(null);
  const [items, setItems] = useState<ProtocolItemWithDetails[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const [data, protocolItems] = await Promise.all([
          getProtocol(id),
          getProtocolItems(id),
        ]);
        setProtocol(data);
        setItems(protocolItems);
      } catch {
        toast.error('Protocolo não encontrado.');
        router.push('/atendimento/cadastros/protocolos');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getProtocol, getProtocolItems, toast, router]);

  const handleSubmit = async (
    data: ProtocoloClinicoFormData,
    newItems: { procedure_id: string; sort_order: number }[]
  ) => {
    await updateProtocol(id, {
      name: data.name,
      description: data.description || null,
      total_value: data.total_value,
      status: data.status,
    });

    await setProtocolItems(id, newItems);

    toast.success('Protocolo clínico atualizado com sucesso!');
    router.push('/atendimento/cadastros/protocolos');
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <ProtocoloClinicoForm
      title="Editar Protocolo Clínico"
      subtitle="Atualize os dados e os procedimentos do protocolo"
      initialData={protocol}
      initialItems={items}
      onSubmit={handleSubmit}
    />
  );
}
