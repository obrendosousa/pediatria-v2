import { NextRequest, NextResponse } from 'next/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createSchemaAdminClient();

    const { data, error } = await supabase
      .from('products')
      .insert({ ...body, stock: 0 })
      .select()
      .single();

    if (error) {
      console.error('[store/products] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[store/products] Unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do produto é obrigatório' }, { status: 400 });
    }

    const supabase = createSchemaAdminClient();

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', Number(id));

    if (error) {
      console.error('[store/products] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[store/products] Unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...payload } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do produto é obrigatório' }, { status: 400 });
    }

    const supabase = createSchemaAdminClient();

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[store/products] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[store/products] Unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
