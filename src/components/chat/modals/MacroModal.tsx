import { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Edit2, 
  Loader2, 
  UploadCloud, 
  FileText, 
  Mic, 
  Image as ImageIcon,
  Video,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MacroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
  typeOverride?: string | null;
}

export default function MacroModal({ isOpen, onClose, onSave, initialData, typeOverride }: MacroModalProps) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [delay, setDelay] = useState(3);
    const [activeType, setActiveType] = useState<'text' | 'audio' | 'image' | 'video'>('text');
    
    const [isSaving, setIsSaving] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Modo Edição ou "Salvar como Macro"
                setTitle(initialData.title || '');
                setContent(initialData.content || '');
                setDelay(initialData.simulation_delay || 3);
                
                let t = initialData.type || typeOverride || 'text';
                if (t === 'ptt') t = 'audio';
                setActiveType(t);
            } else {
                setTitle(''); 
                setContent(''); 
                setDelay(3);
                // Se typeOverride for 'script', o padrão é texto, senão usa o override ou texto
                setActiveType(typeOverride === 'script' ? 'text' : (typeOverride as any) || 'text');
            }
        }
    }, [isOpen, initialData, typeOverride]);

    const handleFileUpload = async (file: File) => {
        if (!file) return;
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `${activeType}s/${fileName}`; 

            const { error: uploadError } = await supabase.storage
                .from('midia') 
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('midia')
                .getPublicUrl(filePath);

            setContent(publicUrl);
        } catch (error: any) {
            alert('Erro no upload: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    const handleSave = async () => {
        if (!title || !content) return alert("Preencha título e conteúdo/mídia");
        setIsSaving(true);
        try {
            await onSave({ 
                title, 
                content, 
                type: activeType,
                simulation_delay: delay,
                is_script: false // Macros são itens individuais
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            {initialData?.id ? <Edit2 size={18} className="text-blue-600"/> : <Plus size={18} className="text-green-600"/>} 
                            {initialData?.id ? 'Editar Mensagem Padrão' : 'Nova Mensagem Padrão'}
                        </h3>
                        <p className="text-xs text-gray-500">Configure respostas rápidas para sua equipe.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} className="text-gray-500"/></button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                    <div className="flex p-1 bg-gray-100 rounded-lg">
                        {[
                            { id: 'text', label: 'Texto', icon: FileText },
                            { id: 'audio', label: 'Áudio', icon: Mic },
                            { id: 'image', label: 'Imagem', icon: ImageIcon },
                            { id: 'video', label: 'Vídeo', icon: Video },
                        ].map((t) => (
                            <button 
                                key={t.id}
                                onClick={() => setActiveType(t.id as any)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-all ${activeType === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <t.icon size={14}/> {t.label}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Nome do Atalho (Botão)</label>
                        <input 
                            value={title} 
                            onChange={e=>setTitle(e.target.value)} 
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                            placeholder="Ex: Saudação Manhã, Preços Tabela..."
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
                            {activeType === 'text' ? 'Mensagem' : `Arquivo de ${activeType === 'image' ? 'Imagem' : activeType === 'audio' ? 'Áudio' : 'Vídeo'}`}
                        </label>
                        
                        {activeType === 'text' ? (
                            <textarea 
                                value={content} 
                                onChange={e=>setContent(e.target.value)} 
                                className="w-full border border-gray-300 rounded-lg p-3 text-sm h-32 resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                                placeholder="Digite a mensagem aqui... Use *negrito* para destaque."
                            />
                        ) : (
                            <div className="space-y-3">
                                <div 
                                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={onDrop}
                                    onClick={() => document.getElementById('macro-file-upload')?.click()}
                                >
                                    <input type="file" id="macro-file-upload" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} accept={activeType === 'image' ? 'image/*' : activeType === 'audio' ? 'audio/*' : 'video/*'} />
                                    
                                    {isUploading ? (
                                        <div className="py-4"><Loader2 size={32} className="animate-spin text-blue-500 mb-2"/> <span className="text-sm font-medium text-gray-600">Enviando arquivo...</span></div>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 text-blue-600">
                                                <UploadCloud size={24}/>
                                            </div>
                                            <p className="text-sm font-bold text-gray-700">Clique para enviar ou arraste aqui</p>
                                            <p className="text-xs text-gray-400 mt-1">Suporta {activeType === 'image' ? 'JPG, PNG' : activeType === 'audio' ? 'MP3, OGG, WAV' : 'MP4'}</p>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 font-bold">OU URL:</span>
                                    <input 
                                        value={content} 
                                        onChange={e=>setContent(e.target.value)} 
                                        className="flex-1 border border-gray-200 rounded p-1.5 text-xs focus:border-blue-500 outline-none text-gray-600" 
                                        placeholder="https://..."
                                    />
                                </div>

                                {content && (
                                    <div className="mt-2 p-2 bg-gray-50 border rounded-lg">
                                        <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Preview</p>
                                        {activeType === 'image' && <img src={content} alt="Preview" className="h-32 object-contain rounded border bg-white"/>}
                                        {activeType === 'audio' && <audio src={content} controls className="w-full h-8"/>}
                                        {activeType === 'video' && <video src={content} controls className="w-full max-h-32 rounded bg-black"/>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Clock size={16}/></div>
                            <div>
                                <p className="text-xs font-bold text-blue-900">Simulação de Digitação</p>
                                <p className="text-[10px] text-blue-700">Tempo que o robô fica "digitando..." antes de enviar.</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-blue-200 shadow-sm">
                             <input 
                                type="number" 
                                min="0" 
                                max="60" 
                                value={delay} 
                                onChange={e=>setDelay(parseInt(e.target.value))} 
                                className="w-12 text-center text-sm font-bold text-gray-700 outline-none"
                             />
                             <span className="text-xs text-gray-500 font-medium">seg</span>
                         </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 flex gap-3">
                    <button onClick={onClose} disabled={isSaving} className="flex-1 py-3 text-gray-600 hover:bg-gray-200 hover:text-gray-800 rounded-xl text-sm font-bold transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={isSaving || !title || !content} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 flex justify-center items-center gap-2 transition-all transform active:scale-[0.98]">
                        {isSaving ? <Loader2 size={18} className="animate-spin"/> : <CheckCircle2 size={18}/>} 
                        {isSaving ? 'Salvando...' : 'Salvar Mensagem'}
                    </button>
                </div>
            </div>
        </div>
    );
};