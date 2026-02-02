import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    // Verificar se a chave da API está configurada
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'OPENAI_API_KEY não configurada',
          message: 'A chave da API OpenAI não está configurada. Por favor, adicione OPENAI_API_KEY no arquivo .env.local'
        },
        { status: 500 }
      );
    }

    // Inicializar OpenAI apenas se a chave existir
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 50000, // 50 segundos de timeout
      maxRetries: 1 // Apenas 1 tentativa para evitar demoras
    });

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Mensagens inválidas' },
        { status: 400 }
      );
    }

    // Formata conversa simples para economizar tokens
    const conversationText = messages
      .slice(-30) // Pega apenas as últimas 30 mensagens para contexto recente
      .map((m: any) => {
        const sender = m.sender === 'HUMAN_AGENT' || m.sender === 'me' ? 'Clínica' : 'Paciente';
        const text = m.message_text || m.message || '[Mídia]';
        return `${sender}: ${text}`;
      })
      .join('\n');

    const currentDate = new Date().toLocaleString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Criar um timeout wrapper para a chamada da OpenAI
    const completionPromise = openai.chat.completions.create({
      model: "gpt-4o-mini", // Modelo rápido e barato
      messages: [
        {
          role: "system",
          content: `Você é uma assistente de agendamento pediátrico experiente. Analise a conversa abaixo e extraia as informações necessárias para criar um agendamento.

Data atual: ${currentDate}

INSTRUÇÕES IMPORTANTES:

1. IDENTIFICAÇÃO DO SEXO DA CRIANÇA:
   - Analise o NOME da criança para identificar o sexo (ex: "Maria" = F, "João" = M, "Ana" = F, "Pedro" = M)
   - Procure por pronomes na conversa (ele/ela, menino/menina, filho/filha)
   - Procure por referências explícitas ao sexo (ex: "minha filha", "meu filho", "ela está", "ele está")
   - Se não conseguir identificar com certeza, use null

2. ANÁLISE DO ATENDIMENTO:
   - O campo "reason" deve conter uma ANÁLISE COMPLETA do atendimento, não apenas um resumo curto
   - Inclua: sintomas mencionados, histórico relevante, urgência percebida, contexto da conversa
   - Formate como um resumo clínico profissional mas acessível
   - Exemplo: "Paciente apresenta [sintomas]. Relato de [histórico]. [Observações sobre urgência/contexto]. Recomendação: [sugestão baseada no contexto]"

Retorne APENAS um JSON no seguinte formato, sem markdown ou texto adicional:
{
  "patientName": "Nome da criança (ou null se não encontrado)",
  "parentName": "Nome do pai/mãe/responsável (ou null se não encontrado)",
  "phone": "Telefone se mencionado na conversa (ou null)",
  "suggestedDate": "YYYY-MM-DD (use a data atual se não especificado, ou a próxima data lógica baseada no contexto)",
  "suggestedTime": "HH:MM (use 09:00 como padrão se não especificado)",
  "reason": "ANÁLISE COMPLETA do atendimento incluindo sintomas, histórico, urgência e contexto (mínimo 2-3 frases, formato profissional)",
  "patientSex": "M ou F (identifique pelo nome ou evidências na conversa, ou null se não conseguir identificar)"
}

Se não encontrar informações específicas, use null para os campos opcionais. Para a data, se não houver menção específica, sugira a próxima data útil (segunda a sexta, horário comercial).`
        },
        { role: "user", content: conversationText }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Baixa temperatura para ser mais preciso nos dados
    });

    // Adicionar timeout de 50 segundos
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out. A requisição para a OpenAI demorou mais de 50 segundos.')), 50000);
    });

    const completion = await Promise.race([completionPromise, timeoutPromise]);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    const data = JSON.parse(content);
    
    // Validação básica dos campos
    const result = {
      patientName: data.patientName || null,
      parentName: data.parentName || null,
      phone: data.phone || null,
      suggestedDate: data.suggestedDate || new Date().toISOString().split('T')[0],
      suggestedTime: data.suggestedTime || '09:00',
      reason: data.reason || 'Consulta agendada via chat',
      patientSex: (data.patientSex === 'M' || data.patientSex === 'F') ? data.patientSex : null
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Erro na IA:', error);
    
    // Mensagem de erro mais específica para timeout
    let errorMessage = error.message || 'Falha ao processar com IA';
    if (error.message?.includes('timed out') || error.message?.includes('Request timed out')) {
      errorMessage = 'Request timed out. A requisição para a OpenAI demorou muito. Tente novamente.';
    } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      errorMessage = 'Muitas requisições. Aguarde alguns instantes e tente novamente.';
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
