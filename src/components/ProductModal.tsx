'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Product, ProductBatch } from '@/types';
import {
  X, Package, Save, Plus, Trash2, Barcode,
  DollarSign, TrendingUp, AlertTriangle, Calendar, Layers, Archive,
  Upload, ImageIcon, Loader2
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/audit';
import ConfirmModal from '@/components/ui/ConfirmModal';

const supabase = createClient();

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

export default function ProductModal({ isOpen, onClose, onSuccess, product }: ProductModalProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const canManageInventory = profile?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'details' | 'batches'>('details');
  const [loading, setLoading] = useState(false);
  const [confirmAddStockOpen, setConfirmAddStockOpen] = useState(false);
  const [pendingNewProductId, setPendingNewProductId] = useState<number | null>(null);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price_cost: '',
    price_sale: '',
    description: '',
    image_url: '',
    barcode: ''
  });

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
        setFormData({
          name: product.name,
          category: product.category || '',
          price_cost: product.price_cost ? String(product.price_cost) : '',
          price_sale: String(product.price_sale),
          description: product.description || '',
          image_url: product.image_url || '',
          barcode: (product as unknown as Record<string, string>).barcode || ''
        });
        fetchBatches(product.id);
      } else {
        setFormData({ name: '', category: '', price_cost: '', price_sale: '', description: '', image_url: '', barcode: '' });
        setBatches([]);
      }
    }
     
  }, [isOpen, product]);

  async function fetchBatches(productId: number) {
    const { data } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', productId)
      .gt('quantity', 0)
      .order('expiration_date', { ascending: true });
    if (data) setBatches(data as ProductBatch[]);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem (JPG, PNG ou WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo: 5MB.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/product-image', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro no upload');
      }

      const { url } = await res.json();
      setFormData(prev => ({ ...prev, image_url: url }));
      toast.success('Imagem enviada!');
    } catch (err) {
      console.error('Erro no upload:', err);
      toast.error('Erro ao enviar imagem. Tente novamente.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleRemoveImage() {
    setFormData(prev => ({ ...prev, image_url: '' }));
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageInventory) {
      toast.error('Somente administradores podem cadastrar ou editar produtos.');
      return;
    }
    if (!formData.name.trim()) { toast.error('Nome do produto é obrigatório.'); return; }
    if (!formData.price_sale || parseFloat(formData.price_sale) <= 0) { toast.error('Preço de venda é obrigatório.'); return; }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        category: formData.category || null,
        price_cost: formData.price_cost ? parseFloat(formData.price_cost) : 0,
        price_sale: parseFloat(formData.price_sale),
        description: formData.description.trim() || null,
        image_url: formData.image_url.trim() || null,
        barcode: formData.barcode.trim() || null,
        active: true
      };

      if (product) {
        const res = await fetch('/api/store/products', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: product.id, ...payload }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Erro ao atualizar produto');
        }
        if (profile?.id) {
          await logAudit({ userId: profile.id, action: 'update', entityType: 'product', entityId: String(product.id), details: { payload } });
        }
        toast.success('Produto atualizado!');
        onSuccess();
        onClose();
      } else {
        const res = await fetch('/api/store/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Erro ao criar produto');
        }
        const { data } = await res.json();
        if (profile?.id) {
          await logAudit({ userId: profile.id, action: 'create', entityType: 'product', entityId: String(data.id), details: { payload } });
        }
        setPendingNewProductId(data.id);
        setConfirmAddStockOpen(true);
        onSuccess();
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar produto.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddBatch() {
    const targetId = product?.id ?? pendingNewProductId;
    if (!targetId) { toast.error('Salve o produto antes de adicionar estoque.'); return; }
    if (!canManageInventory) { toast.error('Somente administradores podem gerenciar lotes.'); return; }
    if (!newBatch.batch_number.trim()) { toast.error('Informe o número do lote.'); return; }
    if (!newBatch.expiration_date) { toast.error('Informe a data de validade.'); return; }
    if (!newBatch.quantity || parseInt(newBatch.quantity) <= 0) { toast.error('Quantidade deve ser maior que zero.'); return; }

    setLoading(true);
    try {
      const qty = parseInt(newBatch.quantity);
      const { error } = await supabase.from('product_batches').insert({
        product_id: targetId,
        batch_number: newBatch.batch_number.trim(),
        expiration_date: newBatch.expiration_date,
        quantity: qty
      });
      if (error) throw error;

      const { data: allBatches } = await supabase
        .from('product_batches')
        .select('quantity')
        .eq('product_id', targetId)
        .gt('quantity', 0);
      const totalStock = (allBatches || []).reduce((acc, b) => acc + Number(b.quantity || 0), 0);
      await supabase.from('products').update({ stock: totalStock }).eq('id', targetId);

      if (profile?.id) {
        await logAudit({
          userId: profile.id, action: 'create', entityType: 'product_batch',
          details: { product_id: targetId, batch_number: newBatch.batch_number, quantity: qty }
        });
      }

      toast.success(`Lote "${newBatch.batch_number}" adicionado — ${qty} unidades`);
      setNewBatch({ batch_number: '', expiration_date: '', quantity: '' });
      fetchBatches(targetId);
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao adicionar lote.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBatchConfirm() {
    if (!canManageInventory) { toast.error('Somente administradores podem excluir lotes.'); return; }
    const id = confirmDeleteBatch;
    if (id == null) return;
    setConfirmDeleteBatch(null);

    const targetId = product?.id ?? pendingNewProductId;
    await supabase.from('product_batches').delete().eq('id', id);

    if (targetId) {
      const { data: remaining } = await supabase.from('product_batches').select('quantity').eq('product_id', targetId).gt('quantity', 0);
      const totalStock = (remaining || []).reduce((acc, b) => acc + Number(b.quantity || 0), 0);
      await supabase.from('products').update({ stock: totalStock }).eq('id', targetId);
      fetchBatches(targetId);
    }

    if (profile?.id) {
      await logAudit({ userId: profile.id, action: 'delete', entityType: 'product_batch', entityId: String(id), details: { product_id: targetId } });
    }
    onSuccess();
  }

  if (!isOpen) return null;

  const cost = parseFloat(formData.price_cost) || 0;
  const sale = parseFloat(formData.price_sale) || 0;
  const profit = sale - cost;
  const margin = sale > 0 ? Math.round((profit / sale) * 100) : 0;
  const totalBatchStock = batches.reduce((acc, b) => acc + b.quantity, 0);

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-white dark:bg-[#141419] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-[#2d2d36]">

          {/* HEADER */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex justify-between items-center">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Package className="w-5 h-5" />
              {product ? 'Editar Produto' : 'Cadastrar Novo Produto'}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* TABS */}
          <div className="bg-slate-50 dark:bg-[#1c1c21] px-6 flex gap-1 border-b border-slate-200 dark:border-[#2d2d36]">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-[#a1a1aa] hover:text-slate-700'
              }`}
            >
              <Package className="w-4 h-4" /> Detalhes
            </button>
            <button
              onClick={() => (product || pendingNewProductId) && setActiveTab('batches')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'batches'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-[#a1a1aa] hover:text-slate-700'
              } ${!product && !pendingNewProductId ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Layers className="w-4 h-4" /> Estoque & Lotes
              {totalBatchStock > 0 && (
                <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalBatchStock}</span>
              )}
            </button>
          </div>

          {/* CONTEÚDO */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'details' ? (
              <form onSubmit={handleSaveProduct} className="p-6 space-y-5">

                {/* Imagem do Produto */}
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wide mb-2 flex items-center gap-1.5 block">
                    <ImageIcon className="w-3.5 h-3.5" /> Foto do Produto
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  {formData.image_url ? (
                    <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-200 dark:border-[#3d3d48] bg-slate-50 dark:bg-[#1c1c21] group">
                      <img
                        src={formData.image_url}
                        alt="Produto"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-2 bg-white rounded-lg text-xs font-bold text-slate-700 shadow-lg flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" /> Trocar
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="px-3 py-2 bg-red-500 rounded-lg text-xs font-bold text-white shadow-lg flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#3d3d48] hover:border-blue-400 dark:hover:border-blue-600 bg-slate-50 dark:bg-[#1c1c21] hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                          <span className="text-xs text-blue-500 font-medium">Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-slate-400 dark:text-[#71717a] group-hover:text-blue-500 transition-colors" />
                          <span className="text-xs text-slate-500 dark:text-[#a1a1aa] group-hover:text-blue-600 font-medium">Clique para enviar uma foto</span>
                          <span className="text-[10px] text-slate-400 dark:text-[#71717a]">JPG, PNG ou WebP (max 5MB)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Nome do Produto */}
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wide mb-1.5 block">
                    Nome do Produto *
                  </label>
                  <input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Vitamina D3 Gotas 200UI"
                    className="w-full px-4 py-3 border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#08080b] text-slate-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                    required
                  />
                </div>

                {/* Categoria + Código de Barras */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wide mb-1.5 block">
                      Categoria
                    </label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#08080b] text-slate-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                    >
                      <option value="">Selecionar categoria...</option>
                      <option value="Medicamento">Medicamento</option>
                      <option value="Suplemento">Suplemento</option>
                      <option value="Higiene">Higiene</option>
                      <option value="Cosmético">Cosmético</option>
                      <option value="Acessório">Acessório</option>
                      <option value="Brinquedo">Brinquedo</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wide mb-1.5 flex items-center gap-1.5 block">
                      <Barcode className="w-3.5 h-3.5" /> Código de Barras
                    </label>
                    <input
                      value={formData.barcode}
                      onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="EAN-13 ou código interno"
                      className="w-full px-4 py-3 border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#08080b] text-slate-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Preços */}
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wide mb-1.5 flex items-center gap-1.5 block">
                    <DollarSign className="w-3.5 h-3.5" /> Preços
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                      <input
                        type="number"
                        value={formData.price_cost}
                        onChange={e => setFormData({ ...formData, price_cost: e.target.value })}
                        placeholder="0,00"
                        step="0.01"
                        min="0"
                        className="w-full pl-10 pr-16 py-3 border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#08080b] text-slate-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 uppercase font-bold">Custo</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                      <input
                        type="number"
                        value={formData.price_sale}
                        onChange={e => setFormData({ ...formData, price_sale: e.target.value })}
                        placeholder="0,00"
                        step="0.01"
                        min="0"
                        required
                        className="w-full pl-10 pr-16 py-3 border border-blue-300 dark:border-blue-700 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 text-slate-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-semibold"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-blue-500 uppercase font-bold">Venda *</span>
                    </div>
                  </div>

                  {sale > 0 && (
                    <div className="mt-3 flex items-center gap-4 text-xs">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${profit > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="font-bold">Lucro: R$ {profit.toFixed(2)}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${margin >= 30 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : margin >= 15 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                        {margin < 15 && <AlertTriangle className="w-3.5 h-3.5" />}
                        <span className="font-bold">Margem: {margin}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Descrição */}
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wide mb-1.5 block">
                    Descrição / Observações
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Composição, posologia, fabricante, observações..."
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#08080b] text-slate-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm resize-none"
                  />
                </div>

                {/* Botões */}
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-[#2d2d36]">
                  <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={loading || uploading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20">
                    <Save className="w-4 h-4" />
                    {loading ? 'Salvando...' : product ? 'Atualizar Produto' : 'Cadastrar Produto'}
                  </button>
                </div>
              </form>
            ) : (
              /* ABA DE ESTOQUE & LOTES */
              <div className="p-6 space-y-5">

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
                      <Archive className="w-4 h-4 text-blue-500" /> Lotes em Estoque
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#a1a1aa] mt-0.5">
                      Gerenciamento FEFO (primeiro a vencer, primeiro a sair)
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl">
                    <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Total em estoque</span>
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400">{totalBatchStock} <span className="text-xs font-normal">un</span></p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#1c1c21] rounded-xl p-4 border border-slate-200 dark:border-[#2d2d36]">
                  <p className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Adicionar Novo Lote
                  </p>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">N° do Lote</label>
                      <input
                        value={newBatch.batch_number}
                        onChange={e => setNewBatch({ ...newBatch, batch_number: e.target.value })}
                        placeholder="Ex: LT-2026-001"
                        className="w-full px-3 py-2.5 border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#08080b] text-sm text-slate-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1 block">
                        <Calendar className="w-3 h-3" /> Validade
                      </label>
                      <input
                        type="date"
                        value={newBatch.expiration_date}
                        onChange={e => setNewBatch({ ...newBatch, expiration_date: e.target.value })}
                        className="w-full px-3 py-2.5 border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#08080b] text-sm text-slate-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Qtd</label>
                      <input
                        type="number"
                        value={newBatch.quantity}
                        onChange={e => setNewBatch({ ...newBatch, quantity: e.target.value })}
                        placeholder="0"
                        min="1"
                        className="w-full px-3 py-2.5 border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#08080b] text-sm text-slate-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-center font-bold"
                      />
                    </div>
                    <div className="col-span-2 flex items-end">
                      <button
                        onClick={handleAddBatch}
                        disabled={loading}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" /> Adicionar
                      </button>
                    </div>
                  </div>
                </div>

                {batches.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 dark:text-[#71717a]">
                    <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhum lote cadastrado</p>
                    <p className="text-xs mt-1">Adicione lotes acima para controlar o estoque</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {batches.map(b => {
                      const expDate = new Date(b.expiration_date + 'T00:00:00');
                      const today = new Date();
                      const daysToExpire = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const isExpired = daysToExpire < 0;
                      const isExpiring = daysToExpire >= 0 && daysToExpire <= 30;

                      return (
                        <div
                          key={b.id}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                            isExpired
                              ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                              : isExpiring
                              ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
                              : 'bg-white dark:bg-[#08080b] border-slate-200 dark:border-[#2d2d36]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isExpired ? 'bg-red-100 dark:bg-red-900/20 text-red-500' : isExpiring ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-500' : 'bg-slate-100 dark:bg-[#1c1c21] text-slate-500'}`}>
                              <Layers className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 dark:text-[#fafafa]">{b.batch_number}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">
                                  Validade: {expDate.toLocaleDateString('pt-BR')}
                                </span>
                                {isExpired && (
                                  <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> VENCIDO
                                  </span>
                                )}
                                {isExpiring && !isExpired && (
                                  <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">
                                    Vence em {daysToExpire}d
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-lg font-black text-slate-800 dark:text-[#fafafa]">{b.quantity}</p>
                              <p className="text-[10px] text-slate-400 uppercase">unidades</p>
                            </div>
                            <button
                              onClick={() => setConfirmDeleteBatch(b.id)}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                              title="Remover lote"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmAddStockOpen}
        onClose={() => { setConfirmAddStockOpen(false); setPendingNewProductId(null); onClose(); }}
        onConfirm={() => {
          setConfirmAddStockOpen(false);
          setActiveTab('batches');
          if (pendingNewProductId) fetchBatches(pendingNewProductId);
        }}
        title="Produto Cadastrado!"
        message="Produto salvo com sucesso. Deseja adicionar estoque (lotes) agora?"
        type="info"
        confirmText="Sim, adicionar estoque"
        cancelText="Depois"
      />

      <ConfirmModal
        isOpen={confirmDeleteBatch != null}
        onClose={() => setConfirmDeleteBatch(null)}
        onConfirm={handleDeleteBatchConfirm}
        title="Remover Lote"
        message="Tem certeza que deseja remover este lote? O estoque será atualizado automaticamente."
        type="danger"
        confirmText="Sim, remover"
        cancelText="Cancelar"
      />
    </>
  );
}
