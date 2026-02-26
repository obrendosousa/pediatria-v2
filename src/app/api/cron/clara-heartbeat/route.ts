import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { claraGraph } from '@/ai/clara/graph';
import { HumanMessage } from "@langchain/core/messages";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function GET(req: Request) {
  try {
    // Busca o ID do chat oficial da Clara no painel (telefone fictício '00000000000')
    const { data: claraChat } = await supabase
      .from('chats')
      .select('id')
      .eq('phone', '00000000000')
      .single();

    if (!claraChat) {
      return NextResponse.json({ error: "Chat da Clara não encontrado" }, { status: 404 });
    }

    const chatId = claraChat.id;

    const studyCommand = `[COMANDO INTERNO DE SISTEMA - HEARTBEAT CRON]
Olá Clara! Este é o seu pulso de vida. Ninguém está digitando isso para você na tela, o sistema te acordou.
Sua missão agora é:
1. Use 'query_database_table' na tabela 'chat_messages'. Procure mensagens enviadas por humanos (sender = 'HUMAN_AGENT' ou sender = 'me') nas últimas 24 horas.
2. Identifique quais foram as perguntas dos pacientes antes dessas respostas.
3. Se você identificar um padrão bom (uma explicação clara sobre valores, regras ou procedimentos médicos), USE a ferramenta 'extract_and_save_knowledge' para salvar esse gabarito na sua knowledge_base.
4. Ao final, mande um pequeno relatório neste chat interno dizendo o que você analisou e o que aprendeu hoje.`;

    console.log("⏰ [Cron Heartbeat] Acordando a Clara para a rotina de estudos...");

    // Dispara a IA em background para o endpoint do Cron não dar timeout (Edge Functions/Serverless limit)
    (async () => {
      try {
        const result = await claraGraph.invoke({
          messages: [new HumanMessage(studyCommand)],
          chat_id: chatId
        });

        const aiResponseText = result.messages[result.messages.length - 1].content.toString();

        // Salva a mensagem no chat da Clara para o usuário ler o resultado
        await supabase.from('chat_messages').insert({
          chat_id: chatId,
          phone: '00000000000',
          sender: 'contact',
          message_text: aiResponseText,
          message_type: 'text',
          status: 'read',
          created_at: new Date().toISOString(),
          wpp_id: `heartbeat_${Date.now()}`
        });

        await supabase.from('chats').update({
          last_message: aiResponseText,
          last_message_type: 'text',
          last_message_sender: 'contact',
          last_message_status: 'read',
          last_interaction_at: new Date().toISOString(),
          unread_count: 1 // Adiciona notificação visual pro Brendo ver que ela fez algo!
        }).eq('id', chatId);

        console.log("✅ [Cron Heartbeat] Clara terminou de estudar e deixou um relatório no painel.");
      } catch (e) {
        console.error("❌ Erro durante o estudo autônomo da Clara:", e);
      }
    })();

    return NextResponse.json({ success: true, message: "Heartbeat acionado. Clara está estudando em background." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
