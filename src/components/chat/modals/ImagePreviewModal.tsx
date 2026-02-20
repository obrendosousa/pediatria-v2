import { X, Download } from 'lucide-react';

interface ImagePreviewModalProps {
  src: string | null;
  isOpen: boolean;
  onClose: () => void;
  mediaType?: 'image' | 'video';
}

export default function ImagePreviewModal({ src, isOpen, onClose, mediaType = 'image' }: ImagePreviewModalProps) {
    if (!isOpen || !src) return null;

    return (
        <div
            className="absolute inset-0 z-[120] bg-[#efeae2]/95 dark:bg-[#0b141a]/95 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Botão Fechar */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-[#3b4a54] dark:text-white/80 hover:text-[#1f2a30] dark:hover:text-white bg-white/70 dark:bg-black/30 hover:bg-white dark:hover:bg-white/10 p-2 rounded-full transition-all z-50"
            >
                <X size={28} />
            </button>
            
            {/* Botão Download */}
            <a
                href={src}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-4 right-16 sm:right-20 text-[#3b4a54] dark:text-white/80 hover:text-[#1f2a30] dark:hover:text-white bg-white/70 dark:bg-black/30 hover:bg-white dark:hover:bg-white/10 p-2 rounded-full transition-all z-50"
            >
                <Download size={28} />
            </a>

            {mediaType === 'video' ? (
                <video
                    src={src}
                    controls
                    autoPlay
                    playsInline
                    className="w-auto h-auto max-w-full max-h-[85%] object-contain bg-black shadow-2xl rounded-md animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                /* Imagem Centralizada */
                <img 
                    src={src} 
                    alt="Preview" 
                    className="max-w-full max-h-[85%] object-contain shadow-2xl rounded-md animate-in zoom-in-95 duration-200 select-none" 
                    onClick={(e) => e.stopPropagation()} // Impede fechar ao clicar na imagem
                />
            )}
        </div>
    );
}