'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Handshake } from 'lucide-react';
import DataTable from '@/components/cadastros/DataTable';
import type { SortDirection } from '@/components/cadastros/DataTable';
import ModalForm from '@/components/cadastros/shared/ModalForm';
import MaskedInput from '@/components/cadastros/shared/MaskedInput';
import { useToast } from '@/contexts/ToastContext';
import { usePartners } from '@/hooks/usePartners';
import type { Partner } from '@/types/cadastros';

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400';

const inputErrorClass =
  'w-full px-3 py-2.5 text-sm border border-red-300 dark:border-red-700 rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400';

const labelClass =
  'block text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider mb-1.5 ml-1';

interface PartnerForm {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  notes: string;
}

const emptyForm = (): PartnerForm => ({
  name: '',
  email: '',
  phone: '',
  whatsapp: '',
  notes: '',
});

export default function ParceirosPage() {
  const { toast } = useToast();
  const {
    partners,
    totalCount,
    loading,
    saving,
    listPartners,
    createPartner,
    updatePartner,
    deletePartner,
  } = usePartners();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | undefined>();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partner | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm());
  const [errors, setErrors] = useState<Partial<PartnerForm>>({});

  const fetch = useCallback(() => {
    listPartners(searchTerm, page, pageSize, sort).catch(() => {
      toast.error('Erro ao buscar parceiros.');
    });
  }, [listPartners, searchTerm, page, pageSize, sort, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm(emptyForm());
    setErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((row: Partner) => {
    setEditingItem(row);
    setForm({
      name: row.name,
      email: row.email,
      phone: row.phone ?? '',
      whatsapp: row.whatsapp ?? '',
      notes: row.notes ?? '',
    });
    setErrors({});
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    if (!saving) setModalOpen(false);
  }, [saving]);

  const validate = () => {
    const errs: Partial<PartnerForm> = {};
    if (!form.name.trim()) errs.name = 'Nome é obrigatório.';
    if (!form.email.trim()) {
      errs.email = 'E-mail é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'E-mail inválido.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        notes: form.notes.trim() || null,
        status: editingItem?.status ?? 'active' as const,
      };

      if (editingItem) {
        await updatePartner(editingItem.id, payload);
        toast.success('Parceiro atualizado.');
      } else {
        await createPartner(payload);
        toast.success('Parceiro cadastrado.');
      }
      setModalOpen(false);
      fetch();
    } catch {
      toast.error('Erro ao salvar parceiro.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editingItem, createPartner, updatePartner, toast, fetch]);

  const handleToggleStatus = useCallback(async (row: Partner) => {
    try {
      await updatePartner(row.id, {
        status: row.status === 'active' ? 'inactive' : 'active',
      });
      toast.success(`Parceiro ${row.status === 'active' ? 'inativado' : 'ativado'}.`);
      fetch();
    } catch {
      toast.error('Erro ao alterar status.');
    }
  }, [updatePartner, toast, fetch]);

  const handleDelete = useCallback(async (row: Partner) => {
    if (!confirm(`Deseja excluir "${row.name}"?`)) return;
    try {
      await deletePartner(row.id);
      toast.success('Parceiro excluído.');
      fetch();
    } catch {
      toast.error('Erro ao excluir parceiro.');
    }
  }, [deletePartner, toast, fetch]);

  const setField = <K extends keyof PartnerForm>(key: K, value: PartnerForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b]">
        <div className="flex items-center gap-2">
          <Handshake className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Parceiros</h1>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          NOVO PARCEIRO
        </button>
      </div>

      {/* Table */}
      <DataTable<Partner>
        columns={[
          {
            key: 'name',
            label: 'Nome',
            sortable: true,
            render: (value, row) => (
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    row.status === 'active' ? 'bg-green-500' : 'bg-red-400'
                  }`}
                />
                <span>{String(value)}</span>
              </div>
            ),
          },
          { key: 'status', label: 'Status' },
        ]}
        data={partners}
        loading={loading}
        searchPlaceholder="Buscar parceiro..."
        onSearch={(term) => { setSearchTerm(term); setPage(0); }}
        onSort={(key, direction) => setSort({ key, direction })}
        pagination={{ page, pageSize, total: totalCount }}
        onPageChange={(p, size) => { setPage(p); setPageSize(size); }}
        actions={[
          { icon: 'edit', label: 'Editar', onClick: (row) => openEdit(row) },
        ]}
        menuActions={(row) => [
          {
            icon: row.status === 'active'
              ? <ToggleLeft className="w-4 h-4" />
              : <ToggleRight className="w-4 h-4" />,
            label: row.status === 'active' ? 'Inativar' : 'Ativar',
            onClick: () => handleToggleStatus(row),
          },
          {
            icon: <Trash2 className="w-4 h-4" />,
            label: 'Excluir',
            onClick: () => handleDelete(row),
            className: 'text-red-500 dark:text-red-400',
          },
        ]}
        emptyMessage="Nenhum parceiro cadastrado."
      />

      {/* Modal */}
      <ModalForm
        isOpen={modalOpen}
        onClose={handleClose}
        title={editingItem ? 'Editar Parceiro' : 'Novo Parceiro'}
        onSubmit={handleSubmit}
        loading={saving}
        maxWidth="max-w-xl"
      >
        {/* Nome */}
        <div>
          <label className={labelClass}>
            Nome <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">Obrigatório</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            placeholder="Nome do parceiro"
            autoFocus
            className={errors.name ? inputErrorClass : inputClass}
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
        </div>

        {/* E-mail */}
        <div>
          <label className={labelClass}>
            E-mail <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">Obrigatório</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={e => setField('email', e.target.value)}
            placeholder="email@exemplo.com"
            className={errors.email ? inputErrorClass : inputClass}
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
        </div>

        {/* Telefone + WhatsApp */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Telefone</label>
            <MaskedInput
              mask="phone"
              value={form.phone}
              onChange={(raw) => setField('phone', raw)}
              placeholder="(00) 0000-0000"
            />
          </div>
          <div>
            <label className={labelClass}>WhatsApp</label>
            <MaskedInput
              mask="mobile"
              value={form.whatsapp}
              onChange={(raw) => setField('whatsapp', raw)}
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className={labelClass}>Observações</label>
          <textarea
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
            placeholder="Observações sobre o parceiro..."
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>
      </ModalForm>
    </div>
  );
}
