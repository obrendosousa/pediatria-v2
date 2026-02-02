import { X, Download } from 'lucide-react';

interface ImagePreviewModalProps {
  src: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImagePreviewModal({ src, isOpen, onClose }: ImagePreviewModalProps) {
    if (!isOpen || !src) return null;

    return (
        <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            {/* Botão Fechar */}
            <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/20 hover:bg-white/10 p-2 rounded-full transition-all z-50">
                <X size={32} />
            </button>
            
            {/* Botão Download */}
            <a href={src} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-4 right-20 text-white/70 hover:text-white bg-black/20 hover:bg-white/10 p-2 rounded-full transition-all z-50">
                <Download size={32} />
            </a>

            {/* Imagem Centralizada */}
            <img 
                src={src} 
                alt="Preview" 
                className="max-w-full max-h-[90vh] object-contain shadow-2xl animate-in zoom-in-95 duration-200 select-none" 
                onClick={(e) => e.stopPropagation()} // Impede fechar ao clicar na imagem
            />
        </div>
    );
}