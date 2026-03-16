'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

// Definição do Tipo Profile mantida
export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'secretary';
  status: 'pending' | 'approved' | 'rejected';
  doctor_id: number | null;
  active: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

// Módulos que o usuário tem acesso (RBAC multi-módulo)
export type UserModule = {
  module: 'pediatria' | 'atendimento' | 'financeiro' | 'comercial' | 'ceo';
  role: 'admin' | 'manager' | 'operator' | 'viewer' | 'doctor';
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  modules: UserModule[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [modules, setModules] = useState<UserModule[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Cliente Supabase inicializado apenas uma vez
  const [supabase] = useState(() => createClient());
  const requestIdRef = useRef(0);
  const isInitializingRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        return null;
      }
      return data as Profile;
    } catch (error) {
      console.error('Exceção ao buscar perfil:', error);
      return null;
    }
  }, [supabase]);

  const fetchModules = useCallback(async (userId: string): Promise<UserModule[]> => {
    try {
      const { data, error } = await supabase
        .from('user_modules')
        .select('module, role')
        .eq('profile_id', userId);

      if (error) {
        console.error('Erro ao buscar módulos:', error);
        return [];
      }
      return (data ?? []) as UserModule[];
    } catch (error) {
      console.error('Exceção ao buscar módulos:', error);
      return [];
    }
  }, [supabase]);

  const applySessionState = useCallback(async (nextUser: User | null) => {
    const requestId = ++requestIdRef.current;

    if (!nextUser) {
      currentUserIdRef.current = null;
      setUser(null);
      setProfile(null);
      setModules([]);
      return;
    }

    const [nextProfile, nextModules] = await Promise.all([
      fetchProfile(nextUser.id),
      fetchModules(nextUser.id),
    ]);
    if (requestIdRef.current !== requestId) return;
    currentUserIdRef.current = nextUser.id;
    setUser(nextUser);
    setProfile(nextProfile);
    setModules(nextModules);
  }, [fetchProfile, fetchModules]);

  const signOut = useCallback(async () => {
    currentUserIdRef.current = null;
    setUser(null);
    setProfile(null);
    setModules([]);
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }, [router, supabase]);

  const refreshProfile = useCallback(async () => {
    const userId = currentUserIdRef.current;
    if (userId) {
      const p = await fetchProfile(userId);
      if (currentUserIdRef.current === userId) setProfile(p);
    }
  }, [fetchProfile]);

  useEffect(() => {
    let isActive = true;

    async function initializeAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isActive) return;
        await applySessionState(session?.user ?? null);
      } catch (error) {
        console.error('Erro na inicialização da auth:', error);
      } finally {
        if (!isActive) return;
        isInitializingRef.current = false;
        setLoading(false);
      }
    }

    async function handleAuthEvent(event: AuthChangeEvent, session: Session | null) {
      if (event === 'SIGNED_OUT') {
        await applySessionState(null);
        if (isActive && !isInitializingRef.current) {
          setLoading(false);
        }
        router.refresh();
        return;
      }

      if (session?.user) {
        await applySessionState(session.user);
        if (isActive && !isInitializingRef.current) {
          setLoading(false);
        }
        return;
      }

      await applySessionState(null);
      if (isActive && !isInitializingRef.current) {
        setLoading(false);
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) return;
      void handleAuthEvent(event, session);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase, applySessionState, router]);

  return (
    <AuthContext.Provider
      value={{ user, profile, modules, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}