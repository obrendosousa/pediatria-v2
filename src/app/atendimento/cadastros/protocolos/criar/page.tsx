'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useClinicalProtocols } from '@/hooks/useClinicalProtocols';
import ProtocoloClinicoForm from '@/components/cadastros/protocolos/ProtocoloClinicoForm';
import type { ProtocoloClinicoFormData } from '@/components/cadastros/protocolos/ProtocoloClinicoForm';

export default function CriarProtocoloClinicoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createProtocol, setProtocolItems } = useClinicalProtocols();

  const handleSubmit = async (
    data: ProtocoloClinicoFormData,
    items: { procedure_id: string; sort_order: number }[]
  ) => {
    const protocol = await createProtocol({
      name: data.name,
      description: data.description || null,
      total_value: data.total_value,
      status: data.status,
    });

    if (items.length > 0) {
      await setProtocolItems(protocol.id, items);
    }

    toast.success('Protocolo clínico cadastrado com sucesso!');
    router.push('/atendimento/cadastros/protocolos');
  };

  return (
    <ProtocoloClinicoForm
      title="Novo Protocolo Clínico"
      subtitle="Preencha os dados e selecione os procedimentos"
      onSubmit={handleSubmit}
    />
  );
}
