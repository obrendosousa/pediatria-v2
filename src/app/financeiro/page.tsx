'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  PieChart, TrendingUp, Users, DollarSign, Activity, 
  ArrowUpRight, Award, Wallet, Stethoscope, ShoppingBag
} from 'lucide-react';

export default function FinancialPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    serviceRevenue: 0,
    productRevenue: 0,
    ltv: 0,
    bestClients: [] as any[]
  });

  useEffect(() => {
    fetchFinancials();
  }, []);

  async function fetchFinancials() {
    setLoading(true);
    
    // 1. Busca TODAS as vendas pagas com detalhes
    const { data: sales } = await supabase
      .from('sales' as any)
      .select(`
        id, total, created_at, chat_id,
        chats ( phone ),
        sale_items (
            quantity, unit_price,
            products ( category )
        )
      `)
      .eq('status', 'paid');

    if (sales) {
        let total = 0;
        let serviceRev = 0;
        let productRev = 0;
        const clientSpend: Record<string, { name: string, total: number, visits: number }> = {};

        sales.forEach((sale: any) => {
            total += sale.total;
            
            // Separação Receita (Serviço vs Produto)
            sale.sale_items.forEach((item: any) => {
                const amount = item.quantity * item.unit_price;
                const cat = item.products?.category || '';
                // Considera serviço se a categoria contiver "Serviço" ou "Consulta"
                if (cat.includes('Serviço') || cat.includes('Consulta') || cat.includes('Vacina')) {
                    serviceRev += amount;
                } else {
                    productRev += amount;
                }
            });

            // LTV por Cliente
            const clientId = sale.chat_id;
            const clientName = sale.chats?.phone || 'Cliente não identificado';
            
            if (clientId) {
                if (!clientSpend[clientId]) {
                    clientSpend[clientId] = { name: clientName, total: 0, visits: 0 };
                }
                clientSpend[clientId].total += sale.total;
                clientSpend[clientId].visits += 1;
            }
        });

        // Top Clientes
        const sortedClients = Object.values(clientSpend)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        // LTV Médio
        const uniqueClients = Object.keys(clientSpend).length;
        const avgLtv = uniqueClients > 0 ? total / uniqueClients : 0;

        setMetrics({
            totalRevenue: total,
            serviceRevenue: serviceRev,
            productRevenue: productRev,
            ltv: avgLtv,
            bestClients: sortedClients
        });
    }
    setLoading(false);
  }

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-[#0b141a] relative overflow-hidden transition-colors duration-300">
      
      {/* Decoração Sutil */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-rose-100/40 dark:bg-rose-900/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3 transition-colors"></div>

      {/* Header Padronizado */}
      <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-[#1e2028] border-b border-slate-100 dark:border-gray-800 shadow-sm z-20 transition-colors">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <PieChart className="w-5 h-5" />
            </div>
            <div>
                <h1 className="text-base font-bold text-slate-800 dark:text-gray-100 leading-none">Gestão Financeira</h1>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Visão consolidada de saúde do negócio</p>
            </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-800">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Dados Atualizados</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 z-10">
        
        {/* Grid de KPIs */}
        <div className="grid grid-cols-3 gap-6 mb-8">
            
            {/* Card Hero: Faturamento Total */}
            <div className="bg-gradient-to-br from-rose-500 to-pink-600 dark:from-rose-600 dark:to-pink-800 rounded-3xl p-6 text-white shadow-xl shadow-rose-200 dark:shadow-none flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-20 transform rotate-12 group-hover:scale-110 transition-transform duration-700">
                    <Wallet className="w-32 h-32" />
                </div>
                
                <div>
                    <div className="flex items-center gap-2 mb-1 opacity-90">
                        <DollarSign className="w-4 h-4" />
                        <p className="text-xs font-bold uppercase tracking-wider">Receita Total Acumulada</p>
                    </div>
                    <h2 className="text-4xl font-bold tracking-tight">
                        R$ {metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h2>
                </div>
                
                <div className="mt-6 flex items-center gap-2">
                    <span className="bg-white/20 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 border border-white/10">
                        <ArrowUpRight className="w-3 h-3" /> Resultado Consolidado
                    </span>
                </div>
            </div>

            {/* Card LTV */}
            <div className="bg-white dark:bg-[#1e2028] p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-gray-800 flex flex-col justify-between relative overflow-hidden hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-bl-full -mr-4 -mt-4 opacity-50"></div>
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p className="text-slate-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">LTV (Valor Vitalício)</p>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-gray-100">
                            R$ {metrics.ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl">
                        <Activity className="w-6 h-6" />
                    </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400 relative z-10">
                    Média gasta por paciente em todo o histórico da clínica.
                </p>
            </div>

            {/* Card Split de Receita */}
            <div className="bg-white dark:bg-[#1e2028] p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-gray-800 flex flex-col justify-center transition-colors">
                <h3 className="font-bold text-slate-800 dark:text-gray-100 mb-5 flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Origem da Receita
                </h3>
                
                <div className="space-y-5">
                    {/* Serviços */}
                    <div className="group">
                        <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-gray-400 mb-1.5 px-1">
                            <span className="flex items-center gap-1.5"><Stethoscope className="w-3 h-3 text-emerald-500"/> Serviços (Consultas)</span>
                            <span className="text-slate-700 dark:text-gray-200">R$ {metrics.serviceRevenue.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden relative">
                            <div 
                                className="h-full bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.4)]" 
                                style={{ width: `${metrics.totalRevenue > 0 ? (metrics.serviceRevenue / metrics.totalRevenue) * 100 : 0}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Produtos */}
                    <div className="group">
                        <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-gray-400 mb-1.5 px-1">
                            <span className="flex items-center gap-1.5"><ShoppingBag className="w-3 h-3 text-rose-500"/> Produtos (Loja)</span>
                            <span className="text-slate-700 dark:text-gray-200">R$ {metrics.productRevenue.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden relative">
                            <div 
                                className="h-full bg-rose-400 rounded-full shadow-[0_0_10px_rgba(251,113,133,0.4)]" 
                                style={{ width: `${metrics.totalRevenue > 0 ? (metrics.productRevenue / metrics.totalRevenue) * 100 : 0}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Tabela Top Clientes (Curva ABC) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-3xl border border-slate-100 dark:border-gray-800 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-slate-50 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-[#1e2028]">
                <h3 className="font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
                    <div className="p-1.5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-lg">
                        <Award className="w-5 h-5" /> 
                    </div>
                    Top Pacientes VIP (Curva A)
                </h3>
                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full">Baseado no volume de compras</span>
            </div>
            
            <div className="p-2">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase border-b border-slate-50 dark:border-gray-800 bg-slate-50/50 dark:bg-[#202c33]/50">
                            <th className="p-4 pl-6 rounded-l-xl">Rank</th>
                            <th className="p-4">Paciente / Responsável</th>
                            <th className="p-4 text-center">Frequência</th>
                            <th className="p-4 text-right pr-6 rounded-r-xl">Total Gasto</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {metrics.bestClients.length === 0 && (
                            <tr><td colSpan={4} className="p-10 text-center text-slate-400 dark:text-gray-600 italic">Ainda não há dados suficientes para gerar o ranking.</td></tr>
                        )}
                        {metrics.bestClients.map((client, index) => (
                            <tr key={index} className="hover:bg-rose-50/30 dark:hover:bg-rose-900/10 transition-colors border-b border-slate-50 dark:border-gray-800 last:border-0 group">
                                <td className="p-4 pl-6">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm border border-transparent group-hover:scale-110 transition-transform
                                        ${index === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' : 
                                          index === 1 ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 
                                          index === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}
                                    `}>
                                        {index + 1}º
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-gray-500 font-bold text-xs">
                                            {client.name.charAt(0)}
                                        </div>
                                        <span className="font-bold text-slate-700 dark:text-gray-200">{client.name}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-300 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-700">
                                        {client.visits} visitas
                                    </span>
                                </td>
                                <td className="p-4 text-right pr-6">
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                        R$ {client.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

      </div>
    </div>
  );
}