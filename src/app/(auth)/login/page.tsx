'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Heart } from 'lucide-react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : signInError.message);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-pink-100 dark:border-gray-700 bg-white dark:bg-[#262832] p-8 shadow-xl">
      <div className="flex justify-center mb-6">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center">
          <Heart className="w-7 h-7 text-white" />
        </div>
      </div>
      <h1 className="text-xl font-bold text-center text-slate-800 dark:text-gray-100 mb-2">
        Entrar no painel
      </h1>
      <p className="text-sm text-slate-500 dark:text-gray-400 text-center mb-6">
        Centro Médico Aliança – Pediatria Integrada
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-pink-200 dark:border-gray-600 bg-white dark:bg-[#1e2028] px-4 py-2.5 text-slate-800 dark:text-gray-100 focus:ring-2 focus:ring-pink-400 focus:border-transparent outline-none transition"
            placeholder="seu@email.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-pink-200 dark:border-gray-600 bg-white dark:bg-[#1e2028] px-4 py-2.5 text-slate-800 dark:text-gray-100 focus:ring-2 focus:ring-pink-400 focus:border-transparent outline-none transition"
            placeholder="••••••••"
          />
        </div>
        <div className="flex justify-end">
          <Link
            href="/recuperar-senha"
            className="text-sm text-pink-600 dark:text-pink-400 hover:underline"
          >
            Esqueci a senha
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-white font-semibold py-3 hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-gray-400">
        Ainda não tem conta?{' '}
        <Link href="/signup" className="text-pink-600 dark:text-pink-400 font-medium hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-pink-100 dark:border-gray-700 bg-white dark:bg-[#262832] p-8 shadow-xl animate-pulse h-80" />}>
      <LoginForm />
    </Suspense>
  );
}
