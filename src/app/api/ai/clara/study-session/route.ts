import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { claraGraph, ClaraState } from '@/ai/clara/graph';
import { HumanMessage } from "@langchain/core/messages";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const CLARA_CHAT_ID = 1495;

export async function POST(request: Request) {
  const { prompt } = await request.json() as { prompt?: string };

  const studyPrompt = prompt ?? `[SESSÃO DE ESTUDO PROFUNDO]

Sua memória foi zerada. Construa conhecimento profundo do zero estudando os dados reais.

FORMATO OBRIGATÓRIO para cada memória:
"**Padrão:** [nome]
**Frequência:** [alta/média/baixa] — [evidência]
**Observação:** [o que acontece concretamente com contexto]
**Impacto:** [consequência financeira/operacional real]
**Ação recomendada:** [o que fazer quando esse padrão ocorrer]"

Execute em sequência:

MISSÃO 1 — OBJEÇÕES DE PREÇO
Analise chats dos últimos 30 dias onde paciente questionou valor da consulta.
Identifique: quem converte, quem abandona, o que a secretária diz que funciona vs. não funciona.
Salve 3 memórias profundas sobre padrões de objeção de preço.

MISSÃO 2 — URGÊNCIAS E PERDAS
Identifique chats com sintomas agudos (febre, vômito, diarreia, dor). O que aconteceu?
Foram atendidos? Abandonaram? Há protocolo?
Salve 2 memórias sobre gestão de urgências com impacto financeiro estimado.

MISSÃO 3 — FALHAS OPERACIONAIS
Identifique os 3 erros mais recorrentes da secretária — perguntas ignoradas, dados não coletados, chats abandonados.
Salve como feedback_melhoria com frequência e impacto financeiro.

MISSÃO 4 — PADRÕES DE AGENDAMENTO
Quais horários têm mais demanda? Qual dia da semana? Quais restrições comuns?
Salve padrões que ajudem a otimizar a agenda e reduzir ociosidade.

MISSÃO 5 — OPORTUNIDADES DE RECEITA
Identifique serviços que poderiam ser oferecidos mas raramente são (combo, retorno, produtos).
Estime receita perdida por semana.
Salve 2 memórias de oportunidade com valor estimado.

Use analyze_raw_conversations para cada missão. Seja PROFUNDO e CONCRETO.`;

  // Salvar o prompt no chat como contexto
  await supabase.from('chat_messages').insert({
    chat_id: CLARA_CHAT_ID,
    phone: '00000000000',
    sender: 'HUMAN_AGENT',
    message_text: studyPrompt,
    message_type: 'text',
    status: 'read',
    created_at: new Date().toISOString(),
    wpp_id: `study_${Date.now()}`,
  });

  // Disparar em background
  (async () => {
    try {
      const result = await claraGraph.invoke(
        { messages: [new HumanMessage(studyPrompt)], chat_id: CLARA_CHAT_ID },
        { configurable: { thread_id: `clara_study_${Date.now()}` } }
      ) as unknown as ClaraState;

      const response = result.messages[result.messages.length - 1]?.content?.toString() ?? '';

      await supabase.from('chat_messages').insert({
        chat_id: CLARA_CHAT_ID,
        phone: '00000000000',
        sender: 'contact',
        message_text: response,
        message_type: 'text',
        status: 'read',
        created_at: new Date().toISOString(),
        wpp_id: `study_response_${Date.now()}`,
      });

      await supabase.from('chats').update({
        last_message: response.slice(0, 200),
        last_interaction_at: new Date().toISOString(),
        unread_count: 1,
      }).eq('id', CLARA_CHAT_ID);

      console.log('[StudySession] Sessão concluída. Memórias salvas.');
    } catch (e) {
      console.error('[StudySession] Erro:', e);
    }
  })();

  return NextResponse.json({ success: true, message: 'Sessão de estudo iniciada. Clara está analisando os dados em background.' });
}
