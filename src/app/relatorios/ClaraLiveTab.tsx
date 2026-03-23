'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Brain, CheckCircle2, XCircle, Clock, RefreshCw, Zap, Database, BookOpen, CalendarClock, ChevronRight, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CronStatus {
  name: string;
  label: string;
  description: string;
  intervalLabel: string;
  running: boolean;
  runCount: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  status: 'idle' | 'running' | 'ok' | 'error' | 'never';
}

interface MemoryStats {
  total: number;
  withEmbedding: number;
  avgScore: number;
  byType: Record<string, number>;
  lastUpdated?: string;
  builtAt?: string;
}

interface Decision {
  file: string;
  summary: string;
  decided_by: string;
  date: string;
  category: string;
}

interface Report {
  id: number;
  titulo: string;
  tipo: string;
  created_at: string;
}

interface ScheduledTask {
  id: number;
  task_type: string;
  title: string;
  status: string;
  priority: string;
  run_at: string;
  executed_at?: string;
  created_at: string;
}

interface ActivityData {
  crons: CronStatus[];
  memory: MemoryStats | null;
  decisions: Decision[];
  recentReports: Report[];
  scheduledTasks: ScheduledTask[];
  serverTime: string;
}

function StatusDot({ status }: { status: CronStatus['status'] }) {
  if (status === 'running') return <span className="flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" /></span>;
  if (status === 'ok') return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />;
  if (status === 'error') return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />;
  if (status === 'never') return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-slate-300 dark:bg-slate-600" />;
  return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-yellow-400" />;
}

function timeAgo(iso?: string) {
  if (!iso) return '—';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR }); } catch { return '—'; }
}

