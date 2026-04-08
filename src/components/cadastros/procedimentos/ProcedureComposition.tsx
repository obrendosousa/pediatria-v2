'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Trash2, Package, Pencil, Check, X } from 'lucide-react';
import { useProcedures } from '@/hooks/useProcedures';
import {
  labelClass,
  formatCurrency,
  type ProductCompositionItem,
  type CompositionProduct,
} from './types';

interface Props {
  compositionEnabled: boolean;
  compositions: ProductCompositionItem[];
  onToggle: (enabled: boolean) => void;
  onCompositionsChange: (items: ProductCompositionItem[]) => void;
  onCompositionValueChange: (value: number, costValue: number) => void;
}

export default function ProcedureComposition({
  compositionEnabled,
  compositions,
  onToggle,
  onCompositionsChange,
  onCompositionValueChange,
}: Props) {
  const { fetchProducts } = useProcedures();

  const [products, setProducts] = useState<CompositionProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ProductCompositionItem>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const addedIds = new Set(compositions.map(c => c.product_id));

  // Fetch products
  const loadProducts = useCallback(async (search: string, pageNum: number, append: boolean) => {
    setLoadingProducts(true);
    try {
      const result = await fetchProducts(search, pageNum, 50);
      if (append) {
        setProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newItems = result.data.filter(p => !existingIds.has(p.id));
          return [...prev, ...newItems];
        });
      } else {
        setProducts(result.data);
      }
      setTotal(result.total);
    } catch {
      // silently fail
    } finally {
      setLoadingProducts(false);
    }
  }, [fetchProducts]);

  useEffect(() => {
    if (compositionEnabled) {
      loadProducts('', 0, false);
    }
  }, [compositionEnabled, loadProducts]);

  useEffect(() => {
    if (!compositionEnabled) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(0);
      loadProducts(searchTerm, 0, false);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm, compositionEnabled, loadProducts]);

  useEffect(() => {
    if (!compositionEnabled || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingProducts && products.length < total) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadProducts(searchTerm, nextPage, true);
        }
      },
      { root: listRef.current, threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [compositionEnabled, loadingProducts, products.length, total, page, searchTerm, loadProducts]);

  // Recalcular valores quando composicoes mudam
  useEffect(() => {
    const saleTotal = compositions.reduce((acc, item) => acc + item.purchase_price * item.quantity, 0);
    const costTotal = compositions.reduce((acc, item) => acc + item.cost_price * item.quantity, 0);
    onCompositionValueChange(
      Math.round(saleTotal * 100) / 100,
      Math.round(costTotal * 100) / 100
    );
  }, [compositions, onCompositionValueChange]);

  const addProduct = (product: CompositionProduct) => {
    if (addedIds.has(product.id)) return;
    onCompositionsChange([
      ...compositions,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        purchase_price: 0,
        cost_price: 0,
        stock: 0,
      },
    ]);
  };

  const addManualItem = () => {
    const manualId = `manual_${Date.now()}`;
    const newItem: ProductCompositionItem = {
      product_id: manualId,
      product_name: '',
      quantity: 1,
      purchase_price: 0,
      cost_price: 0,
      stock: 0,
      is_manual: true,
    };
    onCompositionsChange([...compositions, newItem]);
    // Já abre em modo edição
    setEditingIndex(compositions.length);
    setEditDraft({ ...newItem });
  };

  const removeProduct = (index: number) => {
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditDraft({});
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
    onCompositionsChange(compositions.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditDraft({ ...compositions[index] });
  };

  const cancelEdit = () => {
    // Se for item manual sem nome, remove
    if (editingIndex !== null) {
      const item = compositions[editingIndex];
      if (item?.is_manual && !item.product_name.trim()) {
        onCompositionsChange(compositions.filter((_, i) => i !== editingIndex));
      }
    }
    setEditingIndex(null);
    setEditDraft({});
  };

  const confirmEdit = () => {
    if (editingIndex === null) return;
    const name = (editDraft.product_name ?? '').trim();
    if (!name) return;

    onCompositionsChange(
      compositions.map((c, i) =>
        i === editingIndex
          ? {
              ...c,
              product_name: name,
              quantity: Math.max(0.01, editDraft.quantity ?? c.quantity),
              purchase_price: Math.max(0, editDraft.purchase_price ?? c.purchase_price),
              cost_price: Math.max(0, editDraft.cost_price ?? c.cost_price),
            }
          : c
      )
    );
    setEditingIndex(null);
    setEditDraft({});
  };

  const updateField = (index: number, field: keyof ProductCompositionItem, value: number) => {
    const min = field === 'quantity' ? 0.01 : 0;
    onCompositionsChange(
      compositions.map((c, i) => i === index ? { ...c, [field]: Math.max(min, value) } : c)
    );
  };

  const cellInput = 'w-full px-2 py-1 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400';

  return (
    <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
          <Package className="w-4 h-4 text-teal-500" />
          Composição do Procedimento
        </h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-slate-600 dark:text-[#d4d4d8]">
            {compositionEnabled ? 'Desabilitar composição' : 'Habilitar composição'}
          </span>
          <button
            type="button"
            onClick={() => onToggle(!compositionEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              compositionEnabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                compositionEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>

      {compositionEnabled && (
        <div className="flex gap-4 min-h-[400px]">
          {/* === LADO ESQUERDO: Produtos adicionados (60%) === */}
          <div className="flex-[3] flex flex-col">
            <div className="flex items-center justify-between mb-1.5 ml-1">
              <label className={`${labelClass} !mb-0`}>Produtos na composição</label>
              <button
                type="button"
                onClick={addManualItem}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar item manual
              </button>
            </div>

            {compositions.length > 0 ? (
              <div className="bg-slate-50 dark:bg-[#15171e] rounded-xl border border-slate-200 dark:border-[#3d3d48] overflow-hidden flex-1 flex flex-col">
                <div className="max-h-[350px] overflow-y-scroll scrollbar-visible flex-1">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-[#1c1c21] border-b border-slate-200 dark:border-[#3d3d48]">
                        <th className="px-3 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Item</th>
                        <th className="px-3 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-center w-20">Qtd</th>
                        <th className="px-3 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right w-28">Preço Venda</th>
                        <th className="px-3 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right w-28">Preço Custo</th>
                        <th className="px-3 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-center w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                      {compositions.map((item, idx) => {
                        const isEditing = editingIndex === idx;

                        if (isEditing) {
                          return (
                            <tr key={item.product_id} className="bg-teal-50/50 dark:bg-teal-900/10">
                              <td className="px-3 py-2">
                                <input
                                  autoFocus
                                  type="text"
                                  value={editDraft.product_name ?? ''}
                                  onChange={e => setEditDraft(d => ({ ...d, product_name: e.target.value }))}
                                  placeholder="Nome do item..."
                                  className={cellInput}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') confirmEdit();
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0.01}
                                  step={0.01}
                                  value={editDraft.quantity ?? 1}
                                  onChange={e => setEditDraft(d => ({ ...d, quantity: Number(e.target.value) }))}
                                  className={`${cellInput} text-center w-16`}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') confirmEdit();
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={editDraft.purchase_price ?? 0}
                                  onChange={e => setEditDraft(d => ({ ...d, purchase_price: Number(e.target.value) }))}
                                  className={`${cellInput} text-right w-24`}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') confirmEdit();
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={editDraft.cost_price ?? 0}
                                  onChange={e => setEditDraft(d => ({ ...d, cost_price: Number(e.target.value) }))}
                                  className={`${cellInput} text-right w-24`}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') confirmEdit();
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={confirmEdit}
                                    className="p-1 rounded hover:bg-teal-100 dark:hover:bg-teal-900/20 text-teal-600 transition-colors"
                                    title="Confirmar"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/10 text-red-400 transition-colors"
                                    title="Cancelar"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={item.product_id} className="hover:bg-white dark:hover:bg-[#1e2028] transition-colors group">
                            <td className="px-3 py-2.5 text-slate-700 dark:text-gray-200">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[200px]" title={item.product_name}>
                                  {item.product_name || <span className="italic text-slate-400">Sem nome</span>}
                                </span>
                                {item.is_manual && (
                                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                    Manual
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="number"
                                min={0.01}
                                step={0.01}
                                value={item.quantity}
                                onChange={e => updateField(idx, 'quantity', Number(e.target.value))}
                                className="w-16 px-2 py-1 text-sm text-center border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-600 dark:text-[#d4d4d8]">
                              {formatCurrency(item.purchase_price * item.quantity)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-400 dark:text-[#71717a]">
                              {formatCurrency(item.cost_price * item.quantity)}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEdit(idx)}
                                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-teal-600 opacity-0 group-hover:opacity-100 transition-all"
                                  title="Editar item"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeProduct(idx)}
                                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/10 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                                  title="Remover item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totais */}
                <div className="px-3 py-2.5 bg-slate-100 dark:bg-[#1c1c21] border-t border-slate-200 dark:border-[#3d3d48] flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400 dark:text-[#71717a]">
                    {compositions.length} {compositions.length === 1 ? 'item' : 'itens'}
                  </span>
                  <div className="flex gap-6">
                    <span className="text-slate-500 dark:text-[#a1a1aa]">
                      Total venda: <span className="font-mono text-teal-700 dark:text-teal-300">
                        {formatCurrency(compositions.reduce((a, c) => a + c.purchase_price * c.quantity, 0))}
                      </span>
                    </span>
                    <span className="text-slate-500 dark:text-[#a1a1aa]">
                      Total custo: <span className="font-mono text-slate-600 dark:text-[#d4d4d8]">
                        {formatCurrency(compositions.reduce((a, c) => a + c.cost_price * c.quantity, 0))}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-[#15171e] rounded-xl border border-dashed border-slate-200 dark:border-[#3d3d48]">
                <div className="text-center py-8">
                  <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-[#3d3d48]" />
                  <p className="text-sm text-slate-400 dark:text-[#71717a]">Nenhum item na composição.</p>
                  <p className="text-xs text-slate-300 dark:text-[#52525b] mt-1">Selecione do catálogo ao lado ou adicione um item manual.</p>
                </div>
              </div>
            )}
          </div>

          {/* === LADO DIREITO: Banco de itens (40%) === */}
          <div className="flex-[2] flex flex-col">
            <label className={labelClass}>Catálogo de produtos</label>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            <div
              ref={listRef}
              className="max-h-[400px] overflow-y-scroll scrollbar-visible bg-slate-50 dark:bg-[#15171e] rounded-xl border border-slate-200 dark:border-[#3d3d48] flex-1"
            >
              {products.length === 0 && !loadingProducts && (
                <div className="flex items-center justify-center h-full min-h-[100px]">
                  <p className="text-sm text-slate-400 dark:text-[#71717a]">Nenhum produto encontrado.</p>
                </div>
              )}

              {products.map(product => {
                const isAdded = addedIds.has(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={isAdded}
                    onClick={() => addProduct(product)}
                    className={`flex items-center justify-between w-full px-4 py-2.5 text-left border-b border-slate-100 dark:border-[#252530] transition-colors ${
                      isAdded
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-[#1c1c21]'
                        : 'hover:bg-teal-50 dark:hover:bg-teal-900/10 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm text-slate-700 dark:text-gray-200 truncate" title={product.name}>
                        {product.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {!isAdded && <Plus className="w-4 h-4 text-teal-500" />}
                    </div>
                  </button>
                );
              })}

              {products.length < total && (
                <>
                  <div ref={sentinelRef} className="h-1" />
                  {loadingProducts && (
                    <div className="flex items-center justify-center py-3">
                      <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-2 text-xs text-slate-400 dark:text-[#71717a] text-right">
              {products.length} de {total} produtos
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
