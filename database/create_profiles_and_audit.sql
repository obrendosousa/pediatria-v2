-- ============================================================
-- Perfis de usuários do sistema (vinculados ao Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'secretary' CHECK (role IN ('admin', 'secretary')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  doctor_id BIGINT NULL REFERENCES public.doctors(id),
  active BOOLEAN DEFAULT true,
  approved_at TIMESTAMPTZ NULL,
  approved_by UUID NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

COMMENT ON TABLE public.profiles IS 'Perfis de usuários do painel (auth.users). Primeiro usuário = admin + approved; demais = secretary + pending.';

-- ============================================================
-- Auditoria: quem fez o quê
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NULL,
  details JSONB NULL,
  ip_address TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

COMMENT ON TABLE public.audit_log IS 'Log de ações no sistema para rastreabilidade.';

-- ============================================================
-- Trigger: ao criar usuário no Auth, criar profile
-- Primeiro usuário = admin + approved; demais = secretary + pending
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  SELECT (SELECT COUNT(*) FROM public.profiles) = 0 INTO is_first;

  INSERT INTO public.profiles (id, email, full_name, role, status, active, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    CASE WHEN is_first THEN 'admin' ELSE 'secretary' END,
    CASE WHEN is_first THEN 'approved' ELSE 'pending' END,
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir (por nome)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger em auth.users (executado pelo Supabase após signup)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS para profiles (usuário pode ler seu próprio profile)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.status = 'approved' AND p.active = true
    )
  );

CREATE POLICY "Admins can update profiles (approve/reject)"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.status = 'approved' AND p.active = true
    )
  )
  WITH CHECK (true);

-- Usuário pode atualizar apenas seu próprio profile (campos limitados, ex: full_name) se quiser; por simplicidade deixamos só admin atualizar.
-- Se precisar de self-update: adicionar política UPDATE com USING (auth.uid() = id) e WITH CHECK restritivo.

-- ============================================================
-- RLS para audit_log (apenas usuários aprovados podem inserir; admins podem ler tudo)
-- ============================================================
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can insert audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.status = 'approved' AND p.active = true
    )
  );

CREATE POLICY "Admins can read all audit log"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.status = 'approved' AND p.active = true
    )
  );

CREATE POLICY "Users can read own audit entries"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id);
