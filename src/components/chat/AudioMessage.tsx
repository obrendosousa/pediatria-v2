import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Loader2, AlertCircle, User, Mic } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { supabase } from '@/lib/supabase';

// Função auxiliar local para resolver URL do Supabase
const resolveAudioUrl = (src: string) => {
  if (!src) return '';
  if (src.startsWith('http') || src.startsWith('blob:')) return encodeURI(src);
  // Assume bucket 'midia'
  const { data } = supabase.storage.from('midia').getPublicUrl(src); 
  return encodeURI(data.publicUrl);
};

interface AudioMessageProps {
  src: string;
  isCustomer?: boolean;
  simpleMode?: boolean;
  profilePic?: string;
}

export default function AudioMessage({ 
  src, 
  isCustomer, 
  simpleMode = false, 
  profilePic 
}: AudioMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState('--:--');
  const [currentTime, setCurrentTime] = useState('0:00');
  const [speed, setSpeed] = useState(1); 
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Cores dinâmicas
  const waveColor = simpleMode ? '#b9bec5' : isCustomer ? '#9ca3af' : '#8fa89b'; 
  const progressColor = simpleMode ? '#54656f' : isCustomer ? '#54656f' : '#576c63'; 

  // EFEITO 1: Inicialização do Player
  useEffect(() => {
    if (!containerRef.current || !src) return;
    
    let isMounted = true;
    let audioUrl: string | null = null;

    const initPlayer = async () => {
      try {
        setIsLoading(true); 
        setHasError(false);
        
        // Limpa instância anterior
        if (wavesurfer.current) {
            try { wavesurfer.current.destroy(); } catch(e){}
        }

        const resolvedSrc = resolveAudioUrl(src);
        const response = await fetch(resolvedSrc);
        
        if (!response.ok) throw new Error('Falha ao carregar');
        
        const blob = await response.blob();
        if (blob.size === 0) throw new Error('Vazio');
        
        if (!isMounted) return;
        
        audioUrl = URL.createObjectURL(blob);
        
        wavesurfer.current = WaveSurfer.create({
          container: containerRef.current!, 
          waveColor, 
          progressColor, 
          url: audioUrl, 
          cursorColor: 'transparent', 
          barWidth: 3, 
          barGap: 2, 
          barRadius: 3, 
          height: 24, // Altura reduzida para ficar mais compacto (era 30)
          normalize: true, 
          minPxPerSec: 1, 
          backend: 'MediaElement', 
        });

        wavesurfer.current.on('ready', () => { 
            if (isMounted) { 
                const dur = wavesurfer.current?.getDuration() || 0;
                setDuration(formatTime(dur)); 
                setIsLoading(false); 
            } 
        });
        
        wavesurfer.current.on('audioprocess', () => { 
            if (isMounted) setCurrentTime(formatTime(wavesurfer.current?.getCurrentTime() || 0)); 
        });
        
        wavesurfer.current.on('finish', () => { 
            if (isMounted) { 
                setIsPlaying(false); 
                wavesurfer.current?.seekTo(0); 
            } 
        });
        
        wavesurfer.current.on('error', () => { 
            if (isMounted) { 
                setHasError(true); 
                setIsLoading(false); 
            } 
        });

      } catch (error) { 
        console.error("Erro audio:", error);
        if (isMounted) { 
            setHasError(true); 
            setIsLoading(false); 
        } 
      }
    };

    initPlayer();

    return () => { 
        isMounted = false; 
        if (wavesurfer.current) {
            try { wavesurfer.current.destroy(); } catch(e){}
        }
        if (audioUrl) URL.revokeObjectURL(audioUrl); 
    };
  }, [src]); 


  // EFEITO 2: Atualização de Cores
  useEffect(() => {
    if (wavesurfer.current) {
        wavesurfer.current.setOptions({
            waveColor,
            progressColor
        });
    }
  }, [waveColor, progressColor]);


  const togglePlay = (e: React.MouseEvent) => { 
      e.stopPropagation(); 
      if (!wavesurfer.current) return;
      
      if (isPlaying) {
          wavesurfer.current.pause();
      } else {
          wavesurfer.current.play();
      }
      setIsPlaying(!isPlaying); 
  };

  const changeSpeed = (e: React.MouseEvent) => { 
      e.stopPropagation(); 
      if (!wavesurfer.current) return;
      
      const newSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1; 
      setSpeed(newSpeed); 
      wavesurfer.current.setPlaybackRate(newSpeed); 
  };

  const formatTime = (s: number) => {
      if (isNaN(s)) return '0:00';
      return `${Math.floor(s / 60)}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`;
  };

  if (hasError) return (
    <div className="flex items-center gap-2 w-full py-2 px-3 text-red-400 text-xs italic bg-red-50 rounded border border-red-100">
        <AlertCircle size={14} /><span>Erro áudio</span>
    </div>
  );

  return (
    <div className={`flex items-center gap-3 py-1 select-none ${simpleMode ? 'w-full pr-1' : 'min-w-[280px] max-w-[340px]'}`}>
      {!simpleMode && (
         <div className="relative shrink-0">
             <div className="w-10 h-10 rounded-full overflow-hidden border border-black/5 shadow-sm">
                 {profilePic ? (
                    <img src={profilePic} className="w-full h-full object-cover" alt="Profile"/>
                 ) : (
                    <div className={`w-full h-full flex items-center justify-center ${isCustomer ? 'bg-gray-200 text-gray-400' : 'bg-green-200 text-green-600'}`}>
                        <User size={20} />
                    </div>
                 )}
             </div>
             <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${isCustomer ? 'bg-blue-500' : 'bg-green-500'}`}>
                <Mic size={10} className="text-white"/>
             </div>
         </div>
      )}
      
      {/* Botão de Play */}
      <button onClick={togglePlay} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors text-gray-600 dark:text-gray-300" disabled={isLoading}>
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Onda Sonora e Tempo */}
      <div className="flex-1 flex flex-col justify-center min-w-0 h-[36px]"> {/* Altura ajustada para 36px (antes 42) */}
          <div ref={containerRef} className="w-full" />
          <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 font-medium px-0.5 pt-0.5">
              <span>{isPlaying ? currentTime : duration}</span>
          </div>
      </div>
      
      {/* Botão de Velocidade */}
      <button 
        onClick={changeSpeed} 
        className={`shrink-0 w-[28px] h-[28px] rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ${speed > 1 ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}
      >
        {speed}x
      </button>
    </div>
  );
}