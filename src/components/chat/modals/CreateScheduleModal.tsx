import { useState, useRef } from 'react';
import { 
  Calendar, 
  X, 
  FileText, 
  Mic, 
  Image as ImageIcon, 
  Trash2, 
  Square,
  CheckCircle2,
  Loader2,
  Clock,
  LayoutTemplate,
  Search,
  UploadCloud,
  ChevronRight
} from 'lucide-react';
import { Macro, Funnel } from '@/types';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  macros: Macro[];
  funnels: Funnel[];
  onConfirmAdHoc: (type: 'text'|'audio'|'image', content: string | File | Blob, date: string, time: string) => Promise<void>;
  onConfirmSaved: (item: any, type: 'macro' | 'funnel', date: string, time: string) => Promise<void>;
}

export default function CreateScheduleModal({ 
  isOpen, 
  onClose, 
  macros, 
  funnels, 
  onConfirmAdHoc, 
  onConfirmSaved 
}: CreateScheduleModalProps) {
    // Abas Principais
    const [mode, setMode] = useState<'custom' | 'saved'>('custom'); // 'custom' = Criar Agora, 'saved' = Biblioteca

    // Estados Gerais
    const [date, setDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    const [time, setTime] = useState("09:00");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estados "Criar Agora" (Custom)
    const [customType, setCustomType] = useState<'text'|'audio'|'image'>('text');
    const [text, setText] = useState("");
    const [file, setFile] = useState<File | null>(null);
    
    // Estados Áudio
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const chunks = useRef<Blob[]>([]);

    // Estados "Usar Salvo" (Saved)
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItem, setSelectedItem] = useState<{item: any, type: 'macro'|'funnel'} | null>(null);

    if (!isOpen) return null;

    // --- Lógica de Áudio ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorder.current = recorder;
            chunks.current = [];
            recorder.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
        } catch { alert("Erro ao acessar microfone."); }
    };

    const stopRecording = () => {
        if (mediaRecorder.current) {
            mediaRecorder.current.stop();
            mediaRecorder.current.onstop = () => {
                setAudioBlob(new Blob(chunks.current, { type: 'audio/webm' }));
                mediaRecorder.current?.stream.getTracks().forEach(t => t.stop());
            };
        }
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    // --- Submit ---
    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            if (mode === 'custom') {
                if (customType === 'text' && !text.trim()) throw new Error("Digite uma mensagem.");
                if (customType === 'image' && !file) throw new Error("Selecione uma imagem.");
                if (customType === 'audio' && !audioBlob) throw new Error("Grave um áudio.");
                
                if (customType === 'text') await onConfirmAdHoc('text', text, date, time);
                else if (customType === 'image') await onConfirmAdHoc('image', file!, date, time);
                else if (customType === 'audio') await onConfirmAdHoc('audio', audioBlob!, date, time);
            
            } else {
                if (!selectedItem) throw new Error("Selecione um item da lista.");
                await onConfirmSaved(selectedItem.item, selectedItem.type, date, time);
            }
            onClose();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filtros da Biblioteca
    const filteredMacros = macros.filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredFunnels = funnels.filter(f => f.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Calendar className="text-pink-600" size={20}/> Novo Agendamento
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Coluna Esquerda: Tipo */}
                    <div className="w-48 bg-gray-50 border-r p-3 space-y-2">
                        <button onClick={() => setMode('custom')} className={`w-full text-left p-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${mode === 'custom' ? 'bg-white text-pink-600 shadow-sm ring-1 ring-pink-100' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <Mic size={16}/> Personalizado
                        </button>
                        <button onClick={() => setMode('saved')} className={`w-full text-left p-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${mode === 'saved' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <LayoutTemplate size={16}/> Biblioteca
                        </button>
                    </div>

                    {/* Conteúdo Central */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                        
                        {/* Data e Hora (Sempre visível) */}
                        <div className="flex gap-4 mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">Data do Disparo</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm outline-none focus:border-pink-500 bg-white"/>
                            </div>
                            <div className="w-32">
                                <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">Horário</label>
                                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full border rounded-lg p-2 text-sm outline-none focus:border-pink-500 bg-white"/>
                            </div>
                        </div>

                        {mode === 'custom' ? (
                            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                                <div className="flex p-1 bg-gray-100 rounded-lg mb-4">
                                    {[{id:'text', label:'Texto'}, {id:'audio', label:'Áudio'}, {id:'image', label:'Mídia'}].map(t => (
                                        <button key={t.id} onClick={() => setCustomType(t.id as any)} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${customType === t.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>{t.label}</button>
                                    ))}
                                </div>

                                {customType === 'text' && <textarea value={text} onChange={e => setText(e.target.value)} className="w-full h-40 border rounded-lg p-3 text-sm resize-none focus:border-pink-500 outline-none" placeholder="Digite a mensagem..." autoFocus/>}
                                
                                {customType === 'audio' && (
                                    <div className="h-40 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
                                        {audioBlob ? (
                                            <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-sm border">
                                                <CheckCircle2 className="text-green-500" size={20}/><span className="text-sm font-medium">Áudio Pronto</span>
                                                <button onClick={() => setAudioBlob(null)} className="ml-2 text-red-500"><Trash2 size={16}/></button>
                                            </div>
                                        ) : isRecording ? (
                                            <div className="flex flex-col items-center">
                                                <span className="text-red-500 font-mono text-2xl font-bold mb-2 animate-pulse">{formatTime(recordingTime)}</span>
                                                <button onClick={stopRecording} className="bg-red-500 text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform"><Square fill="currentColor"/></button>
                                            </div>
                                        ) : (
                                            <button onClick={startRecording} className="flex flex-col items-center gap-2 text-pink-600 hover:scale-105 transition-transform">
                                                <div className="w-14 h-14 bg-pink-100 rounded-full flex items-center justify-center"><Mic size={24}/></div>
                                                <span className="text-sm font-bold">Gravar Áudio</span>
                                            </button>
                                        )}
                                    </div>
                                )}

                                {customType === 'image' && (
                                    <div className="h-40 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center relative hover:bg-gray-100 transition-colors">
                                        <input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFile(e.target.files?.[0] || null)}/>
                                        {file ? (
                                            <div className="text-center"><CheckCircle2 className="text-green-500 w-8 h-8 mx-auto mb-2"/><p className="text-sm font-bold text-gray-700">{file.name}</p></div>
                                        ) : (
                                            <div className="text-center text-gray-400"><UploadCloud className="w-8 h-8 mx-auto mb-2"/><p className="text-sm font-bold">Clique p/ Upload</p></div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:border-blue-500 outline-none" placeholder="Buscar modelo..."/>
                                </div>
                                
                                <div className="h-64 overflow-y-auto border rounded-xl bg-gray-50 p-2 space-y-2">
                                    {filteredFunnels.map(f => (
                                        <div key={f.id} onClick={() => setSelectedItem({item: f, type: 'funnel'})} className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between ${selectedItem?.item.id === f.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                                            <div className="flex items-center gap-2"><LayoutTemplate size={16} className="text-indigo-600"/><span className="text-sm font-bold text-gray-700">{f.title}</span><span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 rounded-full">Funil</span></div>
                                            {selectedItem?.item.id === f.id && <CheckCircle2 size={16} className="text-blue-500"/>}
                                        </div>
                                    ))}
                                    {filteredMacros.map(m => (
                                        <div key={m.id} onClick={() => setSelectedItem({item: m, type: 'macro'})} className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between ${selectedItem?.item.id === m.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                                            <div className="flex items-center gap-2"><FileText size={16} className="text-blue-600"/><span className="text-sm font-bold text-gray-700">{m.title}</span><span className="text-[10px] bg-gray-100 text-gray-600 px-2 rounded-full">Msg</span></div>
                                            {selectedItem?.item.id === m.id && <CheckCircle2 size={16} className="text-blue-500"/>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-bold">Cancelar</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2">
                        {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Clock size={16}/>}
                        Agendar Disparo
                    </button>
                </div>
            </div>
        </div>
    );
}