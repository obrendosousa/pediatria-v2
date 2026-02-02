'use client';

import { useState, use } from 'react';
import { useZxing } from 'react-zxing';
import { supabase } from '@/lib/supabase';
import { Scan, CheckCircle2, XCircle } from 'lucide-react';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function MobileScannerPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId; 
  
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [productName, setProductName] = useState('');

  // Configuração da Câmera
  const { ref } = useZxing({
    onResult: (result: any) => {
      const barcode = result.getText();
      if (barcode === lastScanned && status !== 'idle') return;
      handleScan(barcode);
    },
  });

  const handleScan = async (barcode: string) => {
    setLastScanned(barcode);
    setStatus('sending');

    try {
        const { data: product, error } = await supabase
        .from('products')
        .select('id, name, price_sale, stock, barcode, image_url, category, price_cost')
        .eq('barcode', barcode)
        .maybeSingle();

        if (error || !product) {
            setStatus('error');
            setProductName('Produto não cadastrado');
            setTimeout(() => {
                setStatus('idle');
                setLastScanned(null);
            }, 2000);
            return;
        }

        setProductName(product.name);

        const channel = supabase.channel(`pos-session-${sessionId}`);
        await channel.send({
            type: 'broadcast',
            event: 'add-item',
            payload: { product, barcode },
        });

        setStatus('success');
        setTimeout(() => {
            setStatus('idle');
            setLastScanned(null);
        }, 1500);

    } catch (err) {
        console.error("Erro no scanner:", err);
        setStatus('error');
        setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    // Tela 100% preta e cheia (Z-Index alto para cobrir tudo)
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black text-white touch-none">
      
      {/* Header Mobile */}
      <div className="p-4 bg-zinc-900 flex justify-between items-center z-10 border-b border-zinc-800 safe-area-top">
        <h1 className="font-bold flex items-center gap-2 text-lg">
            <Scan className="text-rose-500 w-6 h-6"/> Scanner
        </h1>
        <div className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
            status === 'sending' ? 'bg-blue-600 animate-pulse' : 
            status === 'success' ? 'bg-emerald-600' : 
            status === 'error' ? 'bg-red-600' : 'bg-zinc-800'
        }`}>
           {status === 'sending' ? 'Enviando...' : 
            status === 'success' ? 'OK!' : 
            status === 'error' ? 'Erro' : 'Pronto'}
        </div>
      </div>

      {/* Área da Câmera */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
         <video ref={ref} className="absolute inset-0 w-full h-full object-cover opacity-90" />
         
         {/* Mira Visual */}
         <div className="relative z-10 w-72 h-48 border-2 border-rose-500/60 rounded-xl flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="w-full h-0.5 bg-rose-500 animate-[pulse_2s_infinite] shadow-[0_0_15px_rgba(244,63,94,1)]"></div>
            <p className="absolute -bottom-10 text-xs font-bold text-white/80 bg-black/50 px-2 py-1 rounded">
               {status === 'idle' ? 'Aponte para o código' : 'Processando...'}
            </p>
         </div>

         {/* Overlay Sucesso */}
         {status === 'success' && (
            <div className="absolute inset-0 z-20 bg-emerald-500/90 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
               <CheckCircle2 className="w-24 h-24 text-white mb-4 drop-shadow-lg" />
               <h2 className="text-2xl font-black text-white text-center px-4 leading-tight">{productName}</h2>
               <p className="text-white font-bold mt-2 text-lg opacity-90">Adicionado!</p>
            </div>
         )}

         {/* Overlay Erro */}
         {status === 'error' && (
            <div className="absolute inset-0 z-20 bg-red-500/90 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
               <XCircle className="w-24 h-24 text-white mb-4 drop-shadow-lg" />
               <h2 className="text-2xl font-bold text-white mb-1">Não encontrado</h2>
            </div>
         )}
      </div>

      {/* Footer */}
      <div className="p-6 bg-zinc-900 text-center z-10 border-t border-zinc-800 safe-area-bottom">
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-1">ID: {sessionId?.slice(0,8)}</p>
        <p className="text-xs text-zinc-400">Adicione à Tela de Início para tela cheia</p>
      </div>
    </div>
  );
}