function CronCard({ cron }: { cron: CronStatus }) {
  const borderColor = cron.status === 'error' ? 'border-red-200 dark:border-red-900/40' :
    cron.status === 'running' ? 'border-blue-200 dark:border-blue-800/40' :
    cron.status === 'ok' ? 'border-emerald-200/50 dark:border-emerald-900/20' :
    'border-slate-200 dark:border-[#2d2d36]';

  return (
    <div className={`bg-white dark:bg-[#08080b] border ${borderColor} rounded-2xl p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center shrink-0">
            <StatusDot status={cron.status} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-[#fafafa] truncate">{cron.label}</p>
            <p className="text-xs text-slate-400 dark:text-[#71717a] truncate">{cron.description}</p>
          </div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#252833] text-slate-500 dark:text-[#a1a1aa] shrink-0 whitespace-nowrap">
          {cron.intervalLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 dark:bg-[#0f0f12] rounded-lg p-2">
          <p className="text-slate-400 dark:text-[#71717a] mb-0.5">Execuções</p>
          <p className="font-bold text-slate-700 dark:text-[#d4d4d8]">{cron.runCount}</p>
        </div>
        <div className="bg-slate-50 dark:bg-[#0f0f12] rounded-lg p-2">
          <p className="text-slate-400 dark:text-[#71717a] mb-0.5">Último run</p>
          <p className="font-bold text-slate-700 dark:text-[#d4d4d8] truncate" title={cron.lastSuccessAt}>
            {timeAgo(cron.lastSuccessAt ?? cron.lastRunAt)}
          </p>
        </div>
      </div>

      {cron.status === 'error' && cron.lastError && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-2 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400 line-clamp-2">{cron.lastError}</p>
        </div>
      )}
    </div>
  );
}

export default function ClaraLiveTab() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/clara/activity');
      if (res.ok) {
        setData(await res.json());
        setLastRefresh(new Date());
      }
    } catch { /* silencioso */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000); // refresh a cada 15s
    return () => clearInterval(interval);
  }, [fetchData]);

  const cronsRunning = data?.crons.filter(c => c.status === 'running').length ?? 0;
  const cronsError = data?.crons.filter(c => c.status === 'error').length ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-500 dark:text-[#a1a1aa]">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          <span className="text-sm">Carregando atividade...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-[#d4d4d8]">
            Clara em execução
            {cronsRunning > 0 && <span className="ml-2 text-blue-500">· {cronsRunning} ativo{cronsRunning > 1 ? 's' : ''}</span>}
            {cronsError > 0 && <span className="ml-2 text-red-500">· {cronsError} erro{cronsError > 1 ? 's' : ''}</span>}
          </span>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-500 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          {lastRefresh ? `atualizado ${timeAgo(lastRefresh.toISOString())}` : 'atualizar'}
        </button>
      </div>

      {/* Memory Stats */}
      {data?.memory && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide">Memória do Vault</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total de Memórias', value: data.memory.total.toLocaleString(), icon: <Database className="w-4 h-4 text-purple-500" />, color: 'purple' },
              { label: 'Com Embedding', value: data.memory.withEmbedding.toLocaleString(), icon: <Zap className="w-4 h-4 text-blue-500" />, color: 'blue' },
              { label: 'Score Médio', value: `${data.memory.avgScore}/100`, icon: <Activity className="w-4 h-4 text-emerald-500" />, color: 'emerald' },
              { label: 'Última Atualização', value: timeAgo(data.memory.lastUpdated), icon: <Clock className="w-4 h-4 text-amber-500" />, color: 'amber' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#2d2d36] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-slate-400 dark:text-[#71717a]">{label}</span></div>
                <p className="text-xl font-black text-slate-800 dark:text-[#fafafa]">{value}</p>
              </div>
            ))}
          </div>
          {/* Por tipo */}
          <div className="mt-3 bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#2d2d36] rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-400 dark:text-[#71717a] uppercase tracking-wide mb-3">Distribuição por categoria</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.memory.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <span key={type} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#252833] text-slate-600 dark:text-[#a1a1aa] font-medium">
                  {type.replace(/_/g, ' ')} · {count}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Crons */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide">Processos Automáticos</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {(data?.crons ?? []).map(cron => <CronCard key={cron.name} cron={cron} />)}
        </div>
      </section>

      {/* Tarefas Agendadas pela Clara */}
      {(data?.scheduledTasks?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide">Tarefas Agendadas pela Clara</h3>
          </div>
          <div className="bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#2d2d36] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#2d2d36]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 dark:text-[#71717a] uppercase">Tarefa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 dark:text-[#71717a] uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 dark:text-[#71717a] uppercase">Execução</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 dark:text-[#71717a] uppercase">Prioridade</th>
                </tr>
              </thead>
              <tbody>
                {data!.scheduledTasks.map(task => (
                  <tr key={task.id} className="border-b border-slate-50 dark:border-[#1a1a1f] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700 dark:text-[#d4d4d8] line-clamp-1">{task.title}</p>
                      <p className="text-xs text-slate-400 dark:text-[#71717a]">{task.task_type}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        task.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                        task.status === 'running' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                        task.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      }`}>{task.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-[#a1a1aa]">{timeAgo(task.run_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                        task.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>{task.priority}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Decisões Recentes */}
      {(data?.decisions?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide">Decisões Registradas</h3>
          </div>
          <div className="space-y-2">
            {data!.decisions.map((d, i) => (
              <div key={i} className="bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#2d2d36] rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  d.decided_by === 'admin' ? 'bg-purple-100 dark:bg-purple-900/20' : 'bg-indigo-100 dark:bg-indigo-900/20'
                }`}>
                  {d.decided_by === 'admin'
                    ? <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    : <Brain className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-[#d4d4d8] line-clamp-1">{d.summary}</p>
                  <p className="text-xs text-slate-400 dark:text-[#71717a]">
                    por <span className="font-semibold">{d.decided_by}</span>
                    {d.date ? ` · ${d.date}` : ''}
                    {d.category ? ` · ${d.category}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Relatórios Recentes */}
      {(data?.recentReports?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="w-4 h-4 text-transparent" />
            <Activity className="w-4 h-4 text-slate-500 -ml-6" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide">Últimos Relatórios Gerados</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data!.recentReports.map(r => (
              <a key={r.id} href={`/relatorios/${r.id}`} className="bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#2d2d36] rounded-xl p-4 flex items-center gap-3 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all group">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-[#d4d4d8] line-clamp-1">{r.titulo || `Relatório #${r.id}`}</p>
                  <p className="text-xs text-slate-400 dark:text-[#71717a]">{timeAgo(r.created_at)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-[#3d3d48] group-hover:text-indigo-500 transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
