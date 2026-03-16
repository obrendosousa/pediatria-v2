'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CadastrosIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/atendimento/cadastros/colaboradores');
  }, [router]);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
    </div>
  );
}
