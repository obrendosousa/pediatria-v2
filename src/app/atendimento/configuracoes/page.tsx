'use client';

import { useEffect, useState } from 'react';
import { useServicePoints, ServicePointInput } from '@/hooks/useServicePoints';
import type { ServicePoint, ServicePointType } from '@/types/queue';
import {
  Settings, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Monitor, Building2, Save, X,
} from 'lucide-react';

type EditingPoint = ServicePointInput & { id?: number };

const EMPTY_POINT: EditingPoint = {
  name: '', code: '', type: 'guiche', status: 'active', display_order: 0,
};

export default function AtendimentoSettingsPage() {
  const {
    servicePoints, loading, saving,
    listServicePoints, createServicePoint, updateServicePoint, deleteServicePoint,
  } = useServicePoints();

  const [filterType, setFilterType] = useState<ServicePointType | 'all'>('all');
  const [editing, setEditing] = useState<EditingPoint | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    listServicePoints(filterType === 'all' ? undefined : { type: filterType });
  }, [listServicePoints, filterType]);

  const handleSave = async () => {
    if (!editing || !editing.name.trim() || !editing.code.trim()) return;
    try {
      if (editing.id) {
        await updateServicePoint(editing.id, editing);
      } else {
        await createServicePoint(editing);
      }
      setEditing(null);
      listServicePoints(filterType === 'all' ? undefined : { type: filterType });
    } catch (err) {
      console.error('[Configuracoes] Erro ao salvar:', err);
    }
  };

  const handleToggleStatus = async (sp: ServicePoint) => {
    try {
      await updateServicePoint(sp.id, {
        status: sp.status === 'active' ? 'inactive' : 'active',
      });
      listServicePoints(filterType === 'all' ? undefined : { type: filterType });
    } catch (err) {
      console.error('[Configuracoes] Erro ao alterar status:', err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteServicePoint(id);
      setConfirmDelete(null);
      listServicePoints(filterType === 'all' ? undefined : { type: filterType });
    } catch (err) {
      console.error('[Configuracoes] Erro ao excluir:', err);
    }
  };

  const autoCode = (name: string, type: ServicePointType) => {
    const match = name.match(/\d+/);
    if (match) return (type === 'guiche' ? 'G' : 'C') + match[0];
    return '';
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-gradient-to-br from-slate-600 to-gray-500 rounded-xl shadow-lg">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">
              Configurações
            </h1>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Atendimento Geral
            </p>
          </div>
        </div>

        {/* Secao: Pontos de Atendimento */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <Monitor className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-800 dark:text-gray-100">
                Guichês e Consultórios
              </h2>
              <span className="text-xs text-slate-400 dark:text-gray-500 font-medium">
                (Pontos de Atendimento)
              </span>
            </div>
            <button
              onClick={() => setEditing({ ...EMPTY_POINT })}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" /> Novo
            </button>
          </div>

          {/* Filtro */}
          <div className="flex gap-2 mb-5">
            {(['all', 'guiche', 'consultorio'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === t
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t === 'all' ? 'Todos' : t === 'guiche' ? 'Guichês' : 'Consultórios'}
              </button>
            ))}
          </div>

          {/* Formulario de edicao/criacao */}
          {editing && (
            <div className="bg-white dark:bg-[#1a1a22] border border-slate-200 dark:border-[#252530] rounded-xl p-5 mb-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-gray-200 mb-4">
                {editing.id ? 'Editar Ponto' : 'Novo Ponto de Atendimento'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">Tipo</label>
                  <select
                    value={editing.type}
                    onChange={(e) => {
                      const type = e.target.value as ServicePointType;
                      setEditing({ ...editing, type, code: autoCode(editing.name, type) });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#252530] bg-white dark:bg-[#0e0e14] text-sm text-slate-800 dark:text-gray-200"
                  >
                    <option value="guiche">Guichê</option>
                    <option value="consultorio">Consultório</option>
                  </select>
                </div>
                {/* Nome */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">Nome</label>
                  <input
                    value={editing.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setEditing({
                        ...editing,
                        name,
                        code: editing.id ? editing.code : autoCode(name, editing.type),
                      });
                    }}
                    placeholder="Ex: Guichê 1, Consultório 2"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#252530] bg-white dark:bg-[#0e0e14] text-sm text-slate-800 dark:text-gray-200"
                  />
                </div>
                {/* Codigo */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">Código (exibido na TV)</label>
                  <input
                    value={editing.code}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                    placeholder="G1, C2"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#252530] bg-white dark:bg-[#0e0e14] text-sm text-slate-800 dark:text-gray-200 font-mono"
                  />
                </div>
                {/* Ordem */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">Ordem de exibição</label>
                  <input
                    type="number"
                    value={editing.display_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#252530] bg-white dark:bg-[#0e0e14] text-sm text-slate-800 dark:text-gray-200"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSave}
                  disabled={saving || !editing.name.trim() || !editing.code.trim()}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                >
                  <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Tabela */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : servicePoints.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#1a1a22] border border-slate-200 dark:border-[#252530] rounded-xl">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-400 dark:text-gray-500">Nenhum ponto de atendimento cadastrado</p>
              <p className="text-xs text-slate-300 dark:text-gray-600 mt-1">Clique em &quot;Novo&quot; para adicionar guichês e consultórios</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1a1a22] border border-slate-200 dark:border-[#252530] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#252530]">
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Código</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                    <th className="text-center px-5 py-3 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {servicePoints.map((sp) => (
                    <tr
                      key={sp.id}
                      className={`border-b border-slate-50 dark:border-[#252530]/50 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors ${
                        sp.status === 'inactive' ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-medium text-slate-800 dark:text-gray-200">{sp.name}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                          {sp.code}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          sp.type === 'guiche'
                            ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {sp.type === 'guiche' ? 'Guichê' : 'Consultório'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleStatus(sp)}
                          className="transition-colors"
                          title={sp.status === 'active' ? 'Desativar' : 'Ativar'}
                        >
                          {sp.status === 'active' ? (
                            <ToggleRight className="w-6 h-6 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing({
                              id: sp.id, name: sp.name, code: sp.code,
                              type: sp.type, status: sp.status, display_order: sp.display_order,
                            })}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-blue-600"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {confirmDelete === sp.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(sp.id)}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded font-bold"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(sp.id)}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
