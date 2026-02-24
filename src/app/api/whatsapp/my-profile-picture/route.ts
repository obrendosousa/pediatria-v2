import { NextResponse } from 'next/server';
import { fetchProfilePictureFromEvolution } from '@/ai/ingestion/services';

/**
 * GET /api/whatsapp/my-profile-picture
 * Retorna a URL da foto de perfil da conta vinculada ao Evolution (o número que você usa para responder).
 * Requer a variável de ambiente EVOLUTION_MY_PHONE com o número no formato com DDI (ex: 5511999999999).
 */
export async function GET() {
  try {
    const phone = process.env.EVOLUTION_MY_PHONE?.trim().replace(/\D/g, '');
    if (!phone || phone.length < 10) {
      return NextResponse.json({ profile_pic: null });
    }

    const url = await fetchProfilePictureFromEvolution(phone);
    return NextResponse.json({ profile_pic: url || null });
  } catch {
    return NextResponse.json({ profile_pic: null });
  }
}
