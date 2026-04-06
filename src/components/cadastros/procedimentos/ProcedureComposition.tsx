'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Trash2, Package } from 'lucide-react';
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

  // Estado do banco de itens (lado direito)
  const [products, setProducts] = useState<CompositionProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(false);
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

  // Load initial products when composition is enabled
  useEffect(() => {
    if (compositionEnabled) {
      loadProducts('', 0, false);
    }
  }, [compositionEnabled, loadProducts]);

  // Debounced search
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

  // Infinite scroll via IntersectionObserver
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

  const removeProduct = (index: number) => {
    onCompositionsChange(compositions.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, qty: number) => {
    onCompositionsChange(
      compositions.map((c, i) => i === index ? { ...c, quantity: Math.max(0.01, qty) } : c)
    );
  };

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
            <label className={labelClass}>Produtos na composição</label>
            {compositions.length > 0 ? (
              <div className="bg-slate-50 dark:bg-[#15171e] rounded-xl border border-slate-200 dark:border-[#3d3d48] overflow-hidden flex-1 flex flex-col">
                <div className="max-h-[350px] overflow-y-scroll scrollbar-visible flex-1">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-[#1c1c21] border-b border-slate-200 dark:border-[#3d3d48]">
                      <th className="px-3 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Produto</th>
                      <th className="px-3 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-center w-20">Qtd</th>
                      <th className="px-3 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right w-28">Preço Venda</th>
                      <th className="px-3 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right w-28">Preço Custo</th>
                      <th className="px-3 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                    {compositions.map((item, idx) => (
                      <tr key={item.product_id} className="hover:bg-white dark:hover:bg-[#1e2028] transition-colors">
                        <td className="px-3 py-2.5 text-slate-700 dark:text-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[200px]" title={item.product_name}>{item.product_name}</span>
                            {item.stock === 0 && (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                Sem estoque
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
                            onChange={e => updateQuantity(idx, Number(e.target.value))}
                            className="w-16 px-2 py-1 text-sm text-center border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-600 dark:text-[#d4d4d8]">
                          {formatCurrency(item.purchase_price * item.quantity)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-400 dark:text-[#71717a]">
                          {formatCurrency(item.cost_price * item.quantity)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeProduct(idx)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/10 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                {/* Totais */}
                <div className="px-3 py-2.5 bg-slate-100 dark:bg-[#1c1c21] border-t border-slate-200 dark:border-[#3d3d48] flex justify-end gap-6 text-xs font-bold">
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
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-[#15171e] rounded-xl border border-dashed border-slate-200 dark:border-[#3d3d48]">
                <div className="text-center py-8">
                  <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-[#3d3d48]" />
                  <p className="text-sm text-slate-400 dark:text-[#71717a]">Nenhum produto adicionado.</p>
                  <p className="text-xs text-slate-300 dark:text-[#52525b] mt-1">Selecione produtos da lista ao lado.</p>
                </div>
              </div>
            )}
          </div>

          {/* === LADO DIREITO: Banco de itens (40%) === */}
          <div className="flex-[2] flex flex-col">
            <label className={labelClass}>Itens disponíveis</label>

            {/* Busca */}
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

            {/* Lista de produtos */}
            <div
              ref={listRef}
              className="max-h-[400px] overflow-y-scroll scrollbar-visible bg-slate-50 dark:bg-[#15171e] rounded-xl border border-slate-200 dark:border-[#3d3d48]"
            >
              {products.length === 0 && !loadingProducts && (
                <div className="flex items-center justify-center h-full">
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

              {/* Sentinel para infinite scroll — só exibe se há mais páginas */}
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
