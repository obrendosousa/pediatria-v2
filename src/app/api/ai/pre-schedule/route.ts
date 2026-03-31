import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY não configurada' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Mensagens inválidas' },
        { status: 400 }
      );
    }

    const conversationText = messages
      .slice(-30)
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

    const systemPrompt = `Você é uma assistente de agendamento de clínica médica. Analise a conversa abaixo e extraia TODAS as informações necessárias para criar um agendamento.

Data e hora atual: ${currentDate}

INSTRUÇÕES DE EXTRAÇÃO — leia com atenção:

1. NOME DO PACIENTE:
   - Extraia o nome COMPLETO do paciente mencionado na conversa.
   - Em contexto pediátrico, o paciente é a CRIANÇA, não o responsável.
   - Em contexto de clínica geral, o paciente é quem será atendido.

2. IDENTIFICAÇÃO DO SEXO:
   - Analise o NOME (ex: "Gabriel" = M, "Maria" = F).
   - Procure pronomes (ele/ela) e referências como "minha filha", "meu filho".
   - Se não conseguir identificar com certeza, use null.

3. DATA DE NASCIMENTO:
   - Procure ATIVAMENTE por data de nascimento na conversa. Pode aparecer como:
     * "Data de nascimento: DD/MM/AAAA" ou "nascimento: DD/MM/AAAA"
     * "nasceu em DD/MM/AAAA" ou "nasceu dia DD/MM/AAAA"
     * "tem X meses" ou "tem X anos" (calcule a data aproximada a partir da data atual)
     * "DD/MM/AAAA" logo após menção de nascimento
   - Converta SEMPRE para o formato YYYY-MM-DD (ISO).
   - Exemplo: "10/02/2023" → "2023-02-10"
   - Se não encontrar, use null.

4. IDENTIFICAÇÃO DOS RESPONSÁVEIS / FAMILIARES:
   - Extraia TODOS os responsáveis/familiares mencionados na conversa.
   - Para CADA responsável identificado, determine:
     * "name": nome completo da pessoa
     * "relationship": o grau de parentesco com o paciente
   - Vínculos possíveis: "Mãe", "Pai", "Avó", "Avô", "Tia", "Tio", "Irmã", "Irmão", "Cônjuge", "Responsável Legal", "Outro"
   - Se houver apenas um nome de responsável sem distinção, use "Responsável Legal".
   - Retorne como array de objetos: [{"name": "...", "relationship": "..."}]

5. TELEFONE:
   - Extraia o número de telefone mencionado na conversa.
   - Mantenha apenas dígitos. Se tiver código do país (55), mantenha.

6. ENDEREÇO:
   - Extraia o endereço completo se mencionado na conversa.
   - Retorne como string única.

7. ANÁLISE CLÍNICA (reason):
   - Faça uma ANÁLISE COMPLETA: sintomas mencionados, histórico, urgência, contexto.
   - Formato profissional: "Paciente apresenta [sintomas]. Relato de [histórico]. [Urgência/contexto]. Recomendação: [sugestão]."
   - Mínimo 2-3 frases.

8. TIPO DE ATENDIMENTO:
   - "consulta" (primeira vez ou consulta regular) ou "retorno" (follow-up).
   - Se o paciente menciona que já foi atendido antes, é "retorno".
   - Se não conseguir determinar, use "consulta" como padrão.

9. DATA E HORA DA CONSULTA:
   - Se a conversa menciona uma data/hora desejada, use essa.
   - Se não, sugira a próxima data útil (segunda a sexta, horário comercial).
   - Use a data atual se não houver menção específica.
   - Formato: YYYY-MM-DD para data, HH:MM para hora (padrão 09:00).

Retorne APENAS um JSON válido com esta estrutura:
{
  "patientName": "Nome completo do paciente ou null",
  "guardians": [{"name": "Nome do responsável", "relationship": "Mãe"}],
  "phone": "Telefone (apenas dígitos) ou null",
  "birthDate": "YYYY-MM-DD ou null",
  "address": "Endereço completo ou null",
  "suggestedDate": "YYYY-MM-DD",
  "suggestedTime": "HH:MM",
  "reason": "Análise clínica completa (mínimo 2-3 frases)",
  "patientSex": "M ou F ou null",
  "appointmentType": "consulta ou retorno"
}`;

    const completionPromise = model.generateContent([
      systemPrompt,
      `Conversa:\n${conversationText}`,
    ]);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out. A requisição demorou mais de 50 segundos.')), 50000);
    });

    const result = await Promise.race([completionPromise, timeoutPromise]);
    const content = result.response.text();

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    const data = JSON.parse(content);

    // Processar guardians
    const guardians: Array<{ name: string; relationship: string }> = [];
    if (Array.isArray(data.guardians)) {
      for (const g of data.guardians) {
        if (g?.name?.trim()) {
          guardians.push({ name: g.name.trim(), relationship: g.relationship || 'Responsável Legal' });
        }
      }
    }

    // Derivar motherName/fatherName dos guardians para backward compat
    const mother = guardians.find(g => g.relationship === 'Mãe');
    const father = guardians.find(g => g.relationship === 'Pai');

    // Se a IA retornou no formato antigo (motherName/fatherName), converter para guardians
    if (guardians.length === 0) {
      if (data.motherName?.trim()) {
        guardians.push({ name: data.motherName.trim(), relationship: 'Mãe' });
      }
      if (data.fatherName?.trim()) {
        guardians.push({ name: data.fatherName.trim(), relationship: 'Pai' });
      }
    }

    const response = {
      patientName: data.patientName || null,
      motherName: mother?.name || data.motherName || null,
      fatherName: father?.name || data.fatherName || null,
      guardians: guardians.length > 0 ? guardians : undefined,
      phone: data.phone || null,
      birthDate: data.birthDate || null,
      address: data.address || null,
      suggestedDate: data.suggestedDate || new Date().toISOString().split('T')[0],
      suggestedTime: data.suggestedTime || '09:00',
      reason: data.reason || 'Consulta agendada via chat',
      patientSex: (data.patientSex === 'M' || data.patientSex === 'F') ? data.patientSex : null,
      appointmentType: (data.appointmentType === 'consulta' || data.appointmentType === 'retorno') ? data.appointmentType : 'consulta'
    };

    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error('Erro na IA:', error);

    const errMsg = error instanceof Error ? error.message : '';
    let errorMessage = errMsg || 'Falha ao processar com IA';
    if (errMsg.includes('timed out') || errMsg.includes('Request timed out')) {
      errorMessage = 'Request timed out. A requisição demorou muito. Tente novamente.';
    } else if (errMsg.includes('rate limit') || errMsg.includes('429')) {
      errorMessage = 'Muitas requisições. Aguarde alguns instantes e tente novamente.';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
