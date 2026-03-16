'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useProfessionals } from '@/hooks/useProfessionals';
import { createClient } from '@/lib/supabase/client';
import ProfessionalForm from '@/components/cadastros/profissionais/ProfessionalForm';
import type { ProfessionalFormData } from '@/components/cadastros/profissionais/ProfessionalForm';
import { Copy, Check, X, Key, User, Mail } from 'lucide-react';

async function uploadAttachments(files: File[]): Promise<{ name: string; url: string }[]> {
  if (files.length === 0) return [];
  const supabase = createClient();
  const results: { name: string; url: string }[] = [];

  for (const file of files) {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await supabase.storage.from('professional-attachments').upload(path, file);
    if (error) {
      console.error('Erro ao enviar anexo:', error);
      continue;
    }
    const { data: urlData } = supabase.storage.from('professional-attachments').getPublicUrl(path);
    results.push({ name: file.name, url: urlData.publicUrl });
  }
  return results;
}

interface Credentials {
  email: string;
  password: string;
  name: string;
}

function CredentialsModal({ credentials, onClose }: { credentials: Credentials; onClose: () => void }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAll = async () => {
    const text = `Acesso ao Sistema\nNome: ${credentials.name}\nE-mail: ${credentials.email}\nSenha temporária: ${credentials.password}\n\nAcesse: ${window.location.origin}/login`;
    await navigator.clipboard.writeText(text);
    setCopiedField('all');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0d0f15] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-500 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-bold">Login Criado!</h3>
                <p className="text-sm text-white/80">Credenciais de acesso ao sistema</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
              Anote ou copie estas credenciais. A senha temporária não poderá ser visualizada novamente.
            </p>
          </div>

          {/* Name */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#15171e] rounded-lg">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Nome</p>
              <p className="text-sm font-medium text-slate-700 dark:text-gray-200 truncate">{credentials.name}</p>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#15171e] rounded-lg">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase font-bold">E-mail (login)</p>
              <p className="text-sm font-mono font-medium text-slate-700 dark:text-gray-200 truncate">{credentials.email}</p>
            </div>
            <button
              onClick={() => copyToClipboard(credentials.email, 'email')}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#1e2334] transition-colors shrink-0"
            >
              {copiedField === 'email' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
            </button>
          </div>

          {/* Password */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#15171e] rounded-lg">
            <Key className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Senha temporária</p>
              <p className="text-sm font-mono font-bold text-teal-600 dark:text-teal-400">{credentials.password}</p>
            </div>
            <button
              onClick={() => copyToClipboard(credentials.password, 'password')}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#1e2334] transition-colors shrink-0"
            >
              {copiedField === 'password' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={copyAll}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold transition-colors"
          >
            {copiedField === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedField === 'all' ? 'Copiado!' : 'Copiar tudo'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-[#a0a8be] hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CriarProfissionalPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createProfessional } = useProfessionals();
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const handleSubmit = async (form: ProfessionalFormData) => {
    const attachments = await uploadAttachments(form.attachments);

    // 1. Create the professional record
    const professional = await createProfessional({
      name: form.name,
      sex: form.sex || null,
      birth_date: form.birth_date || null,
      marital_status: form.marital_status || null,
      cpf: form.cpf,
      rg: form.rg || null,
      street: form.address.street || null,
      zip_code: form.address.zip_code || null,
      state: form.address.state || null,
      city: form.address.city || null,
      neighborhood: form.address.neighborhood || null,
      number: form.address.number || null,
      complement: form.address.complement || null,
      email: form.email,
      phone: form.phone || null,
      mobile: form.mobile || null,
      whatsapp: form.whatsapp || null,
      professional_type: form.professional_type,
      specialty: form.specialty || null,
      registration_state: form.registration_state,
      registration_type: form.registration_type,
      registration_number: form.registration_number,
      schedule_access: form.schedule_access as 'view_appointment' | 'open_record',
      is_admin: form.is_admin,
      restrict_prices: form.restrict_prices,
      has_schedule: form.has_schedule,
      restrict_schedule: form.restrict_schedule,
      attachments,
      notes: form.notes || null,
      status: 'active',
    });

    // 2. If "create login" is enabled, create auth user + doctor + profile
    if (form.create_login) {
      try {
        const res = await fetch('/api/auth/create-professional-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            full_name: form.name,
            specialty: form.specialty || null,
            professional_id: professional.id,
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          toast.error(result.error || 'Erro ao criar login');
          toast.success('Profissional cadastrado, mas login não foi criado.');
          router.push('/atendimento/cadastros/profissionais');
          return;
        }

        // Show credentials modal
        toast.success('Profissional cadastrado e login criado!');
        setCredentials({
          email: form.email,
          password: result.password,
          name: form.name,
        });
        return; // Don't redirect yet - wait for modal close
      } catch (err) {
        console.error('Erro ao criar login:', err);
        toast.error('Profissional cadastrado, mas erro ao criar login.');
        router.push('/atendimento/cadastros/profissionais');
        return;
      }
    }

    toast.success('Profissional cadastrado com sucesso!');
    router.push('/atendimento/cadastros/profissionais');
  };

  return (
    <>
      <ProfessionalForm
        title="Novo Profissional"
        subtitle="Preencha os dados do profissional"
        onSubmit={handleSubmit}
        showCreateLogin
      />

      {credentials && (
        <CredentialsModal
          credentials={credentials}
          onClose={() => {
            setCredentials(null);
            router.push('/atendimento/cadastros/profissionais');
          }}
        />
      )}
    </>
  );
}
