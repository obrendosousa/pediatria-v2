'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Heart } from 'lucide-react';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/login` }
      );
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-pink-100 dark:border-[#252a3a] bg-white dark:bg-[#141722] p-8 shadow-xl text-center">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center">
            <Heart className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-[#e8ecf4] mb-2">
          E-mail enviado
        </h1>
        <p className="text-sm text-slate-500 dark:text-[#828ca5] mb-6">
          Verifique sua caixa de entrada (e o spam) e use o link para redefinir sua senha.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-white font-semibold py-3 px-6 hover:opacity-90 transition"
        >
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-pink-100 dark:border-[#252a3a] bg-white dark:bg-[#141722] p-8 shadow-xl">
      <div className="flex justify-center mb-6">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center">
          <Heart className="w-7 h-7 text-white" />
        </div>
      </div>
      <h1 className="text-xl font-bold text-center text-slate-800 dark:text-[#e8ecf4] mb-2">
        Recuperar senha
      </h1>
      <p className="text-sm text-slate-500 dark:text-[#828ca5] text-center mb-6">
        Informe seu e-mail para receber o link de redefinição.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-[#a0a8be] mb-1">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-pink-200 dark:border-gray-600 bg-white dark:bg-[#0d0f15] px-4 py-2.5 text-slate-800 dark:text-[#e8ecf4] focus:ring-2 focus:ring-pink-400 focus:border-transparent outline-none transition"
            placeholder="seu@email.com"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-white font-semibold py-3 hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Enviar link'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-[#828ca5]">
        <Link href="/login" className="text-pink-600 dark:text-pink-400 font-medium hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
