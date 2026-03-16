'use client';

import { useEffect, useState, useCallback } from 'react';
import { AttendanceScreenProps } from '@/types/attendance';
import { useCertificates, type MedicalCertificate } from '@/hooks/atendimento/useCertificates';
import { useToast } from '@/contexts/ToastContext';
import { ClinicalDocumentEditor, type DocumentTemplate } from './ClinicalDocumentEditor';
import { replaceTemplateVariables } from '@/utils/templateVariables';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  Plus, Eye, Pencil, Trash2, Printer, ArrowLeft,
  Award, Loader2
} from 'lucide-react';

type ViewMode = 'list' | 'create' | 'edit' | 'view';

// ── Componente Principal ────────────────────────────────────
export function CertificatesList({ patientId, patientData, appointmentId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const {
    certificates, templates, doctors, loading,
    fetchCertificates, fetchDoctors, fetchTemplates,
    create, update, remove,
  } = useCertificates(patientId);

  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Campos do formulário
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [digitalSignature, setDigitalSignature] = useState(false);
  const [showDate, setShowDate] = useState(true);
  const [certificateDate, setCertificateDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [templateId, setTemplateId] = useState<number | null>(null);

  useEffect(() => {
    fetchCertificates();
    fetchDoctors();
    fetchTemplates();
  }, [fetchCertificates, fetchDoctors, fetchTemplates]);

  const selected = certificates.find(c => c.id === selectedId) || null;

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setDigitalSignature(false);
    setShowDate(true);
    setCertificateDate(new Date().toLocaleDateString('en-CA'));
    setTemplateId(null);
  }, []);

  const handleCreate = () => {
    resetForm();
    setSelectedId(null);
    setMode('create');
  };

  const handleEdit = (cert: MedicalCertificate) => {
    setSelectedId(cert.id);
    setTitle(cert.title || '');
    setContent(cert.content || '');
    setDigitalSignature(cert.digital_signature);
    setShowDate(cert.show_date ?? true);
    setCertificateDate(cert.certificate_date || new Date().toLocaleDateString('en-CA'));
    setTemplateId(cert.template_id);
    setMode('edit');
  };

  const handleView = (cert: MedicalCertificate) => {
    setSelectedId(cert.id);
    setMode('view');
  };

  const handleBack = () => {
    setMode('list');
    setSelectedId(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('O conteúdo do atestado é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title || null,
        content,
        signed: digitalSignature,
        digital_signature: digitalSignature,
        show_date: showDate,
        certificate_date: showDate ? certificateDate : null,
        template_id: templateId,
        appointment_id: appointmentId || null,
      };
      if (mode === 'create') {
        await create(payload);
        toast.success('Atestado criado com sucesso!');
      } else if (mode === 'edit' && selectedId) {
        await update(selectedId, payload);
        toast.success('Atestado atualizado!');
      }
      await fetchCertificates();
      handleBack();
    } catch (err: unknown) {
      toast.error('Erro: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await remove(id);
      toast.success('Atestado excluído.');
      await fetchCertificates();
    } catch (err: unknown) {
      toast.error('Erro ao excluir: ' + (err instanceof Error ? err.message : ''));
    }
    setConfirmDeleteId(null);
  };

  const handlePrint = (cert: MedicalCertificate) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const doctorName = cert.doctor_id ? (doctors[cert.doctor_id] || '—') : '';
    win.document.write(`
      <html>
      <head>
        <title>${cert.title || 'Atestado Médico'}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#333}h1{font-size:20px;margin-bottom:8px}
        .meta{color:#666;font-size:13px;margin-bottom:16px}hr{border:none;border-top:1px solid #ddd;margin:16px 0}</style>
      </head>
      <body>
        <h1>${cert.title || 'Atestado Médico'}</h1>
        <div class="meta">
          ${cert.show_date !== false && cert.certificate_date ? `<div>Data: ${new Date(cert.certificate_date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>` : ''}
          ${doctorName ? `<div>Profissional: ${doctorName}</div>` : ''}
        </div>
        <hr/>
        <div>${cert.content || ''}</div>
        ${cert.digital_signature ? '<p style="margin-top:40px;font-weight:bold">✓ Assinado digitalmente</p>' : ''}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleSelectTemplate = (tmpl: DocumentTemplate) => {
    setContent(replaceTemplateVariables(tmpl.content || '', patientData));
    setTemplateId(tmpl.id);
  };

  // ── Renderização ──────────────────────────────────────────

  if (loading && certificates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Modo Visualização ─────────────────────────────────────
  if (mode === 'view' && selected) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#e8ecf4]">{selected.title || 'Atestado'}</h2>
          <div className="ml-auto flex gap-2">
            <button onClick={() => handleEdit(selected)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button onClick={() => handlePrint(selected)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#a0a8be] rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0d0f15] rounded-xl border border-slate-200 dark:border-[#252a3a] p-6 space-y-3">
          <div className="flex gap-6 text-sm text-slate-500 dark:text-[#828ca5]">
            {selected.show_date && selected.certificate_date && (
              <span>Data: <strong className="text-slate-700 dark:text-gray-200">{new Date(selected.certificate_date + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
            )}
            {selected.doctor_id && doctors[selected.doctor_id] && (
              <span>Profissional: <strong className="text-slate-700 dark:text-gray-200">{doctors[selected.doctor_id]}</strong></span>
            )}
            {selected.digital_signature && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ Assinado</span>
            )}
          </div>
          <hr className="border-slate-100 dark:border-[#252a3a]" />
          <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: selected.content || '<p class="text-slate-400">Sem conteúdo</p>' }} />
        </div>
      </div>
    );
  }

  // ── Modo Criação / Edição (usando ClinicalDocumentEditor) ──
  if (mode === 'create' || mode === 'edit') {
    return (
      <ClinicalDocumentEditor
        mode={mode}
        createLabel="Novo Atestado"
        editLabel="Editar Atestado"
        onBack={handleBack}
        showTitle
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Ex: Atestado médico"
        digitalSignature={digitalSignature}
        onDigitalSignatureChange={setDigitalSignature}
        showDate={showDate}
        onShowDateChange={setShowDate}
        date={certificateDate}
        onDateChange={setCertificateDate}
        dateLabel="Data do atestado"
        content={content}
        onContentChange={setContent}
        contentPlaceholder="Digite o conteúdo do atestado..."
        templates={templates}
        onSelectTemplate={handleSelectTemplate}
        templatePanelTitle="Modelos de atestado"
        saving={saving}
        onSave={handleSave}
        saveIcon={Award}
      />
    );
  }

  // ── Modo Listagem ─────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-[#e8ecf4]">Atestados</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> ADICIONAR ATESTADO
        </button>
      </div>

      {certificates.length === 0 ? (
        <div className="text-center py-16">
          <Award className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-[#565d73]">Nenhum atestado registrado.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0d0f15] rounded-xl border border-slate-200 dark:border-[#252a3a] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#141722] border-b border-slate-200 dark:border-[#252a3a]">
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#828ca5] uppercase">Data criação</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#828ca5] uppercase">Data</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#828ca5] uppercase">Nome</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#828ca5] uppercase">Profissional</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#828ca5] uppercase text-right">Opções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {certificates.map(cert => (
                <tr key={cert.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-slate-600 dark:text-[#a0a8be]">
                    {new Date(cert.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-[#a0a8be]">
                    {cert.certificate_date ? new Date(cert.certificate_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-gray-200">
                    {cert.title || 'Sem título'}
                    {cert.digital_signature && (
                      <span className="ml-2 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">ASSINADO</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-[#a0a8be]">
                    {cert.doctor_id ? (doctors[cert.doctor_id] || '—') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleView(cert)} title="Visualizar" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(cert)} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(cert.id)} title="Excluir" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handlePrint(cert)} title="Imprimir" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); }}
        title="Excluir atestado"
        message="Tem certeza que deseja excluir este atestado? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
