import type { SupabaseClient, User } from '@supabase/supabase-js';

type AllowedRole = 'admin' | 'secretary';

type RequireApprovedProfileOptions = {
  allowedRoles?: AllowedRole[];
};

type ProfileRow = {
  role: AllowedRole;
  status: 'pending' | 'approved' | 'rejected';
  active: boolean;
};

export async function requireApprovedProfile(
  supabase: SupabaseClient,
  options: RequireApprovedProfileOptions = {}
): Promise<{ user: User; profile: ProfileRow }> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Usuário não autenticado.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, status, active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error('Perfil não encontrado.');
  }

  if (!profile.active || profile.status !== 'approved') {
    throw new Error('Acesso negado para perfil não aprovado.');
  }

  const allowedRoles = options.allowedRoles ?? [];
  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    throw new Error('Perfil sem permissão para esta ação.');
  }

  return {
    user,
    profile: profile as ProfileRow
  };
}
