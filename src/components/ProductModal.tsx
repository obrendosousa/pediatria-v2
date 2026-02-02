'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, ProductBatch } from '@/types';
import { 
  X, Package, Tag, Save, BarChart3, Image as ImageIcon, 
  Link as LinkIcon, Calendar, Layers, Plus, Trash2, AlertCircle, CheckCircle2 
} from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

export default function ProductModal({ isOpen, onClose, onSuccess, product }: ProductModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'batches'>('details');
  const [loading, setLoading] = useState(false);
  
  // Dados do Produto
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price_cost: '0',
    price_sale: '0',
    description: '',
    image_url: ''
  });

  // Dados de Lotes (Batches)
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [newBatch, setNewBatch] = useState({
    batch_number: '',
    expiration_date: '',
    quantity: ''
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab('details');
      if (product) {
        // Carregar dados do produto
        setFormData({
            name: product.name,
            category: product.category || '',
            price_cost: product.price_cost?.toString() || '0',
            price_sale: product.price_sale.toString(),
            description: product.description || '',
            image_url: product.image_url || ''
        });
        // Carregar lotes
        fetchBatches(product.id);
      } else {
        // Reset para novo produto
        setFormData({ name: '', category: '', price_cost: '0', price_sale: '0', description: '', image_url: '' });
        setBatches([]);
      }
    }
  }, [isOpen, product]);

  async function fetchBatches(productId: number) {
    const { data } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', productId)
      .gt('quantity', 0) // Só mostra lotes com saldo
      .order('expiration_date', { ascending: true }); // FEFO: Vencimento mais próximo primeiro
    
    if (data) setBatches(data as ProductBatch[]);
  }

  // --- AÇÃO 1: SALVAR PRODUTO BÁSICO ---
  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        price_cost: parseFloat(formData.price_cost),
        price_sale: parseFloat(formData.price_sale),
        description: formData.description,
        image_url: formData.image_url,
        active: true
        // Nota: Não enviamos 'stock' aqui, a trigger do banco cuida disso
      };

      let productId = product?.id;

      if (product) {
        await supabase.from('products').update(payload).eq('id', product.id);
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select().single();
        if (error) throw error;
        productId = data.id;
        // Se criou novo, avisa para o usuário ir para a aba de lotes se quiser
        if(confirm("Produto criado! Deseja dar entrada no estoque (Lotes) agora?")) {
            // Recarrega como se fosse edição
            onSuccess(); // Atualiza lista ao fundo
            // Precisaríamos reabrir o modal com o produto novo, mas para simplificar:
            // Vamos fechar e pedir pro usuário editar, ou idealmente, setar o 'product' localmente.
            // Para V1, vamos fechar para garantir consistência.
            alert("Produto salvo. Abra-o novamente para adicionar Lotes.");
            onClose();
            return;
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar produto.');
    } finally {
      setLoading(false);
    }
  }

  // --- AÇÃO 2: ADICIONAR LOTE (ENTRADA) ---
  async function handleAddBatch() {
    if (!product) return alert("Salve o produto antes de adicionar lotes.");
    if (!newBatch.batch_number || !newBatch.expiration_date || !newBatch.quantity) {
        return alert("Preencha todos os campos do lote.");
    }

    setLoading(true);
    try {
        const { error } = await supabase.from('product_batches').insert({
            product_id: product.id,
            batch_number: newBatch.batch_number,
            expiration_date: newBatch.expiration_date,
            quantity: parseInt(newBatch.quantity)
        });

        if (error) throw error;

        // Limpa form e recarrega
        setNewBatch({ batch_number: '', expiration_date: '', quantity: '' });
        fetchBatches(product.id);
        onSuccess(); // Atualiza a lista principal para refletir novo estoque total
    } catch (err) {
        console.error(err);
        alert("Erro ao adicionar lote.");
    } finally {
        setLoading(false);
    }
  }

  // --- AÇÃO 3: REMOVER LOTE (Correção/Perda) ---
  async function handleDeleteBatch(id: number) {
      if(!confirm("Tem certeza? Isso removerá estas unidades do estoque.")) return;
      await supabase.from('product_batches').delete().eq('id', id);
      if(product) fetchBatches(product.id);
      onSuccess();
  }

  // Cálculos de UI
  const cost = parseFloat(formData.price_cost) || 0;
  const sale = parseFloat(formData.price_sale) || 0;
  const profit = sale - cost;
  const margin = sale > 0 ? Math.round((profit / sale) * 100) : 0;
  const totalStock = batches.reduce((acc, b) => acc + b.quantity, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        
        {/* Header com Abas */}
        <div className="bg-slate-50 border-b border-slate-100">
            <div className="px-8 py-5 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Package className="w-5 h-5" /></div>
                    {product ? 'Gerenciar Produto' : 'Novo Produto'}
                </h2>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-white transition-all"><X className="w-5 h-5" /></button>
            </div>
            
            {/* Navegação de Abas */}
            <div className="px-8 flex gap-6">
                <button 
                    onClick={() => setActiveTab('details')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'details' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    <Tag className="w-4 h-4"/> Detalhes Básicos
                </button>
                <button 
                    onClick={() => {
                        if (!product) return alert("Salve o produto primeiro para gerenciar estoque.");
                        setActiveTab('batches');
                    }}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'batches' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'} ${!product && 'opacity-50 cursor-not-allowed'}`}
                >
                    <Layers className="w-4 h-4"/> Estoque & Lotes
                    {product && batches.length > 0 && <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{batches.length}</span>}
                </button>
            </div>
        </div>

        {/* --- CONTEÚDO DA ABA: DETALHES --- */}
        {activeTab === 'details' && (
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="flex gap-6">
                    {/* Imagem */}
                    <div className="w-1/3 space-y-3">
                        <div className="aspect-square rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
                            {formData.image_url ? (
                                <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-4">
                                    <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400">Sem imagem</p>
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            <input 
                                value={formData.image_url}
                                onChange={e => setFormData({...formData, image_url: e.target.value})}
                                placeholder="URL da Imagem..."
                                className="w-full pl-8 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Dados */}
                    <div className="flex-1 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Comercial</label>
                            <input 
                                required
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="Ex: Paracetamol Bebê"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-sm font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
                                <select 
                                    value={formData.category}
                                    onChange={e => setFormData({...formData, category: e.target.value})}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="Medicamento">Medicamento</option>
                                    <option value="Suplemento">Suplemento</option>
                                    <option value="Higiene">Higiene</option>
                                    <option value="Acessórios">Acessórios</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estoque Total</label>
                                <div className="relative">
                                    <input 
                                        disabled
                                        value={product ? product.stock : 0} // Mostra o valor calculado pela trigger ou 0
                                        className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-sm font-bold text-slate-500 cursor-not-allowed"
                                    />
                                    <span className="absolute right-3 top-3.5 text-xs text-slate-400 font-bold">UN</span>
                                </div>
                            </div>
                        </div>

                        {/* Card Financeiro */}
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Custo (R$)</label>
                                <input 
                                    type="number" step="0.01" min="0"
                                    value={formData.price_cost}
                                    onChange={e => setFormData({...formData, price_cost: e.target.value})}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Venda (R$)</label>
                                <input 
                                    type="number" step="0.01" min="0" required
                                    value={formData.price_sale}
                                    onChange={e => setFormData({...formData, price_sale: e.target.value})}
                                    className="w-full p-2 bg-white border border-blue-300 rounded-lg text-sm font-bold text-blue-700 outline-none"
                                />
                            </div>
                            <div className="col-span-2 flex items-center justify-between text-xs pt-1">
                                <span className="font-bold text-slate-400">Margem Estimada:</span>
                                <span className={`font-bold ${margin >= 30 ? 'text-green-600' : 'text-orange-500'}`}>{margin}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-6 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-6 py-3 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl">Cancelar</button>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2"
                    >
                        {loading ? '...' : <><Save className="w-5 h-5" /> Salvar Alterações</>}
                    </button>
                </div>
            </form>
        )}

        {/* --- CONTEÚDO DA ABA: LOTES (ENTRADA) --- */}
        {activeTab === 'batches' && (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Área de Inserção */}
                <div className="p-6 bg-slate-50 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                        <Plus className="w-4 h-4"/> Nova Entrada de Estoque
                    </h3>
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Lote (Fabricante)</label>
                            <input 
                                value={newBatch.batch_number}
                                onChange={e => setNewBatch({...newBatch, batch_number: e.target.value})}
                                placeholder="Ex: L88302" 
                                className="w-full p-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="w-32">
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Validade</label>
                            <input 
                                type="date"
                                value={newBatch.expiration_date}
                                onChange={e => setNewBatch({...newBatch, expiration_date: e.target.value})}
                                className="w-full p-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="w-24">
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Qtd</label>
                            <input 
                                type="number" placeholder="0"
                                value={newBatch.quantity}
                                onChange={e => setNewBatch({...newBatch, quantity: e.target.value})}
                                className="w-full p-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500"
                            />
                        </div>
                        <button 
                            onClick={handleAddBatch}
                            disabled={loading}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white p-2.5 rounded-lg shadow-sm transition-all"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Lista de Lotes */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-white">
                    {batches.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <Layers className="w-10 h-10 mx-auto mb-2 opacity-50"/>
                            <p className="text-sm">Nenhum lote registrado.</p>
                        </div>
                    ) : (
                        batches.map(batch => {
                            const isExpired = new Date(batch.expiration_date) < new Date();
                            return (
                                <div key={batch.id} className={`flex items-center justify-between p-3 rounded-xl border ${isExpired ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100 hover:border-blue-200'} transition-all group`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${isExpired ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 uppercase">Lote: {batch.batch_number}</p>
                                            <p className={`text-sm font-bold ${isExpired ? 'text-red-600' : 'text-slate-800'}`}>
                                                Vence: {new Date(batch.expiration_date).toLocaleDateString('pt-BR')}
                                                {isExpired && <span className="ml-2 text-[10px] bg-red-200 text-red-700 px-1.5 py-0.5 rounded">VENCIDO</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Disponível</p>
                                            <p className="text-lg font-bold text-blue-600">{batch.quantity} un</p>
                                        </div>
                                        <button onClick={() => handleDeleteBatch(batch.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-500">
                        O sistema usará a lógica <strong className="text-blue-600">FEFO (Primeiro a Vencer, Primeiro a Sair)</strong> automaticamente nas vendas.
                    </p>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}