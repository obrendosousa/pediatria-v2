import { NextResponse } from 'next/server';
import { fetchProfilePictureFromEvolution } from '@/ai/ingestion/services';

/**
 * GET /api/atendimento/whatsapp/my-profile-picture
 * Retorna a foto de perfil da conta WhatsApp do módulo Clínica Geral.
 * Usa EVOLUTION_ATENDIMENTO_MY_PHONE (ou fallback EVOLUTION_MY_PHONE).
 */
export async function GET() {
  try {
    const phone = (process.env.EVOLUTION_ATENDIMENTO_MY_PHONE || process.env.EVOLUTION_MY_PHONE)
      ?.trim().replace(/\D/g, '');
    if (!phone || phone.length < 10) {
      return NextResponse.json({ profile_pic: null });
    }
    const url = await fetchProfilePictureFromEvolution(phone, 'EVOLUTION_ATENDIMENTO_INSTANCE');
    return NextResponse.json({ profile_pic: url || null });
  } catch {
    return NextResponse.json({ profile_pic: null });
  }
}
