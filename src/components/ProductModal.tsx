'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Product, ProductBatch } from '@/types';
import { 
  X, Package, Tag, Save, Image as ImageIcon, 
  Link as LinkIcon, Calendar, Layers, Plus, Trash2 
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
        setFormData({
            name: product.name,
            category: product.category || '',
            price_cost: product.price_cost?.toString() || '0',
            price_sale: product.price_sale.toString(),
            description: product.description || '',
            image_url: product.image_url || ''
        });
        fetchBatches(product.id);
      } else {
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
      .gt('quantity', 0)
      .order('expiration_date', { ascending: true });
    
    if (data) setBatches(data as ProductBatch[]);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageInventory) {
      toast.error('Somente administradores podem cadastrar ou editar produtos.');
      return;
    }
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
      };

      if (product) {
        await supabase.from('products').update(payload).eq('id', product.id);
        if (profile?.id) {
          await logAudit({
            userId: profile.id,
            action: 'update',
            entityType: 'product',
            entityId: String(product.id),
            details: { payload }
          });
        }
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select().single();
        if (error) throw error;
        if (profile?.id) {
          await logAudit({
            userId: profile.id,
            action: 'create',
            entityType: 'product',
            entityId: String(data.id),
            details: { payload }
          });
        }
        setPendingNewProductId(data.id);
        setConfirmAddStockOpen(true);
        onSuccess();
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar produto.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddBatch() {
    if (!product) return;
    if (!canManageInventory) {
      toast.error('Somente administradores podem gerenciar lotes.');
      return;
    }
    if (!newBatch.batch_number || !newBatch.expiration_date || !newBatch.quantity) {
      toast.error("Preencha todos os campos.");
      return;
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
        if (profile?.id) {
          await logAudit({
            userId: profile.id,
            action: 'create',
            entityType: 'product_batch',
            details: {
              product_id: product.id,
              batch_number: newBatch.batch_number,
              expiration_date: newBatch.expiration_date,
              quantity: Number(newBatch.quantity || 0)
            }
          });
        }
        setNewBatch({ batch_number: '', expiration_date: '', quantity: '' });
        fetchBatches(product.id);
        onSuccess();
    } catch (err) {
        console.error(err);
        toast.error("Erro ao adicionar lote.");
    } finally {
        setLoading(false);
    }
  }

  async function handleDeleteBatchConfirm() {
    if (!canManageInventory) {
      toast.error('Somente administradores podem excluir lotes.');
      return;
    }
    const id = confirmDeleteBatch;
    if (id == null) return;
    setConfirmDeleteBatch(null);
    await supabase.from('product_batches').delete().eq('id', id);
    if (profile?.id) {
      await logAudit({
        userId: profile.id,
        action: 'delete',
        entityType: 'product_batch',
        entityId: String(id),
        details: {
          product_id: product?.id ?? null
        }
      });
    }
    if (product) fetchBatches(product.id);
    onSuccess();
  }

  if (!isOpen) return null;

  // CÁLCULOS
  const cost = parseFloat(formData.price_cost) || 0;
  const sale = parseFloat(formData.price_sale) || 0;
  const profit = sale - cost;
  const margin = sale > 0 ? Math.round((profit / sale) * 100) : 0;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* HEADER */}
          <div className="bg-slate-50 border-b border-slate-100 px-8 py-5 flex justify-between items-center">
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <Package className="w-5 h-5 text-blue-600" />
                 {product ? 'Gerenciar Produto' : 'Novo Produto'}
             </h2>
             <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
          </div>

          {/* TABS */}
          <div className="bg-slate-50 px-8 flex gap-6 border-b border-slate-100">
             <button onClick={() => setActiveTab('details')} className={`pb-3 border-b-2 ${activeTab === 'details' ? 'border-blue-500 text-blue-600' : 'border-transparent'}`}>Detalhes</button>
             <button onClick={() => product && setActiveTab('batches')} className={`pb-3 border-b-2 ${activeTab === 'batches' ? 'border-blue-500 text-blue-600' : 'border-transparent'} ${!product && 'opacity-50'}`}>Estoque</button>
          </div>

          {/* CONTEÚDO */}
          <div className="flex-1 overflow-y-auto p-8">
            {activeTab === 'details' ? (
              <form onSubmit={handleSaveProduct} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nome do Produto" className="w-full p-3 border rounded-xl" required />
                   <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-3 border rounded-xl">
                      <option value="">Categoria...</option>
                      <option value="Medicamento">Medicamento</option>
                      <option value="Suplemento">Suplemento</option>
                      <option value="Higiene">Higiene</option>
                   </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <input type="number" value={formData.price_cost} onChange={e => setFormData({...formData, price_cost: e.target.value})} placeholder="Custo" className="w-full p-3 border rounded-xl" step="0.01" />
                   <input type="number" value={formData.price_sale} onChange={e => setFormData({...formData, price_sale: e.target.value})} placeholder="Venda" className="w-full p-3 border rounded-xl" step="0.01" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                   <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500">Cancelar</button>
                   <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-xl">Salvar</button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                 <div className="flex gap-2 items-end">
                    <input value={newBatch.batch_number} onChange={e => setNewBatch({...newBatch, batch_number: e.target.value})} placeholder="Lote" className="flex-1 p-2 border rounded" />
                    <input type="date" value={newBatch.expiration_date} onChange={e => setNewBatch({...newBatch, expiration_date: e.target.value})} className="w-32 p-2 border rounded" />
                    <input type="number" value={newBatch.quantity} onChange={e => setNewBatch({...newBatch, quantity: e.target.value})} placeholder="Qtd" className="w-24 p-2 border rounded" />
                    <button onClick={handleAddBatch} className="bg-emerald-500 text-white p-2 rounded"><Plus className="w-5 h-5"/></button>
                 </div>
                 <div className="space-y-2">
                    {batches.map(b => (
                       <div key={b.id} className="flex justify-between p-3 border rounded bg-slate-50">
                          <span>{b.batch_number} ({new Date(b.expiration_date).toLocaleDateString()})</span>
                          <div className="flex gap-4">
                             <span className="font-bold">{b.quantity} un</span>
                             <button onClick={() => setConfirmDeleteBatch(b.id)}><Trash2 className="w-4 h-4 text-red-400"/></button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmAddStockOpen}
        onClose={() => setConfirmAddStockOpen(false)}
        onConfirm={() => { setConfirmAddStockOpen(false); setPendingNewProductId(null); onClose(); }}
        title="Produto Salvo"
        message="Deseja adicionar estoque agora?"
        type="info"
        confirmText="OK"
      />

      <ConfirmModal
        isOpen={confirmDeleteBatch != null}
        onClose={() => setConfirmDeleteBatch(null)}
        onConfirm={handleDeleteBatchConfirm}
        title="Apagar Lote"
        message="Confirmar exclusão?"
        type="danger"
        confirmText="Sim"
      />
    </>
  );
}