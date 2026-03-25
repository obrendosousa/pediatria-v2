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
      .map((m: { sender?: string; message_text?: string; message?: string }) => {
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
          content: `Você é uma assistente de agendamento pediátrico experiente. Analise a conversa abaixo e extraia TODAS as informações necessárias para criar um agendamento.

Data e hora atual: ${currentDate}

INSTRUÇÕES DE EXTRAÇÃO — leia com atenção:

1. NOME DO PACIENTE (CRIANÇA):
   - Extraia o nome COMPLETO da criança mencionada na conversa.
   - Atenção: o paciente é a CRIANÇA, não o responsável que está conversando.

2. IDENTIFICAÇÃO DO SEXO DA CRIANÇA:
   - Analise o NOME da criança (ex: "Gabriel" = M, "Maria" = F, "Ana" = F, "Pedro" = M, "Sophia" = F).
   - Procure pronomes (ele/ela, menino/menina, filho/filha) e referências como "minha filha", "meu filho", "meu menino", "minha menina".
   - Se não conseguir identificar com certeza, use null.

3. DATA DE NASCIMENTO DA CRIANÇA:
   - Procure ATIVAMENTE por data de nascimento na conversa. Pode aparecer como:
     * "Data de nascimento: DD/MM/AAAA" ou "nascimento: DD/MM/AAAA"
     * "nasceu em DD/MM/AAAA" ou "nasceu dia DD/MM/AAAA"
     * "tem X meses" ou "tem X anos" (calcule a data aproximada a partir da data atual)
     * "DD/MM/AAAA" logo após menção de nascimento
   - Converta SEMPRE para o formato YYYY-MM-DD (ISO).
   - Exemplo: "10/02/2023" → "2023-02-10"
   - Se não encontrar, use null.

4. IDENTIFICAÇÃO DOS PAIS/RESPONSÁVEIS:
   - Identifique separadamente nome da MÃE e do PAI.
   - Procure por "mãe", "pai", "mamãe", "papai", "responsável", "Nome completo dos pais ou responsáveis".
   - Se a pessoa que conversa se identifica pelo nome E como mãe/pai, coloque no campo correspondente.
   - Se houver apenas um nome de responsável sem distinção, coloque em "motherName" (mais comum em pediatria).

5. TELEFONE:
   - Extraia o número de telefone mencionado na conversa (campo "Telefone para contato" ou similar).
   - Mantenha apenas dígitos. Se tiver código do país (55), mantenha. Se não tiver, mantenha como está.

6. ENDEREÇO:
   - Extraia o endereço completo se mencionado na conversa.
   - Retorne como string única (ex: "Av. Masura Jorge, 190 C").

7. ANÁLISE CLÍNICA (reason):
   - Faça uma ANÁLISE COMPLETA: sintomas mencionados, histórico, urgência, contexto.
   - Formato profissional: "Paciente apresenta [sintomas]. Relato de [histórico]. [Urgência/contexto]. Recomendação: [sugestão]."
   - Mínimo 2-3 frases.

8. TIPO DE ATENDIMENTO:
   - Determine se é "consulta" (primeira vez ou consulta regular) ou "retorno" (follow-up).
   - Se o paciente menciona que já foi atendido antes, é "retorno".
   - Se menciona que é primeira vez ou não há indicação, é "consulta".
   - Se não conseguir determinar, use "consulta" como padrão.

9. DATA E HORA DA CONSULTA:
   - Se a conversa menciona uma data/hora desejada, use essa.
   - Se não, sugira a próxima data útil (segunda a sexta, horário comercial).
   - Use a data atual se não houver menção específica.
   - Formato: YYYY-MM-DD para data, HH:MM para hora (padrão 09:00).

Retorne APENAS um JSON válido, sem markdown ou texto adicional:
{
  "patientName": "Nome completo da criança ou null",
  "motherName": "Nome da mãe ou null",
  "fatherName": "Nome do pai ou null",
  "phone": "Telefone (apenas dígitos) ou null",
  "birthDate": "YYYY-MM-DD ou null",
  "address": "Endereço completo ou null",
  "suggestedDate": "YYYY-MM-DD",
  "suggestedTime": "HH:MM",
  "reason": "Análise clínica completa (mínimo 2-3 frases)",
  "patientSex": "M ou F ou null",
  "appointmentType": "consulta ou retorno"
}`
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
      motherName: data.motherName || null,
      fatherName: data.fatherName || null,
      phone: data.phone || null,
      birthDate: data.birthDate || null,
      address: data.address || null,
      suggestedDate: data.suggestedDate || new Date().toISOString().split('T')[0],
      suggestedTime: data.suggestedTime || '09:00',
      reason: data.reason || 'Consulta agendada via chat',
      patientSex: (data.patientSex === 'M' || data.patientSex === 'F') ? data.patientSex : null,
      appointmentType: (data.appointmentType === 'consulta' || data.appointmentType === 'retorno') ? data.appointmentType : 'consulta'
    };

    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Erro na IA:', error);

    // Mensagem de erro mais específica para timeout
    const errMsg = error instanceof Error ? error.message : '';
    let errorMessage = errMsg || 'Falha ao processar com IA';
    if (errMsg.includes('timed out') || errMsg.includes('Request timed out')) {
      errorMessage = 'Request timed out. A requisição para a OpenAI demorou muito. Tente novamente.';
    } else if (errMsg.includes('rate limit') || errMsg.includes('429')) {
      errorMessage = 'Muitas requisições. Aguarde alguns instantes e tente novamente.';
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
