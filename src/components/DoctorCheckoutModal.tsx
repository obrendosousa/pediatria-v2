'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Chat, Product } from '@/types';
import { 
  X, CheckCircle2, ShoppingBag, Search, Plus, Pill, 
  Stethoscope, Calendar, MessageSquare, ArrowRight, Minus,
  Activity, ClipboardList, Clock
} from 'lucide-react';

interface DoctorCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  chat: Chat | null;
}

// Tipo local para controle do carrinho antes de enviar
interface SelectedItem {
  id: number;
  qty: number;
  type: 'product' | 'service';
  product: Product;
}

export default function DoctorCheckoutModal({ isOpen, onClose, onSuccess, chat }: DoctorCheckoutModalProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'services' | 'final'>('products');
  const [loading, setLoading] = useState(false);
  
  // Dados do Catálogo
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  
  // "Carrinho" de Prescrição da Doutora
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  
  // Dados Finais
  const [returnDate, setReturnDate] = useState('');
  const [secretaryNotes, setSecretaryNotes] = useState(''); // Recado para a recepção
  const [medicalNotes, setMedicalNotes] = useState('');     // Evolução Médica (Prontuário)

  useEffect(() => {
    if (isOpen && chat) {
      // Resetar estados ao abrir
      setActiveTab('products');
      setSelectedItems([]);
      setReturnDate('');
      setSecretaryNotes('');
      setMedicalNotes(chat.notes || ''); // Carrega notas anteriores se houver
      setSearch('');
      fetchCatalog();
    }
  }, [isOpen, chat]);

  async function fetchCatalog() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name');
    
    if (data) setCatalog(data as Product[]);
  }

  // --- LÓGICA DE SELEÇÃO DE ITENS ---
  function addItem(product: Product, type: 'product' | 'service') {
    const existing = selectedItems.find(i => i.id === product.id);
    if (existing) {
        // Incrementa
        setSelectedItems(selectedItems.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
        // Adiciona novo
        setSelectedItems([...selectedItems, { id: product.id, qty: 1, type, product }]);
    }
  }

  function removeItem(id: number) {
    const existing = selectedItems.find(i => i.id === id);
    if (existing && existing.qty > 1) {
        // Decrementa
        setSelectedItems(selectedItems.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i));
    } else {
        // Remove
        setSelectedItems(selectedItems.filter(i => i.id !== id));
    }
  }

  // --- NOVO: LÓGICA DE DATAS (ATALHOS) ---
  function setReturnInDays(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    
    // Formata YYYY-MM-DD local (para evitar bugs de fuso horário do toISOString)
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    
    setReturnDate(`${yyyy}-${mm}-${dd}`);
  }

  // --- AÇÃO FINAL: ENVIAR PARA RECEPÇÃO ---
  async function handleFinish() {
    if (!chat) return;
    setLoading(true);

    try {
      // 1. Atualizar o Chat (Encerrar atendimento médico e salvar prontuário)
      const { error: chatError } = await supabase
        .from('chats')
        .update({ 
            reception_status: 'finished', // Libera a sala no painel
            status: 'ENDED',              // Marca como finalizado
            notes: medicalNotes,          // Salva evolução
            last_interaction_at: new Date().toISOString()
        })
        .eq('id', chat.id);

      if (chatError) throw chatError;

      // 2. Criar o Ticket de Checkout (Se houver alguma pendência para a secretária)
      const hasItems = selectedItems.length > 0;
      const hasReturn = !!returnDate;
      const hasNotes = !!secretaryNotes;

      if (hasItems || hasReturn || hasNotes) {
          
          // A. Criar o Cabeçalho (Checkout)
          const { data: checkout, error: checkoutError } = await supabase
            .from('medical_checkouts')
            .insert({
                chat_id: chat.id,
                return_date: returnDate || null,
                secretary_notes: secretaryNotes,
                status: 'pending' // Entra na fila da secretária
            })
            .select()
            .single();

          if (checkoutError) throw checkoutError;

          // B. Inserir os Itens (Produtos/Serviços)
          if (hasItems) {
              const itemsPayload = selectedItems.map(item => ({
                  checkout_id: checkout.id,
                  product_id: item.id,
                  quantity: item.qty,
                  type: item.type
              }));
              
              const { error: itemsError } = await supabase
                .from('checkout_items')
                .insert(itemsPayload);
                
              if (itemsError) throw itemsError;
          }
      }

      onSuccess(); // Atualiza a lista da médica
      onClose();   // Fecha o modal

    } catch (err) {
      console.error('Erro no checkout:', err);
      alert("Ocorreu um erro ao finalizar o atendimento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // Filtros de Categoria
  const isService = (cat: string) => ['Serviço', 'Exame', 'Vacina', 'Procedimento'].includes(cat || '');
  
  const productsList = catalog.filter(p => !isService(p.category || '')).filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const servicesList = catalog.filter(p => isService(p.category || '')).filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  // Contadores para as abas
  const countProd = selectedItems.filter(i => i.type === 'product').reduce((a,b) => a + b.qty, 0);
  const countServ = selectedItems.filter(i => i.type === 'service').reduce((a,b) => a + b.qty, 0);

  if (!isOpen || !chat) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col h-[85vh]">
        
        {/* HEADER */}
        <div className="bg-slate-50 px-8 py-5 border-b border-slate-200 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><Stethoscope className="w-6 h-6" /></div>
                    Finalizar Atendimento
                </h2>
                <div className="flex items-center gap-2 mt-1 ml-11">
                    <span className="text-sm text-slate-500">Paciente:</span>
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-sm font-bold text-slate-700">
                        {chat.contact_name || chat.phone}
                    </span>
                </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-white transition-all"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            {/* ESQUERDA: NAVEGAÇÃO E RESUMO */}
            <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
                <div className="p-4 space-y-2">
                    <button 
                        onClick={() => setActiveTab('products')}
                        className={`w-full p-4 rounded-xl flex items-center justify-between transition-all border ${activeTab === 'products' ? 'bg-white border-blue-200 shadow-sm text-blue-700' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
                    >
                        <div className="flex items-center gap-3 font-bold text-sm">
                            <ShoppingBag className="w-5 h-5"/> Farmácia/Loja
                        </div>
                        {countProd > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{countProd}</span>}
                    </button>

                    <button 
                        onClick={() => setActiveTab('services')}
                        className={`w-full p-4 rounded-xl flex items-center justify-between transition-all border ${activeTab === 'services' ? 'bg-white border-purple-200 shadow-sm text-purple-700' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
                    >
                        <div className="flex items-center gap-3 font-bold text-sm">
                            <Activity className="w-5 h-5"/> Exames/Vacinas
                        </div>
                        {countServ > 0 && <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{countServ}</span>}
                    </button>

                    <button 
                        onClick={() => setActiveTab('final')}
                        className={`w-full p-4 rounded-xl flex items-center justify-between transition-all border ${activeTab === 'final' ? 'bg-white border-emerald-200 shadow-sm text-emerald-700' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
                    >
                        <div className="flex items-center gap-3 font-bold text-sm">
                            <ClipboardList className="w-5 h-5"/> Prontuário & Retorno
                        </div>
                        {(returnDate || secretaryNotes) && <div className="w-2 h-2 rounded-full bg-emerald-500"></div>}
                    </button>
                </div>
                
                {/* Resumo do Carrinho */}
                <div className="flex-1 overflow-y-auto px-4 py-2">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Resumo do Envio</h3>
                    
                    {selectedItems.length === 0 && !returnDate ? (
                        <div className="text-center py-6 px-4 border-2 border-dashed border-slate-200 rounded-xl">
                            <p className="text-xs text-slate-400">Nenhum item adicionado.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 pb-4">
                            {selectedItems.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm text-xs">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.type === 'product' ? 'bg-blue-400' : 'bg-purple-400'}`}></div>
                                        <div>
                                            <p className="font-bold text-slate-700 truncate max-w-[140px]">{item.product.name}</p>
                                            <p className="text-slate-400">{item.qty} un</p>
                                        </div>
                                    </div>
                                    <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 p-1"><Minus className="w-4 h-4"/></button>
                                </div>
                            ))}
                            
                            {returnDate && (
                                <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg flex gap-2 items-center">
                                    <Calendar className="w-4 h-4 text-emerald-600"/>
                                    <div>
                                        <p className="text-[10px] font-bold text-emerald-700 uppercase">Retorno</p>
                                        <p className="text-xs font-bold text-emerald-800">{new Date(returnDate).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 bg-white">
                    <button 
                        onClick={handleFinish} 
                        disabled={loading}
                        className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-300/50 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processando...' : <>Enviar para Recepção <ArrowRight className="w-4 h-4"/></>}
                    </button>
                </div>
            </div>

            {/* DIREITA: ÁREA DE CONTEÚDO */}
            <div className="flex-1 bg-white flex flex-col overflow-hidden relative">
                
                {/* --- ABA 1: PRODUTOS --- */}
                {activeTab === 'products' && (
                    <div className="flex-1 flex flex-col p-6 animate-fade-in-right">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Prescrição de Loja</h3>
                                <p className="text-sm text-slate-500">Indique medicamentos e itens para o paciente levar.</p>
                            </div>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                                <input 
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar produto..."
                                    className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm"
                                    autoFocus
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-3">
                                {productsList.map(p => {
                                    const inCart = selectedItems.find(i => i.id === p.id);
                                    return (
                                        <div 
                                            key={p.id} 
                                            onClick={() => addItem(p, 'product')}
                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${inCart ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-blue-300'}`}
                                        >
                                            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden shrink-0 border border-slate-100">
                                                {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover"/> : <Pill className="w-6 h-6 text-slate-300"/>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-sm truncate ${inCart ? 'text-blue-800' : 'text-slate-700'}`}>{p.name}</p>
                                                <p className="text-xs text-slate-400">Estoque: {p.stock}</p>
                                            </div>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${inCart ? 'bg-blue-500 text-white' : 'bg-slate-50 text-slate-300 group-hover:bg-blue-100 group-hover:text-blue-500'}`}>
                                                {inCart ? <span className="font-bold text-xs">{inCart.qty}</span> : <Plus className="w-4 h-4"/>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ABA 2: SERVIÇOS --- */}
                {activeTab === 'services' && (
                    <div className="flex-1 flex flex-col p-6 animate-fade-in-right">
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-6 flex items-start gap-3">
                            <div className="p-2 bg-white rounded-lg text-purple-600 shadow-sm"><Activity className="w-5 h-5"/></div>
                            <div>
                                <h3 className="font-bold text-purple-900 text-sm">Procedimentos Internos</h3>
                                <p className="text-xs text-purple-700 mt-1">
                                    Adicione exames, vacinas ou procedimentos que o paciente deve realizar/pagar na recepção.
                                </p>
                            </div>
                        </div>

                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                            <input 
                                value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar exame ou vacina..."
                                className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-purple-500 text-sm"
                                autoFocus
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                            {servicesList.length === 0 ? (
                                <p className="text-center text-slate-400 text-sm py-8">Nenhum serviço encontrado.</p>
                            ) : servicesList.map(p => {
                                const inCart = selectedItems.find(i => i.id === p.id);
                                return (
                                    <div 
                                        key={p.id} 
                                        onClick={() => addItem(p, 'service')}
                                        className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all group ${inCart ? 'bg-purple-50 border-purple-200 shadow-inner' : 'bg-white border-slate-100 hover:border-purple-300 hover:shadow-sm'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${inCart ? 'bg-purple-200 text-purple-700' : 'bg-slate-50 text-slate-400 group-hover:bg-purple-100 group-hover:text-purple-600'}`}>
                                                <Stethoscope className="w-5 h-5"/>
                                            </div>
                                            <div>
                                                <p className={`font-bold ${inCart ? 'text-purple-900' : 'text-slate-700'}`}>{p.name}</p>
                                                <p className="text-xs text-slate-400">R$ {p.price_sale.toFixed(2)}</p>
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${inCart ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-600'}`}>
                                            {inCart ? `${inCart.qty} Adicionado(s)` : 'Adicionar'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* --- ABA 3: FINAL (Atualizada com Atalhos) --- */}
                {activeTab === 'final' && (
                    <div className="flex-1 flex flex-col p-6 animate-fade-in-right overflow-y-auto custom-scrollbar">
                        
                        {/* Seção Prontuário */}
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-slate-400"/> Prontuário Médico (Interno)
                            </label>
                            <p className="text-xs text-slate-500 mb-2">Estas anotações ficam salvas no histórico do paciente e NÃO aparecem para a recepção.</p>
                            <textarea 
                                value={medicalNotes} 
                                onChange={e => setMedicalNotes(e.target.value)}
                                className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none resize-none text-sm leading-relaxed transition-all"
                                placeholder="Descreva a evolução, diagnóstico e conduta..."
                            />
                        </div>

                        <div className="h-px bg-slate-100 w-full mb-8"></div>

                        {/* Seção Checkout */}
                        <div className="grid grid-cols-2 gap-8">
                            {/* Retorno (COM ATALHOS) */}
                            <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                                <label className="block text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-emerald-600"/> Agendar Retorno
                                </label>
                                <input 
                                    type="date" 
                                    value={returnDate} 
                                    onChange={e => setReturnDate(e.target.value)}
                                    className="w-full p-3 bg-white border border-emerald-200 rounded-xl focus:border-emerald-500 outline-none text-emerald-800 font-medium shadow-sm"
                                />
                                
                                {/* NOVOS ATALHOS */}
                                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                                    {[15, 30, 45, 60].map(days => (
                                        <button 
                                            key={days}
                                            onClick={() => setReturnInDays(days)}
                                            className="px-3 py-1.5 bg-white text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200 transition-all shadow-sm"
                                        >
                                            +{days} dias
                                        </button>
                                    ))}
                                </div>

                                <p className="text-[10px] text-emerald-600 mt-2 font-medium">
                                    *Isso alertará a secretária para agendar.
                                </p>
                            </div>

                            {/* Recados */}
                            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100">
                                <label className="block text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                                    <ClipboardList className="w-5 h-5 text-amber-600"/> Recado para Recepção
                                </label>
                                <textarea 
                                    value={secretaryNotes} 
                                    onChange={e => setSecretaryNotes(e.target.value)}
                                    className="w-full h-24 p-3 bg-white border border-amber-200 rounded-xl focus:border-amber-400 outline-none resize-none text-sm text-amber-900 placeholder-amber-300 shadow-sm"
                                    placeholder="Ex: Entregar atestado, dar desconto..."
                                />
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
      </div>
    </div>
  );
}