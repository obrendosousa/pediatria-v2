import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/auth/create-professional-user
 *
 * Creates a Supabase Auth user for a professional, a doctor record,
 * and links everything together (profile ↔ doctor ↔ professional).
 *
 * Body: { email, full_name, specialty?, professional_id, password? }
 * Returns: { user_id, doctor_id, password }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, full_name, specialty, professional_id } = body;

    if (!email || !full_name || !professional_id) {
      return NextResponse.json(
        { error: 'email, full_name e professional_id são obrigatórios' },
        { status: 400 }
      );
    }

    // Generate a temporary password if not provided
    const password = body.password || generatePassword();

    // Admin client (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Check if auth user already exists with this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      return NextResponse.json(
        { error: `Já existe um usuário com o e-mail ${email}` },
        { status: 409 }
      );
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { full_name },
    });

    if (authError || !authData.user) {
      console.error('Erro ao criar auth user:', authError);
      return NextResponse.json(
        { error: authError?.message || 'Erro ao criar usuário' },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // 3. Create doctor record in public.doctors
    const { data: doctorData, error: doctorError } = await supabase
      .from('doctors')
      .insert({
        name: full_name,
        specialty: specialty || null,
        color: 'blue',
        active: true,
        professional_id,
      })
      .select('id')
      .single();

    if (doctorError) {
      console.error('Erro ao criar doctor:', doctorError);
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'Erro ao criar registro de médico: ' + doctorError.message },
        { status: 500 }
      );
    }

    const doctorId = doctorData.id;

    // 4. Update profile (created by trigger) with doctor_id and approved status
    // Small delay to ensure trigger has completed
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        doctor_id: doctorId,
        status: 'approved',
        approved_at: new Date().toISOString(),
        full_name,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Erro ao atualizar profile:', profileError);
    }

    // 5. Add user_modules entry (doctor access to atendimento only)
    const { error: moduleError } = await supabase
      .from('user_modules')
      .insert({
        profile_id: userId,
        module: 'atendimento',
        role: 'doctor',
      });

    if (moduleError) {
      console.error('Erro ao criar módulo:', moduleError);
    }

    return NextResponse.json({
      user_id: userId,
      doctor_id: doctorId,
      email,
      password,
    });
  } catch (err) {
    console.error('Erro inesperado:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const special = '!@#$%';
  let pwd = '';
  for (let i = 0; i < 10; i++) {
    pwd += chars[randomInt(chars.length)];
  }
  pwd += special[randomInt(special.length)];
  return pwd;
}
