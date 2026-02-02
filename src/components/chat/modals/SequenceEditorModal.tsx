import { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Clock, 
  ChevronUp, 
  ChevronDown, 
  CheckCircle2, 
  LayoutTemplate, 
  FileText, 
  Mic, 
  Image as ImageIcon,
  Scroll,
  Zap,
  Search
} from 'lucide-react';

interface SequenceEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
  mode?: 'script' | 'funnel';
  macros?: any[]; 
}

export default function SequenceEditorModal({ isOpen, onClose, onSave, initialData, mode = 'funnel', macros = [] }: SequenceEditorModalProps) {
    const [title, setTitle] = useState('');
    const [steps, setSteps] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Estado para adição manual rápida
    const [manualText, setManualText] = useState('');
    const [manualDelay, setManualDelay] = useState(5);

    const isScriptMode = mode === 'script';

    useEffect(() => {
        if (isOpen) {
            setTitle(initialData?.title || '');
            setSteps(initialData?.steps || []);
            setManualText('');
            setSearchTerm('');
        }
    }, [isOpen, initialData]);

    // --- AÇÕES ---

    // 1. Adicionar uma Macro Pronta (Da lista da esquerda)
    const addMacroToSequence = (macro: any) => {
        const newStep = {
            id: Date.now() + Math.random(), // ID único
            type: macro.type === 'ptt' ? 'audio' : macro.type,
            content: macro.content,
            delay: isScriptMode ? 0 : (macro.simulation_delay || 5), // Sem delay para scripts
            title: macro.title 
        };
        setSteps(prev => [...prev, newStep]);
    };

    // 2. Adicionar Texto Manual (Digitado na hora)
    const addManualStep = () => {
        if (!manualText.trim()) return;
        const newStep = {
            id: Date.now(),
            type: 'text',
            content: manualText,
            delay: isScriptMode ? 0 : manualDelay,
            title: 'Texto Manual'
        };
        setSteps(prev => [...prev, newStep]);
        setManualText('');
    };

    // 3. Remover Passo
    const removeStep = (index: number) => {
        setSteps(prev => prev.filter((_, i) => i !== index));
    };

    // 4. Mover Passo (Reordenar)
    const moveStep = (index: number, direction: 'up' | 'down') => {
        const newSteps = [...steps];
        if (direction === 'up' && index > 0) {
            [newSteps[index], newSteps[index - 1]] = [newSteps[index - 1], newSteps[index]];
        } else if (direction === 'down' && index < newSteps.length - 1) {
            [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
        }
        setSteps(newSteps);
    };

    // 5. Atualizar Delay
    const updateStepDelay = (index: number, newDelay: number) => {
        const newSteps = [...steps];
        newSteps[index].delay = newDelay;
        setSteps(newSteps);
    };

    const handleSave = () => {
        if (!title.trim()) return alert("Dê um nome para este roteiro.");
        if (steps.length === 0) return alert("Adicione pelo menos um passo.");
        // Passa o modo correto para o hook
        onSave({ title, steps, type: mode }); 
        onClose();
    };

    if (!isOpen) return null;

    // Filtrar macros na busca
    const filteredMacros = macros.filter(m => 
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (m.content && m.content.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[130] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                
                {/* HEADER */}
                <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isScriptMode ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            {isScriptMode ? <Scroll size={24}/> : <Zap size={24}/>}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">{isScriptMode ? 'Criar Script de Vendas' : 'Criar Funil Automático'}</h2>
                            <p className="text-xs text-gray-500">
                                {isScriptMode ? 'Organize a ordem das mensagens para envio manual.' : 'Defina a sequência e os delays para envio automático.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium">Cancelar</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2">
                            <CheckCircle2 size={18}/> Salvar {isScriptMode ? 'Script' : 'Funil'}
                        </button>
                    </div>
                </div>

                {/* CORPO PRINCIPAL */}
                <div className="flex flex-1 overflow-hidden">
                    
                    {/* ESQUERDA: BIBLIOTECA (MACROS) */}
                    <div className="w-[30%] border-r bg-white flex flex-col">
                        <div className="p-4 border-b bg-gray-50/50">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">1. Biblioteca de Mensagens</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                <input 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none" 
                                    placeholder="Buscar mensagens salvas..." 
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 custom-scrollbar">
                            {filteredMacros.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <p className="text-sm">Nenhuma mensagem encontrada.</p>
                                    <p className="text-xs mt-1">Crie mensagens rápidas primeiro na aba de Texto.</p>
                                </div>
                            ) : (
                                filteredMacros.map(macro => (
                                    <div 
                                        key={macro.id} 
                                        onClick={() => addMacroToSequence(macro)}
                                        className="bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group relative"
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`p-1.5 rounded-md ${macro.type === 'text' ? 'bg-blue-50 text-blue-600' : macro.type === 'image' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                                                {macro.type === 'text' ? <FileText size={14}/> : macro.type === 'image' ? <ImageIcon size={14}/> : <Mic size={14}/>}
                                            </div>
                                            <span className="font-bold text-sm text-gray-700 truncate flex-1">{macro.title}</span>
                                            <Plus size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"/>
                                        </div>
                                        {macro.type === 'text' && (
                                            <p className="text-xs text-gray-500 line-clamp-2">{macro.content}</p>
                                        )}
                                        {macro.type === 'image' && (
                                            <div className="h-16 bg-gray-100 rounded overflow-hidden relative">
                                                <img src={macro.content} className="w-full h-full object-cover opacity-70"/>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* CENTRO: CANVAS DO ROTEIRO */}
                    <div className="flex-1 flex flex-col bg-[#f0f2f5] relative">
                        {/* INPUT TÍTULO */}
                        <div className="p-4 bg-white shadow-sm z-10">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nome do Roteiro</label>
                            <input 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                className="w-full text-lg font-bold text-gray-800 border-b border-gray-300 focus:border-blue-500 outline-none pb-1 bg-transparent placeholder:font-normal placeholder:text-gray-300"
                                placeholder={isScriptMode ? "Ex: Abordagem Cliente Frio" : "Ex: Funil de Aquecimento 3 Dias"}
                                autoFocus
                            />
                        </div>

                        {/* LISTA DE PASSOS */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {steps.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-xl m-4">
                                    <LayoutTemplate size={48} className="mb-4 opacity-30"/>
                                    <h3 className="font-bold text-lg">Seu roteiro está vazio</h3>
                                    <p className="text-sm mt-1">Clique nas mensagens à esquerda para adicionar.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 max-w-3xl mx-auto pb-20">
                                    {steps.map((step, idx) => (
                                        <div key={step.id || idx} className="flex gap-4 group animate-in slide-in-from-bottom-2 duration-300">
                                            {/* Coluna da Esquerda (Número) */}
                                            <div className="flex flex-col items-center pt-2">
                                                <div className={`w-8 h-8 rounded-full ${isScriptMode ? 'bg-orange-500' : 'bg-indigo-600'} text-white font-bold flex items-center justify-center shadow-md z-10 text-sm`}>
                                                    {idx + 1}
                                                </div>
                                                {idx !== steps.length - 1 && <div className="w-0.5 bg-gray-300 flex-1 my-1"></div>}
                                            </div>

                                            {/* Card do Passo */}
                                            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 relative hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${step.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                            {step.type === 'text' ? 'Texto' : 'Mídia'}
                                                        </div>
                                                        {step.title && <span className="text-xs text-gray-400 font-medium">• Origem: {step.title}</span>}
                                                    </div>
                                                    
                                                    {/* Controles */}
                                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => moveStep(idx, 'up')} disabled={idx === 0} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-30"><ChevronUp size={16}/></button>
                                                        <button onClick={() => moveStep(idx, 'down')} disabled={idx === steps.length - 1} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-30"><ChevronDown size={16}/></button>
                                                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                                                        <button onClick={() => removeStep(idx)} className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded"><Trash2 size={16}/></button>
                                                    </div>
                                                </div>

                                                {/* Conteúdo */}
                                                <div className="mb-3">
                                                    {step.type === 'text' ? (
                                                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{step.content}</p>
                                                    ) : step.type === 'image' ? (
                                                        <img src={step.content} className="h-24 rounded-lg border bg-gray-50 object-cover"/>
                                                    ) : (
                                                        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border">
                                                            <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center text-purple-700"><Mic size={16}/></div>
                                                            <span className="text-sm font-medium text-gray-600">Áudio Gravado</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Delay (Só mostra se NÃO for Script) */}
                                                {!isScriptMode && (
                                                    <div className="flex items-center gap-2 border-t pt-2">
                                                        <Clock size={14} className="text-gray-400"/>
                                                        <span className="text-xs text-gray-500">Aguardar</span>
                                                        <input 
                                                            type="number" 
                                                            min="1"
                                                            value={step.delay} 
                                                            onChange={(e) => updateStepDelay(idx, parseInt(e.target.value))}
                                                            className="w-12 text-center text-xs font-bold border rounded py-0.5"
                                                        />
                                                        <span className="text-xs text-gray-500">segundos</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* RODAPÉ DE CRIAÇÃO RÁPIDA */}
                        <div className="p-4 bg-white border-t z-20">
                            <div className="max-w-3xl mx-auto flex gap-3 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">Adicionar Texto Avulso (sem salvar macro)</label>
                                    <textarea 
                                        value={manualText}
                                        onChange={e => setManualText(e.target.value)}
                                        placeholder="Digite e tecle Enter..."
                                        className="w-full border rounded-lg p-2 text-sm h-14 resize-none focus:ring-2 focus:ring-blue-100 outline-none"
                                        onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addManualStep(); } }}
                                    />
                                </div>
                                
                                {/* Delay Manual só aparece se NÃO for script */}
                                {!isScriptMode && (
                                    <div className="w-20">
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">Delay (s)</label>
                                        <input 
                                            type="number" 
                                            value={manualDelay}
                                            onChange={e => setManualDelay(parseInt(e.target.value))}
                                            className="w-full border rounded-lg p-2 h-14 text-center font-bold"
                                        />
                                    </div>
                                )}

                                <button 
                                    onClick={addManualStep}
                                    disabled={!manualText.trim()}
                                    className="h-14 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-bold flex flex-col items-center justify-center min-w-[80px]"
                                >
                                    <Plus size={20}/>
                                    <span className="text-[10px]">Adicionar</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}