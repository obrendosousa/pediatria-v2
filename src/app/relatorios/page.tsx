'use client';

import { useState, useEffect } from 'react';
import { FileText, Calendar, Clock, ArrowRight, FileSearch, Sparkles, Filter, ChevronRight, BarChart2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';

const supabase = createClient();

interface Report {
    id: number;
    titulo: string;
    tipo: string;
    created_at: string;
}

export default function RelatoriosPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [confirmDelete, setConfirmDelete] = useState<Report | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('clara_reports')
                .select('id, titulo, tipo, created_at')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erro ao buscar relatórios:', error);
            } else {
                setReports(data || []);
            }
        } catch (err) {
            console.error('Erro inesperado:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, report: Report) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmDelete(report);
    };

    const handleDeleteConfirm = async () => {
        if (!confirmDelete) return;

        try {
            const { error } = await supabase
                .from('clara_reports')
                .delete()
                .eq('id', confirmDelete.id);

            if (error) throw error;

            toast.success('Relatório excluído com sucesso');
            fetchReports();
        } catch (error) {
            console.error('Erro ao excluir relatório:', error);
            toast.error('Erro ao excluir relatório');
        } finally {
            setConfirmDelete(null);
        }
    };

    const getReportTypeLabel = (type: string) => {
        switch (type) {
            case 'analise_chats': return 'Análise de Chats';
            case 'financeiro': return 'Financeiro';
            case 'agendamento': return 'Agendamentos';
            case 'geral': return 'Geral';
            default: return type || 'Relatório';
        }
    };

    const getReportTypeColor = (type: string) => {
        switch (type) {
            case 'analise_chats': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
            case 'financeiro': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
            case 'agendamento': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
        }
    };

    const getReportIcon = (type: string) => {
        switch (type) {
            case 'analise_chats': return <FileSearch className="w-5 h-5 text-purple-500" />;
            case 'financeiro': return <BarChart2 className="w-5 h-5 text-emerald-500" />;
            case 'agendamento': return <Calendar className="w-5 h-5 text-blue-500" />;
            default: return <FileText className="w-5 h-5 text-slate-500" />;
        }
    };

    // Extrair tipos únicos para o filtro
    const uniqueTypes = Array.from(new Set(reports.map(r => r.tipo).filter(Boolean)));

    const filteredReports = reports.filter(report => {
        const matchesSearch = report.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            report.id.toString() === searchTerm;
        const matchesType = typeFilter === 'all' || report.tipo === typeFilter;
        return matchesSearch && matchesType;
    });

    return (
        <div className="flex flex-col h-screen bg-[#f8fafc] dark:bg-[#0b141a] overflow-hidden transition-colors duration-300">
            {/* Header */}
            <div className="bg-white dark:bg-[#1e2028] px-8 py-8 border-b border-slate-200 dark:border-gray-800 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center shrink-0 transition-colors relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

                <div className="z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 dark:text-gray-100 flex items-center gap-2">
                                Relatórios Gerenciais da IA
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium mt-1">
                                Acesse as análises detalhadas geradas pela Clara sobre o desempenho da clínica.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto z-10">
                    <div className="relative flex-1 sm:w-64">
                        <FileSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por ID ou título..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#252833] border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* Filters Toolbar */}
                <div className="px-8 pt-6 pb-2 z-10">
                    <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-gray-400 mr-2 shrink-0">
                            <Filter className="w-4 h-4" /> Filtros:
                        </div>
                        <button
                            onClick={() => setTypeFilter('all')}
                            className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold transition-all shrink-0 ${typeFilter === 'all'
                                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-[#1e2028] dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5'
                                }`}
                        >
                            Todos
                        </button>
                        {uniqueTypes.map(type => (
                            <button
                                key={type}
                                onClick={() => setTypeFilter(type)}
                                className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold transition-all shrink-0 ${typeFilter === type
                                    ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-[#1e2028] dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5'
                                    }`}
                            >
                                {getReportTypeLabel(type)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                    <div className="max-w-7xl mx-auto pb-12">

                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
                            </div>
                        ) : filteredReports.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {filteredReports.map((report) => (
                                    <Link href={`/relatorios/${report.id}`} key={report.id} className="group outline-none">
                                        <div className="bg-white dark:bg-[#1e2028] border border-slate-200/80 dark:border-gray-700/80 rounded-3xl p-6 hover:shadow-xl hover:shadow-indigo-500/5 dark:hover:shadow-black/50 hover:border-indigo-200 dark:hover:border-indigo-800/50 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full relative overflow-hidden">

                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-12 h-12 bg-slate-50 dark:bg-[#252833] rounded-2xl flex items-center justify-center border border-slate-100 dark:border-gray-800 group-hover:scale-110 transition-transform">
                                                    {getReportIcon(report.tipo)}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-400 bg-slate-50 dark:bg-[#252833] dark:text-gray-500 px-2 py-1 rounded-md">
                                                        ID {report.id}
                                                    </span>
                                                    <button
                                                        onClick={(e) => handleDeleteClick(e, report)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors z-10"
                                                        title="Excluir Relatório"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-2 line-clamp-2 min-h-[56px]">
                                                {report.titulo || `Relatório #${report.id}`}
                                            </h3>

                                            <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100 dark:border-gray-800/50">
                                                <div className="flex flex-col gap-2">
                                                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md border w-fit ${getReportTypeColor(report.tipo)}`}>
                                                        {getReportTypeLabel(report.tipo)}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-gray-400">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {format(new Date(report.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                                    </div>
                                                </div>

                                                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                    <ChevronRight className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 border-dashed rounded-[2rem] text-center mt-8">
                                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center mb-6">
                                    <FileSearch className="w-10 h-10 text-indigo-500 opacity-60" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-gray-100 mb-2">Nenhum relatório encontrado</h3>
                                <p className="text-slate-500 dark:text-gray-400 max-w-sm mb-6 text-sm leading-relaxed">
                                    {searchTerm || typeFilter !== 'all'
                                        ? "Não encontramos nenhum relatório com os filtros e busca atuais. Tente limpar os filtros."
                                        : "A IA Clara ainda não gerou nenhum relatório de análise no sistema."}
                                </p>

                                {(searchTerm || typeFilter !== 'all') && (
                                    <button
                                        onClick={() => { setSearchTerm(''); setTypeFilter('all'); }}
                                        className="px-6 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                                    >
                                        Limpar Filtros
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDeleteConfirm}
                title="Excluir relatório"
                message={confirmDelete ? `Deseja realmente excluir o relatório "${confirmDelete.titulo || 'ID ' + confirmDelete.id}"? Esta ação não pode ser desfeita.` : ''}
                type="danger"
                confirmText="Excluir"
            />
        </div>
    );
}
