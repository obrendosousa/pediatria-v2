import { NextRequest, NextResponse } from 'next/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';
import { requireAuth } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    const { user } = auth;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo não permitido' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx 5MB)' }, { status: 400 });
    }

    const supabase = createSchemaAdminClient();
    const BUCKET = 'profile-photos';

    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true });
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `profiles/${user.id}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[upload/profile-photo] Upload error:', uploadError);
      return NextResponse.json({ error: 'Erro ao fazer upload da foto' }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    // Adiciona timestamp para cache-bust
    const photoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    // Atualiza a URL da foto no perfil
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ photo_url: photoUrl })
      .eq('id', user.id);

    if (updateError) {
      console.error('[upload/profile-photo] Update profile error:', updateError);
    }

    return NextResponse.json({ url: photoUrl });
  } catch (err) {
    console.error('[upload/profile-photo] Unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
