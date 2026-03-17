'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff } from 'lucide-react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        setError(
          signInError.message === 'Invalid login credentials'
            ? 'E-mail ou senha incorretos.'
            : signInError.message
        );
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full animate-float-up">
      <h1 className="text-3xl font-bold text-white">
        Ola !
      </h1>
      <h2 className="text-3xl font-bold text-white mt-1 mb-3">
        Bem-vindo de volta
      </h2>
      <p className="text-zinc-500 mb-8">
        Acesse o painel do Centro Médico Aliança
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 rounded-xl p-3 border border-red-900/30">
            {error}
          </div>
        )}

        <div>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3.5 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 outline-none transition"
            placeholder="Digite seu e-mail"
          />
        </div>

        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3.5 pr-12 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 outline-none transition"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="flex justify-end">
          <Link
            href="/recuperar-senha"
            className="text-sm text-sky-400 hover:underline font-medium"
          >
            Esqueceu a senha?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-white text-black font-semibold py-3.5 hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Entrando...
            </span>
          ) : (
            'Entrar'
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Nao tem uma conta?{' '}
        <Link
          href="/signup"
          className="text-sky-400 font-semibold hover:underline"
        >
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-zinc-800 rounded-xl w-1/2" />
          <div className="h-10 bg-zinc-800 rounded-xl w-2/3" />
          <div className="h-4 bg-zinc-800 rounded w-3/4 mt-6" />
          <div className="h-12 bg-zinc-800 rounded-xl mt-8" />
          <div className="h-12 bg-zinc-800 rounded-xl" />
          <div className="h-12 bg-zinc-800 rounded-xl mt-4" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
