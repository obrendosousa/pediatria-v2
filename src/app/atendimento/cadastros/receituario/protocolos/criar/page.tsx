'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { usePrescriptionProtocols } from '@/hooks/usePrescriptionProtocols';
import ProtocoloReceituarioForm from '@/components/cadastros/protocolos/ProtocoloReceituarioForm';
import type { ProtocoloFormData } from '@/components/cadastros/protocolos/ProtocoloReceituarioForm';

export default function CriarProtocoloPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createProtocol } = usePrescriptionProtocols();

  const handleSubmit = async (data: ProtocoloFormData) => {
    await createProtocol({
      name: data.name,
      content: data.content || null,
      status: data.status,
    });
    toast.success('Protocolo cadastrado com sucesso!');
    router.push('/atendimento/cadastros/receituario/protocolos');
  };

  return (
    <ProtocoloReceituarioForm
      title="Novo Protocolo"
      subtitle="Preencha os dados do protocolo de receituário"
      onSubmit={handleSubmit}
    />
  );
}
