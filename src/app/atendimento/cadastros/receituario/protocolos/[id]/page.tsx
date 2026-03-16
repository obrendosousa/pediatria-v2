'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { usePrescriptionProtocols } from '@/hooks/usePrescriptionProtocols';
import ProtocoloReceituarioForm from '@/components/cadastros/protocolos/ProtocoloReceituarioForm';
import type { ProtocoloFormData } from '@/components/cadastros/protocolos/ProtocoloReceituarioForm';
import type { PrescriptionProtocol } from '@/types/cadastros';

export default function EditarProtocoloPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getProtocol, updateProtocol } = usePrescriptionProtocols();

  const [protocol, setProtocol] = useState<PrescriptionProtocol | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const data = await getProtocol(id);
        setProtocol(data);
      } catch {
        toast.error('Protocolo não encontrado.');
        router.push('/atendimento/cadastros/receituario/protocolos');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getProtocol, toast, router]);

  const handleSubmit = async (data: ProtocoloFormData) => {
    await updateProtocol(id, {
      name: data.name,
      content: data.content || null,
      status: data.status,
    });
    toast.success('Protocolo atualizado com sucesso!');
    router.push('/atendimento/cadastros/receituario/protocolos');
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <ProtocoloReceituarioForm
      title="Editar Protocolo"
      subtitle="Atualize os dados do protocolo de receituário"
      initialData={protocol}
      onSubmit={handleSubmit}
    />
  );
}
