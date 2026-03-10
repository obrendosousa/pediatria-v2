# PRD — Clara 2.0: Arquitetura de Precisão Milimétrica

**Versão:** 2.1
**Data:** 2026-03-09
**Autor:** Análise completa do banco de dados + código + melhores práticas de agentes IA
**Status:** Aprovado — aguardando implementação
**Prioridade:** CRÍTICA — sistema em produção com problemas de precisão

---

## 1. DIAGNÓSTICO: Por que a Clara erra hoje

### 1.1 Problemas Identificados (Evidências Reais do Banco)

Após análise direta no Supabase (`juctfolupehtaoehjkwl`), identifiquei as raízes dos problemas:

**PROBLEMA 1 — Datas sem âncora temporal precisa**
- O `buildSystemPrompt()` injeta `new Date().toISOString()` como referência, mas é UTC. O usuário está em BRT (UTC-3).
- Quando o Brendo pergunta "como foi o atendimento HOJE", a Clara pode interpretar "hoje" como o dia UTC (que é diferente do dia BRT entre 21h-00h).
- O campo `last_interaction_at` dos chats está em UTC no banco. A conversão BRT acontece inconsistentemente — às vezes no SQL (`AT TIME ZONE`), às vezes no código JS.

**PROBLEMA 2 — Contexto poluído pelo chat do paciente**
- A API route `/api/ai/copilot/chat` injeta as **últimas 20 mensagens do chat atual** no prompt. Quando o Brendo pergunta "como está o atendimento hoje?", a Clara recebe essas 20 mensagens como contexto e pode confundir dados do paciente atual com dados globais.
- O prompt diz "se a pergunta for GERAL, ignore o paciente", mas o modelo nem sempre obedece — as mensagens do chat estão ali no contexto, causando interferência.

**PROBLEMA 3 — Ferramentas sem validação de resultado**
- `execute_sql` retorna dados brutos sem nenhuma verificação se os resultados correspondem ao período pedido.
- `get_volume_metrics` faz paginação mas não tem validação de completude — se um dia tem 0 mensagens, ele simplesmente não aparece (o modelo pode interpretar como "sem dados" em vez de "zero no dia").
- `gerar_relatorio_qualidade_chats` tem fallback de 60/90/180 dias se não encontrar dados no período pedido — trazendo dados de períodos maiores SEM AVISAR.

**PROBLEMA 4 — stage e ai_sentiment nunca atualizados**
- 100% dos 237 chats estão com `stage = 'new'` e `ai_sentiment = 'neutral'`.
- Isso significa que filtros por stage/sentimento não funcionam na prática.
- A Clara reporta esses dados como se fossem reais, quando são defaults nunca preenchidos.

**PROBLEMA 5 — chat_insights desatualizado**
- Apenas 175 insights processados (de 237 chats), cobrindo 26/fev a 02/mar.
- Os últimos 7 dias (03-09/mar) NÃO têm insights. A Clara usa `gerar_relatorio_qualidade_chats` que depende dessa tabela — retorna dados desatualizados.

**PROBLEMA 6 — Ausência de feedback de progresso granular**
- O streaming atual mostra labels genéricos como "🔍 Executando etapa..." mas não mostra O QUE está sendo feito (qual query, quantos registros, qual período).
- O usuário não vê progresso real, não sabe se a Clara está trabalhando no período certo.

**PROBLEMA 7 — Gestão de contexto insuficiente**
- O `simple_agent` recebe TODO o histórico de mensagens sem compactação. Em conversas longas, as primeiras mensagens perdem peso (attention decay).
- Os `raw_notes` dos researchers são concatenados sem limite — em pesquisas pesadas, podem exceder o contexto.
- Não existe nenhum mecanismo de "observation masking" ou compaction.

**PROBLEMA 8 — Clara nunca pede clarificação**
- Se a pergunta é ambígua ("como estão as coisas?", "me dá um relatório"), Clara inventa um escopo em vez de perguntar.
- Não existe mecanismo para Clara pausar execução e pedir input do usuário.
- Isso leva a relatórios que não são o que o Brendo esperava, gerando retrabalho.

---

## 2. ARQUITETURA PROPOSTA: Clara 2.0

### 2.1 Visão Geral

```
ANTES (Clara 1.0):
  User → classify → [simple_agent | research_pipeline] → resposta
  Problemas: sem validação, sem âncora temporal, contexto poluído, nunca pergunta

DEPOIS (Clara 2.0):
  User → temporal_anchor → context_separator → classify → [
    → clarification_check → (se ambíguo: pergunta interativa ao usuário)
    → simple_agent → query_validator → spot_check_verifier → resposta
    |
    → research_pipeline → progressive_streaming → spot_check_verifier → resposta
  ]
  + Perguntas interativas com sugestões (estilo Claude Code)
  + Live Progress Dashboard no frontend
```

### 2.2 Princípios da Nova Arquitetura

1. **TEMPORAL ANCHOR FIRST**: Toda interação começa resolvendo "quando" em timestamps absolutos BRT — incluindo períodos de comparação quando necessário
2. **CONTEXT SEPARATION FÍSICA**: Se pergunta é global, patient_context NÃO É INJETADO (remoção física, não confiança no modelo)
3. **QUERY → VALIDATE → VERIFY → SPOT-CHECK**: Toda query passa por 4 camadas de validação
4. **ASK BEFORE GUESS**: Se a pergunta é ambígua, Clara PERGUNTA com sugestões clicáveis em vez de adivinhar
5. **PROGRESSIVE DISCLOSURE**: Frontend mostra cada etapa com dados reais (período, contagens, queries)
6. **GROUNDED GENERATION**: A resposta final só pode conter dados que passaram pela cadeia de verificação
7. **TRUST BUT VERIFY**: Outputs de inner LLM calls (analyze_raw_conversations) passam por spot-check de citações
8. **OBSERVATION MASKING**: Manter apenas as últimas N interações relevantes no contexto

---

## 3. IMPLEMENTAÇÃO DETALHADA

### 3.1 CAMADA 1: Temporal Anchor Service (NOVO)

**Arquivo:** `src/ai/clara/temporal_anchor.ts`

**Propósito:** Resolver TODAS as expressões temporais em timestamps BRT absolutos ANTES de qualquer processamento. Suporta período único, período comparativo, e referências multi-turn.

```typescript
// SPEC: temporal_anchor.ts

interface TemporalAnchor {
  // Timestamps absolutos em BRT (America/Sao_Paulo)
  start_brt: string;   // "2026-03-09T00:00:00-03:00"
  end_brt: string;     // "2026-03-09T23:59:59.999-03:00"

  // Labels para exibição
  period_label: string; // "hoje (09/03/2026)" ou "esta semana (03/03 a 09/03)"

  // Para SQL (já formatado)
  sql_start: string;    // "'2026-03-09T00:00:00-03:00'::timestamptz"
  sql_end: string;      // "'2026-03-09T23:59:59.999-03:00'::timestamptz"
  sql_group_by: string; // "DATE(campo AT TIME ZONE 'America/Sao_Paulo')"

  // ══════════════════════════════════════════════════
  // FIX BRECHA 2: Período de comparação automático
  // ══════════════════════════════════════════════════
  comparison_period: {
    start_brt: string;
    end_brt: string;
    sql_start: string;
    sql_end: string;
    label: string;        // "mesmo período do mês anterior (01/02 a 09/02)"
    comparison_type: "previous_period" | "same_period_last_month" | "same_period_last_year" | "custom";
  } | null;
  // Preenchido automaticamente quando detecta verbos comparativos:
  // "caiu", "subiu", "cresceu", "diminuiu", "melhorou", "piorou",
  // "comparar", "vs", "em relação a", "diferença", "mudou"
  // Lógica: se o período primário é "este mês", comparison = "mesmo recorte do mês anterior"
  //         se o período primário é "esta semana", comparison = "mesma semana anterior"

  // ══════════════════════════════════════════════════
  // FIX BRECHA 6: Contexto multi-turn
  // ══════════════════════════════════════════════════
  previous_anchor: TemporalAnchor | null;
  // Recebe o temporal_anchor da mensagem anterior via state do graph.
  // Permite resolver referências relativas:
  // "e o mês anterior?" → usa previous_anchor.start_brt para calcular
  // "e antes disso?" → navega para o período anterior ao previous_anchor
  // "comparando com o mesmo período" → gera comparison_period baseado no previous_anchor

  // Metadados
  resolved_from: string; // Expressão original do usuário: "hoje", "esta semana", etc.
  now_brt: string;       // Horário atual em BRT no momento da resolução

  // ══════════════════════════════════════════════════
  // FIX BRECHA 3: Classificação da intenção temporal
  // ══════════════════════════════════════════════════
  intent_type: "operational" | "strategic" | "comparative" | "specific" | "ambiguous";
  // "operational" → perguntas do dia-a-dia ("como está hoje?", "quantos essa semana?")
  //   → Default: últimos 7 dias se não especificado
  // "strategic" → perguntas de padrão/tendência ("quais são as objeções?", "como está o atendimento?")
  //   → Default: últimos 90 dias ou todo histórico se não especificado
  // "comparative" → perguntas com verbo comparativo ("caiu", "subiu")
  //   → OBRIGATÓRIO ter comparison_period
  // "specific" → período explícito ("de 01/02 a 28/02")
  //   → Sem default necessário
  // "ambiguous" → sem temporal claro E sem classificação possível
  //   → TRIGGER: Clara deve PERGUNTAR ao usuário (ver Camada 10: Interactive Questions)
}

// Implementação deve resolver:
// "hoje" → 00:00:00 até 23:59:59 do dia atual em BRT
// "ontem" → 00:00:00 até 23:59:59 do dia anterior em BRT
// "esta semana" → segunda 00:00 até agora em BRT
// "semana passada" → segunda 00:00 até domingo 23:59 da semana anterior
// "este mês" → dia 1 00:00 até agora
// "últimos N dias" → N dias atrás 00:00 até agora
// "de DD/MM a DD/MM" → período explícito
// "março" → 01/03 até 31/03 (ou até agora se for o mês corrente)
//
// NOVAS resoluções (multi-turn):
// "e o mês passado?" → usa previous_anchor para navegar
// "e antes disso?" → período imediatamente anterior ao previous_anchor
// "comparando com o ano passado" → gera comparison_period com -1 ano
//
// Sem expressão temporal:
//   → intent_type="operational" → últimos 7 dias
//   → intent_type="strategic" → últimos 90 dias
//   → intent_type="ambiguous" → null (Clara vai perguntar)

// REGRAS:
// 1. SEMPRE usar America/Sao_Paulo como timezone
// 2. NUNCA usar UTC para exibição ao usuário
// 3. new Date() convertido para BRT antes de qualquer operação
// 4. Retornar SEMPRE o period_label para a Clara incluir na resposta
// 5. Para comparativos, SEMPRE calcular comparison_period (NUNCA deixar o modelo calcular datas sozinho)
// 6. Receber previous_anchor do state para resolver referências relativas
```

**Função de resolução de intent_type:**

```typescript
// SPEC: Classificação automática de intenção temporal
// Roda ANTES da resolução de datas

function classifyTemporalIntent(
  userMessage: string,
  previousAnchor: TemporalAnchor | null
): "operational" | "strategic" | "comparative" | "specific" | "ambiguous" {

  const msg = userMessage.toLowerCase();

  // 1. Específico — tem datas explícitas
  if (/\d{1,2}\/\d{1,2}|\d{4}-\d{2}|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/.test(msg)) {
    return "specific";
  }

  // 2. Comparativo — verbos de mudança
  if (/cai[ur]|subi[ur]|cresc|diminu|melhor|pior|compar|diferença|mudou|vs|em relação/.test(msg)) {
    return "comparative";
  }

  // 3. Operacional — referências temporais curtas
  if (/hoje|ontem|essa semana|esta semana|esse mês|este mês|últimos? \d+/.test(msg)) {
    return "operational";
  }

  // 4. Estratégico — perguntas de padrão/tendência sem período
  if (/objeç|padrão|padrões|tendência|principal|mais comum|recorrente|geral|sempre|costum/.test(msg)) {
    return "strategic";
  }

  // 5. Multi-turn — referência ao anterior
  if (previousAnchor && /e o|e a|e no|e na|antes|anterior|passado|comparando/.test(msg)) {
    return previousAnchor.intent_type === "comparative" ? "comparative" : "operational";
  }

  // 6. Tem alguma referência temporal implícita?
  if (/atendimento|conversa|mensagen|relatório|desempenho/.test(msg)) {
    return "operational"; // Default para perguntas operacionais sem período
  }

  // 7. Verdadeiramente ambíguo
  return "ambiguous";
}
```

**Integração:** O `classify_node` deve chamar `resolveTemporalAnchor(userMessage, previousAnchor)` e injetar o resultado no state como `temporal_anchor`. Todos os nós subsequentes usam esses timestamps em vez de calcular datas por conta própria. Se `intent_type === "ambiguous"`, o fluxo é desviado para o sistema de perguntas interativas (Camada 10).

---

### 3.2 CAMADA 2: Context Separator — Remoção Física (MODIFICAÇÃO)

**Arquivo:** `src/app/api/ai/copilot/chat/route.ts`

**Problema atual:** O prompt injeta 20 mensagens do chat + pergunta do usuário tudo junto. Gemini é fraco com XML boundaries — mesmo com tags, ele "vaza" contexto entre zonas.

**Solução (FIX BRECHA 5):** Separar em ZONAS DE CONTEXTO com **remoção física** — se a pergunta for global, o patient_context NÃO É INJETADO no prompt. Não confiamos no modelo para ignorar; tiramos do contexto.

```typescript
// SPEC: Nova construção do contextualMessage

// PASSO 1: Classificar escopo da pergunta (ANTES de montar o prompt)
function classifyScope(message: string, chatId: number): "LOCAL" | "GLOBAL" {
  const msg = message.toLowerCase();

  // Indicadores LOCAIS (sobre este paciente/chat)
  const localIndicators = [
    "esse paciente", "esta conversa", "esse chat", "esse contato",
    "histórico dele", "histórico dela", "última mensagem",
    "o que ele disse", "o que ela disse", "responda pra"
  ];

  // Indicadores GLOBAIS
  const globalIndicators = [
    "clínica", "atendimento", "período", "semana", "dia", "relatório",
    "quantos", "quantas", "como está", "como estão", "total",
    "faturamento", "vendas", "agendamento", "objeções", "padrões",
    "todos os", "todas as", "geral", "visão geral"
  ];

  const localScore = localIndicators.filter(i => msg.includes(i)).length;
  const globalScore = globalIndicators.filter(i => msg.includes(i)).length;

  // Em caso de empate ou dúvida → GLOBAL (remove patient_context por segurança)
  return localScore > globalScore ? "LOCAL" : "GLOBAL";
}

// PASSO 2: Montar prompt com remoção física
const scope = classifyScope(message, chatId);

const contextualMessage = `<session>
<metadata>
  <now_brt>${nowBRT}</now_brt>
  <chat_id>${chatId}</chat_id>
  <patient_name>${patientName}</patient_name>
  <user_role>${userRole}</user_role>
  <query_scope>${scope}</query_scope>
</metadata>

${scope === "LOCAL" ? `<patient_context scope="LOCAL">
${chatHistory || "Sem mensagens recentes."}
</patient_context>` : "<!-- patient_context REMOVIDO: pergunta classificada como GLOBAL -->"}

<user_question scope="PRINCIPAL">
${message}
</user_question>

<instructions>
${scope === "GLOBAL"
  ? "ESCOPO: GLOBAL. Não há contexto de paciente injetado. Responda usando APENAS dados das ferramentas."
  : "ESCOPO: LOCAL. Use o <patient_context> acima para contextualizar sua resposta sobre ESTE paciente. Não misture com dados globais."}
</instructions>
</session>`;
```

**Benefício:** Remoção física elimina 100% do risco de vazamento de contexto local para perguntas globais. Gemini não precisa "ignorar" nada — a informação simplesmente não está lá.

---

### 3.3 CAMADA 3: Query Validator (NOVO)

**Arquivo:** `src/ai/clara/query_validator.ts`

**Propósito:** Toda query SQL gerada pela Clara passa por validação ANTES e DEPOIS da execução.

```typescript
// SPEC: query_validator.ts

interface QueryValidation {
  // PRÉ-EXECUÇÃO
  pre_validate(sql: string, temporalAnchor: TemporalAnchor): {
    is_valid: boolean;
    issues: string[];         // Ex: ["Query não tem filtro de data", "LIMIT ausente"]
    corrected_sql?: string;   // SQL corrigido automaticamente
    expected_behavior: string; // "Deve retornar contagem por dia de 03/03 a 09/03"
  };

  // PÓS-EXECUÇÃO
  post_validate(sql: string, results: any[], temporalAnchor: TemporalAnchor): {
    is_valid: boolean;
    issues: string[];         // Ex: ["Resultados contêm datas fora do período"]
    data_quality: {
      row_count: number;
      date_range_found: { min: string; max: string } | null;
      date_range_expected: { min: string; max: string };
      has_out_of_range_data: boolean;
      missing_days: string[]; // Dias no período sem dados (pode ser válido = zero)
      null_count: number;
    };
    summary_for_model: string; // Resumo legível para a Clara
  };
}

// REGRAS DE VALIDAÇÃO PRÉ-EXECUÇÃO:
// 1. Se temporalAnchor existe, a query DEVE ter WHERE com filtro de data
// 2. O filtro de data deve usar timestamptz com offset -03:00
// 3. Query DEVE ter LIMIT (máx 1000)
// 4. Só SELECT/WITH permitidos (já existe, manter)
// 5. Se agrupar por dia, DEVE usar AT TIME ZONE 'America/Sao_Paulo'

// REGRAS DE VALIDAÇÃO PÓS-EXECUÇÃO:
// 1. Verificar se TODOS os registros retornados estão dentro do período solicitado
// 2. Se houver registros fora do período → REJEITAR e re-executar com filtro correto
// 3. Calcular missing_days → dias no período com zero registros (informar, não esconder)
// 4. Gerar summary_for_model com: "Encontrados X registros de DD/MM a DD/MM. Dias sem dados: [lista]"
```

**Integração com execute_sql:** Wrappear a tool atual:

```typescript
// ANTES (tools.ts):
// execute_sql recebe SQL bruto e retorna resultado

// DEPOIS:
// 1. Receber SQL + temporalAnchor do state
// 2. pre_validate → corrigir se necessário
// 3. Executar query
// 4. post_validate → verificar resultados
// 5. Retornar resultado + validation_summary
// 6. Se post_validate falhar → retry com SQL corrigido (máx 2 retries)
```

---

### 3.4 CAMADA 4: Sistema de Prompt com Framework CO-STAR + Chain of Verification

**Arquivo:** `src/ai/clara/system_prompt.ts` (REESCRITA COMPLETA)

Usando os frameworks de prompt engineering CO-STAR e Chain of Verification para máxima precisão.

```typescript
// SPEC: Novo CLARA_SYSTEM_PROMPT com framework CO-STAR

export function buildClaraSystemPrompt(config: {
  company: string;
  rules: string;
  voiceRules: string;
  chatId: number;
  userRole: string;
  temporalAnchor: TemporalAnchor | null;
  dbStats: { totalChats: number; totalMessages: number; lastActivity: string } | null;
}): string {

return `
## CONTEXT (Quem você é)
Você é a Clara, assistente de IA da Clínica Aliança - setor Pediatria. Age como colega de trabalho inteligente, proativa e direta. Chama o Brendo pelo nome.

## OBJECTIVE (Sua missão)
Responder com PRECISÃO MILIMÉTRICA usando APENAS dados verificados do banco de dados. Você NUNCA inventa, deduz ou fabrica dados.

## STYLE (Como se comunica)
- Informal mas competente, direto ao ponto
- Respostas curtas para perguntas simples, longas só quando a complexidade exige
- Markdown elegante no chat interno
- Quando usar dados, SEMPRE citar o período exato: "No período de DD/MM a DD/MM..."

## TONE (Tom)
Parceira estratégica, não robô. Confiante quando tem dados, transparente quando não tem.

## AUDIENCE (Para quem fala)
Brendo (CEO/Admin) e equipe da clínica. Nível: executivo que quer dados concretos, não explicações técnicas.

## RESPONSE FORMAT (Como estruturar)
Para DADOS/RELATÓRIOS:
1. Começar com o período analisado: "📅 Período: DD/MM a DD/MM"
2. Dados em tabela ou bullet points concisos
3. Insight acionável ao final
4. Se citando chats: [[chat:ID|Nome (Telefone)]]

Para CONVERSAS SIMPLES: resposta direta sem formatação desnecessária.

═══════════════════════════════════════════════════
REGRAS DE PRECISÃO TEMPORAL (INQUEBRÁVEIS)
═══════════════════════════════════════════════════

ÂNCORA TEMPORAL DA SESSÃO:
- Agora em BRT: ${config.temporalAnchor?.now_brt || 'N/A'}
- Timezone: America/Sao_Paulo (BRT = UTC-3)
${config.temporalAnchor ? `- Período solicitado: ${config.temporalAnchor.period_label}
- Início: ${config.temporalAnchor.start_brt}
- Fim: ${config.temporalAnchor.end_brt}
- Tipo de intenção: ${config.temporalAnchor.intent_type}` : '- Nenhum período específico detectado. Se o usuário pedir dados, pergunte o período OU use últimos 7 dias.'}
${config.temporalAnchor?.comparison_period ? `
PERÍODO DE COMPARAÇÃO (calculado automaticamente):
- ${config.temporalAnchor.comparison_period.label}
- Início: ${config.temporalAnchor.comparison_period.start_brt}
- Fim: ${config.temporalAnchor.comparison_period.end_brt}
USE este período para comparações. NÃO calcule datas de comparação por conta própria.` : ''}

REGRA 1 — SEMPRE USE A ÂNCORA TEMPORAL
Quando o usuário perguntar sobre um período, SEMPRE use os timestamps da âncora acima. Não calcule datas por conta própria.

REGRA 2 — SEMPRE DECLARE O PERÍODO NA RESPOSTA
Toda resposta com dados DEVE começar com: "📅 Período analisado: [start] a [end]"
Isso permite ao usuário verificar se o período está correto.

REGRA 3 — ZERO É UM DADO VÁLIDO
Se um dia/período não tem registros, reporte "0" explicitamente. Nunca omita dias com zero.

REGRA 4 — NUNCA EXPANDA O PERÍODO SILENCIOSAMENTE
Se o período solicitado não tem dados, INFORME: "Não encontrei dados no período DD/MM a DD/MM. Deseja expandir para um período maior?"
NUNCA busque um período maior automaticamente sem avisar.

REGRA 5 — VALIDAÇÃO CRUZADA
Quando retornar dados, faça a verificação mental:
- A soma dos dias confere com o total?
- O período retornado é exatamente o solicitado?
- Nenhum número foi inventado?

REGRA 6 — EM DÚVIDA, PERGUNTE
Se a pergunta é ambígua (sem período claro, sem escopo definido), use a ferramenta ask_user_question para pedir clarificação. NUNCA adivinhe o que o usuário quer.

═══════════════════════════════════════════════════
ESTADO ATUAL DO BANCO (snapshot real)
═══════════════════════════════════════════════════
${config.dbStats ? `- Total de chats: ${config.dbStats.totalChats}
- Total de mensagens: ${config.dbStats.totalMessages}
- Última atividade: ${config.dbStats.lastActivity}
- ATENÇÃO: 100% dos chats estão com stage='new' e ai_sentiment='neutral' (valores default, não analisados). Não reporte esses campos como dados reais.
- ATENÇÃO: chat_insights cobre até 02/03/2026. Para dados mais recentes, use queries diretas em chat_messages.` : 'Stats não disponíveis.'}

═══════════════════════════════════════════════════
FERRAMENTAS (ordem de prioridade + instruções de uso)
═══════════════════════════════════════════════════

1. **ask_user_question(question, suggestions)** ⭐ NOVA
   QUANDO: Pergunta ambígua, sem período claro, múltiplas interpretações possíveis
   REGRA: PREFIRA perguntar a adivinhar. Errar é pior que perguntar.
   Fornece sugestões clicáveis + opção de texto livre.

2. **get_volume_metrics(start_date, end_date)**
   QUANDO: volume de conversas, mensagens, picos
   FORMATO: YYYY-MM-DD (sem hora — a ferramenta resolve BRT internamente)
   VALIDAÇÃO: Conferir se todos os dias do período aparecem no resultado

3. **execute_sql(sql)**
   QUANDO: qualquer consulta customizada
   REGRAS OBRIGATÓRIAS do SQL:
   - Datas SEMPRE com offset BRT: '2026-03-09T00:00:00-03:00'::timestamptz
   - Agrupar por dia: DATE(campo AT TIME ZONE 'America/Sao_Paulo')
   - LIMIT 500 (máximo)
   - Usar a âncora temporal: WHERE campo >= ${config.temporalAnchor?.sql_start || "'precisa_de_data'"} AND campo < ${config.temporalAnchor?.sql_end || "'precisa_de_data'"}

4. **analyze_raw_conversations(start_date, end_date, analysis_goals)**
   QUANDO: análise qualitativa (objeções, padrões, script, sentimento)
   Lê TODAS as mensagens brutas e analisa com IA. Direto na fonte.
   ⚠️ IMPORTANTE: Pode receber MÚLTIPLOS goals numa única chamada (mais eficiente).
   Retorna análise com citações verificáveis [[chat:ID|Nome]].

5. **update_chat_classification(chat_id, stage, sentiment)**
   QUANDO: reclassificar um chat com base em análise real
   Apenas UM chat por vez, com valores validados.

6. **get_filtered_chats_list(filters)**
   QUANDO: listar chats com filtros específicos
   LIMITE: máx 100 resultados

7. **get_chat_cascade_history(chat_id)**
   QUANDO: ler histórico completo de UM chat específico

8. **save_report(titulo, conteudo, tipo)**
   QUANDO: SOMENTE quando o usuário pedir explicitamente para salvar

BUSCAR CHAT POR NOME: execute_sql("SELECT id, contact_name, phone FROM chats WHERE contact_name ILIKE '%nome%' LIMIT 5")
SECRETÁRIA = sender 'HUMAN_AGENT' em chat_messages
BOT/CLARA = sender 'AI_AGENT'
PACIENTE = sender 'CUSTOMER' ou 'contact'

REGRA DE ESCOLHA:
- Pergunta QUANTITATIVA (quantos, volume, contagem) → get_volume_metrics ou execute_sql
- Pergunta QUALITATIVA (objeções, padrões, sentimento, script) → analyze_raw_conversations
- Pergunta sobre UM chat específico → get_chat_cascade_history
- Pergunta AMBÍGUA (sem escopo/período claro) → ask_user_question PRIMEIRO
- Dúvida? → execute_sql para números, analyze_raw_conversations para conteúdo

═══════════════════════════════════════════════════
CHAIN OF VERIFICATION (antes de responder)
═══════════════════════════════════════════════════

Antes de enviar sua resposta final, VERIFIQUE mentalmente:
□ O período que reportei é EXATAMENTE o que foi pedido?
□ Os números que cito vieram de ferramentas (não inventei)?
□ Se cito nomes de pacientes, eles vieram de queries reais?
□ A soma dos parciais confere com o total?
□ Não misturei dados do chat do paciente com dados globais?
□ Se citei trechos de conversas, eles foram verificados pelo spot-check?

Se qualquer verificação falhar → corrija antes de responder.

═══════════════════════════════════════════════════
EMPRESA E REGRAS DINÂMICAS
═══════════════════════════════════════════════════
${config.company}

${config.rules || 'Nenhuma regra extra.'}

${config.voiceRules || ''}

SESSÃO: Chat ${config.chatId} | Usuário: ${config.userRole}
`;
}
```

---

### 3.5 CAMADA 5: Sistema de Memória Híbrido — load_context_node (NOVO + MODIFICAÇÃO)

**Arquivos:**
- `src/ai/clara/load_context.ts` (NOVO)
- `src/ai/clara/graph.ts` (MODIFICAÇÃO — novo nó no grafo)
- `src/ai/clara/tools.ts` (MODIFICAÇÃO — manter tool para salvar/consultar explícito)

**Problema atual:**
A memória da Clara (`clara_memories`, 563 registros com embeddings) funciona 100% como tool — o modelo Gemini precisa *decidir* chamá-la. Na prática ele raramente chama, então a Clara "esquece" aprendizados passados. No n8n, a memória era carregada automaticamente no início do fluxo. Além disso, `chat_notes` (notas por chat) também dependem do modelo querer chamar — o contexto específico de um paciente pode ser ignorado.

**Solução: Abordagem Híbrida (Opção C)**

Três camadas com estratégias diferentes:

| Camada | Dado | Estratégia | Quando |
|--------|------|------------|--------|
| **Brain files** (`agent_config`) | Company, rules, voice | Injeção direta no prompt | Sempre (como já funciona) |
| **Memória de longo prazo** (`clara_memories`) | Aprendizados, padrões, regras de negócio | Auto-RAG: busca semântica automática | Início de cada interação |
| **Chat notes** (`chat_notes`) | Notas específicas de cada conversa | Carregamento automático por chat_id | Quando em contexto de um chat |
| **Tool de memória** | Salvar novas memórias + consultas explícitas | Mantém como tool chamável | Sob demanda do modelo |

**Arquivo:** `src/ai/clara/load_context.ts`

```typescript
// SPEC: load_context.ts — Carregamento automático de contexto/memória

import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

interface LoadedContext {
  // Memórias relevantes à pergunta (via vector search)
  relevant_memories: string[];    // Top 5 memórias mais similares à mensagem do usuário

  // Notas do chat atual (se aplicável)
  chat_notes: string | null;      // Notas salvas para este chat_id específico

  // Knowledge base relevante
  relevant_knowledge: string[];   // Gabaritos/templates relevantes

  // Metadata para o prompt
  memory_count: number;           // Total de memórias no banco
  last_memory_date: string;       // Data da última memória salva
}

/**
 * Carrega contexto automaticamente ANTES do classify_node.
 * Executa em paralelo para minimizar latência (~300-500ms total).
 */
export async function loadContextForInteraction(
  userMessage: string,
  chatId: number
): Promise<LoadedContext> {
  const supabase = getSupabaseAdminClient();
  const embeddings = new GoogleGenerativeAIEmbeddings({
    modelName: "text-embedding-004",
  });

  // Executar TUDO em paralelo
  const [memoriesResult, chatNotesResult, knowledgeResult, statsResult] =
    await Promise.allSettled([

      // 1. AUTO-RAG: Busca semântica na clara_memories usando a mensagem do usuário
      (async () => {
        const queryEmbedding = await embeddings.embedQuery(userMessage);
        const { data } = await supabase.rpc("match_memories", {
          query_embedding: `[${queryEmbedding.join(",")}]`,
          match_threshold: 0.65, // Threshold mais baixo que o upsert (0.85)
          match_count: 5,
        });
        return (data || []).map((m: any) => m.content);
      })(),

      // 2. Chat notes do chat atual
      (async () => {
        if (!chatId || chatId === 0) return null;
        const { data } = await supabase
          .from("chat_notes")
          .select("notes")
          .eq("chat_id", chatId)
          .maybeSingle();
        return data?.notes || null;
      })(),

      // 3. Knowledge base relevante (busca por texto simples — rápido)
      (async () => {
        // Extrair palavras-chave da mensagem para busca
        const keywords = userMessage
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 3)
          .slice(0, 3);

        if (keywords.length === 0) return [];

        const { data } = await supabase
          .from("knowledge_base")
          .select("content, category")
          .or(keywords.map(k => `content.ilike.%${k}%`).join(","))
          .limit(3);
        return (data || []).map((k: any) => `[${k.category}] ${k.content}`);
      })(),

      // 4. Stats da memória (para o prompt saber o estado)
      (async () => {
        const { count } = await supabase
          .from("clara_memories")
          .select("*", { count: "exact", head: true });
        const { data: latest } = await supabase
          .from("clara_memories")
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1);
        return {
          count: count || 0,
          last_date: latest?.[0]?.updated_at || "N/A",
        };
      })(),
    ]);

  return {
    relevant_memories: memoriesResult.status === "fulfilled" ? memoriesResult.value : [],
    chat_notes: chatNotesResult.status === "fulfilled" ? chatNotesResult.value : null,
    relevant_knowledge: knowledgeResult.status === "fulfilled" ? knowledgeResult.value : [],
    memory_count: statsResult.status === "fulfilled" ? (statsResult.value as any).count : 0,
    last_memory_date: statsResult.status === "fulfilled" ? (statsResult.value as any).last_date : "N/A",
  };
}
```

**Integração no graph.ts — Novo nó `load_context_node`:**

```typescript
// SPEC: Adicionar ao graph.ts ANTES do classify_node

// Adicionar ao ClaraState:
// loaded_context: LoadedContext | null;

claraWorkflow.addNode("load_context_node", async (state: ClaraState) => {
  const lastMessage = state.messages[state.messages.length - 1];
  const userText = typeof lastMessage?.content === "string"
    ? lastMessage.content
    : "";

  const context = await loadContextForInteraction(userText, state.chat_id);

  return { loaded_context: context };
});

// EDGES: Mudar START → load_context_node → classify_node (em vez de START → classify_node)
claraWorkflow.addEdge(START, "load_context_node");
claraWorkflow.addEdge("load_context_node", "classify_node");
// REMOVER: claraWorkflow.addEdge(START, "classify_node");
```

**Injeção no System Prompt — Novo bloco no `buildClaraSystemPrompt`:**

```typescript
// SPEC: Adicionar ao final do buildClaraSystemPrompt, antes da linha "SESSÃO:"

// Receber loaded_context como parâmetro adicional do buildClaraSystemPrompt
// config.loadedContext: LoadedContext | null

const memoryBlock = config.loadedContext ? `
═══════════════════════════════════════════════════
MEMÓRIA DA CLARA (carregada automaticamente)
═══════════════════════════════════════════════════

<relevant_memories>
${config.loadedContext.relevant_memories.length > 0
  ? config.loadedContext.relevant_memories.map((m, i) => `${i + 1}. ${m}`).join("\n")
  : "Nenhuma memória relevante para esta pergunta."}
</relevant_memories>

${config.loadedContext.chat_notes ? `<chat_notes chat_id="${config.chatId}">
${config.loadedContext.chat_notes}
</chat_notes>` : ""}

${config.loadedContext.relevant_knowledge.length > 0 ? `<knowledge_base>
${config.loadedContext.relevant_knowledge.join("\n")}
</knowledge_base>` : ""}

Total de memórias no banco: ${config.loadedContext.memory_count} | Última atualização: ${config.loadedContext.last_memory_date}

REGRAS DE USO DA MEMÓRIA:
- Use <relevant_memories> para contextualizar sua resposta quando relevante
- Use <chat_notes> para entender o histórico deste chat específico
- Use <knowledge_base> para referência de gabaritos/templates aprovados
- Para SALVAR nova memória: use a tool manage_long_term_memory(action="salvar")
- Para CONSULTAR memórias específicas: use a tool manage_long_term_memory(action="consultar")
- NUNCA invente memórias que não estão listadas acima
` : "";

// Inserir memoryBlock no prompt final, antes de "SESSÃO:"
```

**Manter a tool `manage_long_term_memory` para:**
- **Salvar** novas memórias (quando o admin ensina algo novo à Clara)
- **Consultar explicitamente** ("o que você aprendeu sobre X?" — busca com threshold mais amplo)
- A tool continua funcionando exatamente como está, sem alteração

**Novo evento de streaming para o frontend:**

```typescript
// Emitir no route.ts quando load_context_node executar:
{ type: "ui_log", subtype: "memory", content: "💭 Carregando memória... (5 memórias relevantes, notas do chat)" }
```

**Performance:**
- `loadContextForInteraction` executa 4 queries em paralelo via `Promise.allSettled`
- Tempo estimado: 300-500ms (embedding + 3 queries Supabase)
- Nunca bloqueia — se qualquer query falhar, retorna array vazio (graceful degradation)
- Embedding é gerado 1 vez por interação (reutilizado na busca de memórias)

**Resumo do fluxo com memória:**
```
User message
  → load_context_node (auto-RAG: memories + chat_notes + knowledge) [~400ms]
  → classify_node (com memória já no state)
  → simple_agent / research_pipeline (prompt inclui <relevant_memories>)
  → Se o admin ensina algo → Clara chama tool manage_long_term_memory para SALVAR
  → Resposta ao usuário
```

---

### 3.6 CAMADA 6: Progressive Streaming com Log Detalhado (MODIFICAÇÃO)

**Arquivo:** `src/app/api/ai/copilot/chat/route.ts`

**Objetivo:** O frontend mostra cada passo COM dados reais, igual ao Cowork mode do Claude.

**Novos tipos de eventos de streaming:**

```typescript
// SPEC: Novos eventos de streaming

// Evento: Âncora temporal resolvida
{ type: "ui_log", subtype: "temporal", content: "📅 Período resolvido: 03/03 a 09/03/2026 (esta semana)" }

// Evento: Comparação detectada
{ type: "ui_log", subtype: "temporal", content: "📅 Comparação: mesmo período do mês anterior (01/02 a 09/02)" }

// Evento: Classificação da pergunta
{ type: "ui_log", subtype: "classify", content: "🧠 Pergunta classificada como: análise global comparativa" }

// Evento: Query sendo executada (com preview seguro)
{ type: "ui_log", subtype: "query_start", content: "🔍 Consultando mensagens de 03/03 a 09/03...", metadata: { table: "chat_messages", period: "03/03-09/03" } }

// Evento: Query concluída com stats
{ type: "ui_log", subtype: "query_result", content: "✅ Encontrados 1.887 mensagens em 7 dias", metadata: { rows: 1887, period: "03/03-09/03" } }

// Evento: Validação de resultado
{ type: "ui_log", subtype: "validation", content: "✓ Dados verificados: período correto, sem registros fora do range" }

// Evento: Spot-check de citações (FIX BRECHA 1)
{ type: "ui_log", subtype: "spot_check", content: "🔎 Verificando 3 citações do relatório... ✓ Todas confirmadas" }

// Evento: Pesquisa profunda (research)
{ type: "ui_log", subtype: "research_step", content: "📊 Pesquisador 1/3: Analisando volume de mensagens...", metadata: { step: 1, total: 3 } }

// Evento: Erro recuperável
{ type: "ui_log", subtype: "retry", content: "⚠️ Query retornou dados fora do período. Corrigindo e re-executando..." }

// ══════════════════════════════════════════════════
// NOVO: Evento de pergunta interativa (Camada 10)
// ══════════════════════════════════════════════════
{ type: "interactive_question", content: "...", metadata: { question_id, suggestions, allow_free_text } }

// Texto da resposta (já existe)
{ type: "chunk", content: "..." }
```

**Implementação no route.ts:**

```typescript
// SPEC: Pontos de emissão de novos eventos

// 1. ANTES do claraGraph.streamEvents — emitir temporal anchor
if (temporalAnchor) {
  enqueue({ type: "ui_log", subtype: "temporal", content: `📅 ${temporalAnchor.period_label}` });
  if (temporalAnchor.comparison_period) {
    enqueue({ type: "ui_log", subtype: "temporal", content: `📅 Comparação: ${temporalAnchor.comparison_period.label}` });
  }
}

// 2. Em on_tool_start — emitir com mais detalhes
if (event.event === "on_tool_start") {
  const toolName = event.name;
  const toolInput = event.data?.input; // Pegar os parâmetros da ferramenta

  // Construir label contextual baseado na ferramenta + parâmetros
  const label = buildToolLabel(toolName, toolInput);
  enqueue({ type: "ui_log", subtype: "query_start", content: label });
}

// 3. Em on_tool_end — emitir resultado resumido
if (event.event === "on_tool_end") {
  const toolName = event.name;
  const toolOutput = event.data?.output;

  const summary = buildToolResultSummary(toolName, toolOutput);
  enqueue({ type: "ui_log", subtype: "query_result", content: summary });
}
```

---

### 3.7 CAMADA 7: Frontend — Live Progress Dashboard + Interactive Questions (NOVO)

**Arquivo:** `src/components/clara/ClaraProgressPanel.tsx` (NOVO)

**Objetivo:** Componente que mostra os logs de progresso da Clara em tempo real + perguntas interativas.

```tsx
// SPEC: ClaraProgressPanel.tsx

interface ProgressEvent {
  type: "temporal" | "classify" | "query_start" | "query_result" | "validation" | "research_step" | "retry" | "error" | "spot_check";
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  status: "active" | "done" | "error";
}

// Componente mostra:
// 1. Lista vertical de etapas com ícones animados
// 2. Etapa ativa tem spinner/pulse
// 3. Etapas concluídas têm ✓ verde
// 4. Cada etapa mostra timestamp e detalhes expandíveis
// 5. Em caso de retry, mostra ⚠️ amarelo com motivo
// 6. Spot-check: mostra quais citações foram verificadas

// Visual:
// ┌─────────────────────────────────────┐
// │ 📅 Período: 03/03 a 09/03      ✓  │
// │ 🧠 Classificação: análise global ✓ │
// │ 🔍 Consultando chat_messages...  ⟳ │  ← spinner ativo
// │                                     │
// │ Clara está trabalhando...           │
// └─────────────────────────────────────┘

// REGRAS DE UX:
// - Aparecer ACIMA da área de resposta da Clara
// - Colapsar automaticamente quando a resposta começar a streamer
// - Poder expandir/colapsar manualmente
// - Manter histórico de logs da sessão (não apagar ao colapsar)
```

**Atualização no ClaraStatusIndicator.tsx existente:**

Substituir os labels estáticos por labels dinâmicos baseados nos novos eventos de streaming.

---

### 3.8 CAMADA 8: Análise Direta na Fonte — `raw_data_analyzer` (NOVO — SUBSTITUI `gerar_relatorio_qualidade_chats`)

**Arquivo:** `src/ai/clara/raw_data_analyzer.ts` (NOVO)
**Arquivo:** `src/ai/clara/tools.ts` (MODIFICAÇÃO — remover gerar_relatorio, adicionar nova tool)

**Decisão Arquitetural: Por que ir direto na fonte e não depender de `chat_insights`**

Dados reais do banco (medidos em 09/03/2026):
- Total de mensagens: 4.691 (~99.000 tokens)
- Context window do Gemini Flash: 1.000.000 tokens
- **TODO o histórico da clínica ocupa 9.9% do contexto do Gemini**
- Mesmo carregando 3 meses de conversas brutas, sobra 90% do contexto para raciocínio

Isso significa que a Clara pode ler TODAS as mensagens brutas de qualquer período e analisar diretamente, sem depender de resumos pré-processados. A tabela `chat_insights` se torna um **cache opcional** — útil para consultas instantâneas, mas nunca mais a fonte de verdade.

**Benefícios:**
- Qualquer pergunta pode ser respondida, não só as que o `chatAnalyzerGraph` previu
- Precisão de 100% nos dados — não há resumo intermediário que pode perder informação
- Sem dependência de cron jobs para manter tabelas atualizadas
- Clara pode responder perguntas que nunca foram previstas ("em quantas conversas a secretária ofereceu desconto?")

**Nova tool: `analyze_raw_conversations`**

```typescript
// SPEC: raw_data_analyzer.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";

interface RawAnalysisResult {
  period: { start: string; end: string; label: string };
  total_chats_analyzed: number;
  total_messages_read: number;
  tokens_used_approx: number;
  analysis: string;           // Análise completa gerada pelo modelo
  method: "single_pass" | "chunked_map_reduce";
  citations_for_spot_check: string[];  // FIX BRECHA 1: citações extraídas para verificação
}

/**
 * ESTRATÉGIA ADAPTATIVA:
 *
 * Volume ≤ 200.000 tokens (~6.000 msgs) → SINGLE PASS
 *   Carrega TUDO no contexto do Gemini Flash (1M tokens) e analisa de uma vez.
 *   Precisão máxima — modelo vê todas as conversas de uma vez.
 *
 * Volume > 200.000 tokens → CHUNKED MAP-REDUCE
 *   FIX BRECHA 4: Divide POR CHAT_ID (não cronológico) para manter conversas inteiras juntas.
 *   MAP: Cada chunk é analisado individualmente com o objetivo da análise.
 *   REDUCE: Resultados dos chunks são consolidados em resposta final.
 *   Precisão mantida — cada conversa é analisada completamente.
 *
 * Na escala atual da clínica (~99K tokens total), SEMPRE será single pass.
 * O map-reduce é futureproofing para quando crescer.
 *
 * FIX BRECHA 7: Aceita MÚLTIPLOS analysis_goals numa única chamada.
 * Carrega as mensagens UMA vez e analisa todos os goals de uma vez.
 */

export const analyzeRawConversationsTool = new DynamicStructuredTool({
  name: "analyze_raw_conversations",
  description: `Lê e analisa as mensagens BRUTAS diretamente da tabela chat_messages.
Use esta ferramenta para QUALQUER análise qualitativa: objeções, padrões de atendimento,
script da secretária, sentimento dos pacientes, gargalos, etc.
NÃO depende de tabelas intermediárias — vai direto na fonte.
Pode analisar TODO o histórico ou um período específico.
ACEITA MÚLTIPLOS OBJETIVOS numa única chamada (mais eficiente que chamar várias vezes).
Retorna análise estruturada com citações reais das conversas.`,

  schema: z.object({
    start_date: z.string().describe("Data início YYYY-MM-DD (BRT). Ex: '2025-12-09'"),
    end_date: z.string().describe("Data fim YYYY-MM-DD (BRT). Ex: '2026-03-09'"),
    analysis_goals: z.array(z.string()).describe(
      "Lista de objetivos de análise. Pode ser 1 ou mais. Ex: ['Identificar as 5 objeções mais frequentes', 'Analisar padrão de atendimento da secretária', 'Identificar gargalos no fluxo']"
    ),
    sender_filter: z.enum(["ALL", "CUSTOMER", "HUMAN_AGENT", "AI_AGENT"]).optional()
      .describe("Filtrar por tipo de remetente. CUSTOMER=pacientes, HUMAN_AGENT=secretária, AI_AGENT=bot. Default: ALL"),
    include_metadata: z.boolean().optional().default(true)
      .describe("Incluir nome do contato e chat_id para referência cruzada"),
  }),

  func: async ({ start_date, end_date, analysis_goals, sender_filter, include_metadata }) => {
    const supabase = getSupabaseAdminClient();

    const startTs = `${start_date}T00:00:00-03:00`;
    const endTs = `${end_date}T23:59:59.999-03:00`;

    // ── PASSO 1: Carregar mensagens brutas com paginação completa ──

    let allMessages: any[] = [];
    let offset = 0;
    const BATCH = 1000;

    while (true) {
      let query = supabase
        .from("chat_messages")
        .select("id, chat_id, sender, message_text, created_at")
        .gte("created_at", startTs)
        .lte("created_at", endTs)
        .not("message_text", "is", null)
        .order("created_at", { ascending: true })
        .range(offset, offset + BATCH - 1);

      if (sender_filter && sender_filter !== "ALL") {
        query = query.eq("sender", sender_filter);
      }

      const { data, error } = await query;
      if (error) return `Erro ao buscar mensagens: ${error.message}`;
      if (!data || data.length === 0) break;

      allMessages = allMessages.concat(data);
      if (data.length < BATCH) break;
      offset += BATCH;
    }

    if (allMessages.length === 0) {
      return `Nenhuma mensagem encontrada no período ${start_date} a ${end_date}` +
        (sender_filter && sender_filter !== "ALL" ? ` com filtro sender=${sender_filter}` : "") +
        ". Verifique se as datas estão corretas.";
    }

    // ── PASSO 2: Enriquecer com nomes dos chats (se solicitado) ──

    let chatNames: Record<number, string> = {};
    if (include_metadata) {
      const chatIds = [...new Set(allMessages.map(m => m.chat_id))];
      // Buscar em batches de 100 IDs
      for (let i = 0; i < chatIds.length; i += 100) {
        const batch = chatIds.slice(i, i + 100);
        const { data } = await supabase
          .from("chats")
          .select("id, contact_name, phone")
          .in("id", batch);
        if (data) {
          data.forEach((c: any) => {
            chatNames[c.id] = `${c.contact_name || 'Sem nome'} (${c.phone || 'sem tel'})`;
          });
        }
      }
    }

    // ── PASSO 3: Formatar como transcrição estruturada ──

    const formatMessage = (m: any) => {
      const date = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const senderLabel = m.sender === "HUMAN_AGENT" ? "SECRETÁRIA"
        : m.sender === "CUSTOMER" ? "PACIENTE"
        : m.sender === "contact" ? "PACIENTE"
        : "BOT";
      const chatRef = include_metadata ? ` [[chat:${m.chat_id}|${chatNames[m.chat_id] || m.chat_id}]]` : "";
      return `[${date}] ${senderLabel}${chatRef}: ${m.message_text}`;
    };

    // ── PASSO 4: Decidir estratégia (single pass vs map-reduce) ──

    const totalChars = allMessages.reduce((sum, m) => sum + (m.message_text?.length || 0), 0);
    const approxTokens = Math.ceil(totalChars / 3);

    const SINGLE_PASS_LIMIT = 200_000; // tokens

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash-preview-05-20",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      temperature: 0.1, // Baixa — queremos precisão, não criatividade
    });

    // FIX BRECHA 7: Múltiplos goals numa única chamada
    const goalsFormatted = analysis_goals.map((g, i) => `OBJETIVO ${i + 1}: ${g}`).join("\n");

    const ANALYSIS_PROMPT = `Você é uma analista de dados especializada em atendimento médico.

OBJETIVOS DA ANÁLISE:
${goalsFormatted}

REGRAS ABSOLUTAS:
1. Use APENAS os dados fornecidos abaixo. NÃO invente nenhuma informação.
2. Cite mensagens reais como evidência (copie o trecho exato entre aspas).
3. Preserve os links de chat no formato [[chat:ID|Nome]] quando citar.
4. Quantifique tudo: "X de Y conversas mencionaram...", "encontrado em N chats..."
5. Se não encontrar dados suficientes para responder a um objetivo, diga claramente.
6. Organize a análise com seções claras em Markdown, UMA SEÇÃO POR OBJETIVO.
7. Inclua ao final uma seção "📊 Resumo Quantitativo" com os números principais.
8. OBRIGATÓRIO: Ao final, inclua uma seção "🔍 CITAÇÕES PARA VERIFICAÇÃO" com exatamente 5 citações
   no formato: [chat_id]|[trecho exato da mensagem]|[sender]
   Isso será usado para spot-check de integridade.

PERÍODO: ${start_date} a ${end_date}
TOTAL DE MENSAGENS: ${allMessages.length}
TOTAL DE CHATS ÚNICOS: ${new Set(allMessages.map(m => m.chat_id)).size}
`;

    let analysisResult: string;
    let method: "single_pass" | "chunked_map_reduce";

    if (approxTokens <= SINGLE_PASS_LIMIT) {
      // ── SINGLE PASS: Tudo no contexto ──
      method = "single_pass";
      const transcript = allMessages.map(formatMessage).join("\n");

      const response = await model.invoke([
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: `TRANSCRIÇÃO COMPLETA (${allMessages.length} mensagens):\n\n${transcript}\n\nAnalise conforme os objetivos.` },
      ]);
      analysisResult = typeof response.content === "string" ? response.content : "";

    } else {
      // ── MAP-REDUCE: Dividir por chat_id (FIX BRECHA 4) ──
      method = "chunked_map_reduce";
      const CHUNK_TOKEN_LIMIT = 150_000;
      const CHARS_PER_CHUNK = CHUNK_TOKEN_LIMIT * 3;

      // Agrupar mensagens por chat_id para manter conversas inteiras
      const messagesByChat: Record<number, any[]> = {};
      for (const msg of allMessages) {
        if (!messagesByChat[msg.chat_id]) messagesByChat[msg.chat_id] = [];
        messagesByChat[msg.chat_id].push(msg);
      }

      // Montar chunks respeitando limites, sem quebrar conversas
      const chunks: any[][] = [];
      let currentChunk: any[] = [];
      let currentChars = 0;

      for (const chatId of Object.keys(messagesByChat).map(Number)) {
        const chatMsgs = messagesByChat[chatId];
        const chatChars = chatMsgs.reduce((sum, m) => sum + (m.message_text?.length || 0) + 80, 0);

        // Se esta conversa sozinha estoura o chunk, finaliza o atual e começa novo
        if (currentChars + chatChars > CHARS_PER_CHUNK && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentChars = 0;
        }

        // Adiciona todas as mensagens desta conversa ao chunk
        currentChunk = currentChunk.concat(chatMsgs);
        currentChars += chatChars;
      }
      if (currentChunk.length > 0) chunks.push(currentChunk);

      // MAP: Analisar cada chunk
      const chunkResults = await Promise.all(
        chunks.map(async (chunk, i) => {
          const transcript = chunk.map(formatMessage).join("\n");
          const uniqueChatsInChunk = new Set(chunk.map(m => m.chat_id)).size;
          const response = await model.invoke([
            { role: "system", content: ANALYSIS_PROMPT + `\n\nEste é o CHUNK ${i + 1} de ${chunks.length} (${uniqueChatsInChunk} conversas completas). Analise este trecho e retorne achados parciais.` },
            { role: "user", content: `TRANSCRIÇÃO (chunk ${i + 1}/${chunks.length}, ${chunk.length} msgs de ${uniqueChatsInChunk} conversas):\n\n${transcript}` },
          ]);
          return typeof response.content === "string" ? response.content : "";
        })
      );

      // REDUCE: Consolidar resultados
      const reduceResponse = await model.invoke([
        { role: "system", content: `Você é uma analista consolidando resultados de pesquisa.

OBJETIVOS ORIGINAIS:
${goalsFormatted}

PERÍODO: ${start_date} a ${end_date}
TOTAL ANALISADO: ${allMessages.length} mensagens em ${chunks.length} chunks

REGRAS:
1. Consolide os achados dos chunks em UMA análise coesa
2. Some quantidades, não duplique achados iguais
3. Preserve citações reais e links [[chat:ID|Nome]]
4. Mantenha UMA SEÇÃO POR OBJETIVO original
5. Mantenha a seção "📊 Resumo Quantitativo" com totais consolidados
6. Mantenha a seção "🔍 CITAÇÕES PARA VERIFICAÇÃO" com 5 citações mais representativas
7. NÃO invente dados que não estão nos chunks` },
        { role: "user", content: `RESULTADOS DOS ${chunks.length} CHUNKS:\n\n${chunkResults.map((r, i) => `=== CHUNK ${i + 1} ===\n${r}`).join("\n\n")}\n\nConsolide em uma análise final.` },
      ]);

      analysisResult = typeof reduceResponse.content === "string" ? reduceResponse.content : "";
    }

    // ── PASSO 5: Extrair citações para spot-check (FIX BRECHA 1) ──
    const citationRegex = /\[(\d+)\]\|(.+?)\|(\w+)/g;
    const citations: string[] = [];
    let match;
    while ((match = citationRegex.exec(analysisResult)) !== null) {
      citations.push(JSON.stringify({ chat_id: parseInt(match[1]), text: match[2], sender: match[3] }));
    }

    // ── PASSO 6: Retornar com metadata ──
    const uniqueChats = new Set(allMessages.map(m => m.chat_id)).size;

    return `📅 Período: ${start_date} a ${end_date}
📊 Base analisada: ${allMessages.length} mensagens brutas de ${uniqueChats} conversas
⚙️ Método: ${method === "single_pass" ? "Leitura completa (single pass)" : `Map-Reduce por conversa (${chunks?.length || '?'} chunks)`}
🔍 Tokens processados: ~${approxTokens.toLocaleString()}
🔎 Citações para spot-check: ${citations.length}

---

${analysisResult}

---
__SPOT_CHECK_DATA__: ${JSON.stringify(citations.slice(0, 5))}`;
  },
});
```

**O que acontece com `gerar_relatorio_qualidade_chats` e `deep_research_chats`?**

```
REMOVER do simpleAgentTools:
  - gerar_relatorio_qualidade_chats → substituída por analyze_raw_conversations
  - deep_research_chats → substituída por analyze_raw_conversations

ADICIONAR ao simpleAgentTools:
  - analyze_raw_conversations (nova tool acima)

A nova tool faz TUDO que as duas faziam, mas direto na fonte:
  - Objeções? → analyze_raw_conversations(goals=["identificar objeções"])
  - Script da secretária? → analyze_raw_conversations(sender_filter="HUMAN_AGENT", goals=["analisar padrão de atendimento"])
  - Gargalos? → analyze_raw_conversations(goals=["identificar gargalos de atendimento"])
  - Múltiplas análises? → analyze_raw_conversations(goals=["objeções", "script", "gargalos"]) ← UMA chamada
  - Qualquer coisa nova? → analyze_raw_conversations(goals=["o que o Brendo pediu"])
```

**O que acontece com a tabela `chat_insights`?**

```
NÃO DELETAR — mantém como cache/histórico.
O chatAnalyzerGraph continua existindo para:
  - Alimentar o copilot (sugestões automáticas de resposta por chat)
  - Histórico de análises passadas
  - Dashboard de métricas rápidas (se existir no frontend)

MAS: A Clara NUNCA mais usa chat_insights como fonte para relatórios.
Para relatórios, ela SEMPRE vai na fonte via analyze_raw_conversations.
```

---

### 3.9 CAMADA 9: Spot-Check Verifier — Verificação de Citações (NOVO — FIX BRECHA 1)

**Arquivo:** `src/ai/clara/spot_check_verifier.ts` (NOVO)

**Problema:** A `analyze_raw_conversations` chama Gemini *dentro* da tool. Se o inner model alucina uma citação ou objeção que não existe, Clara confia cegamente e repete como fato. A Chain of Verification só valida o output da Clara, não o output da inner call.

**Solução:** Após receber o resultado da `analyze_raw_conversations`, Clara faz spot-check de 3-5 citações via SQL direto — verificando se as mensagens citadas realmente existem no banco com o conteúdo descrito.

```typescript
// SPEC: spot_check_verifier.ts

interface SpotCheckResult {
  total_checked: number;
  confirmed: number;
  failed: number;
  details: {
    citation: { chat_id: number; text: string; sender: string };
    found: boolean;
    actual_text?: string;  // O que realmente está no banco (se diferente)
  }[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  // HIGH: 100% confirmadas
  // MEDIUM: 60-99% confirmadas (parcialmente confiável)
  // LOW: <60% confirmadas (análise não confiável, re-executar)
}

/**
 * Verifica citações extraídas do output de analyze_raw_conversations
 * contra os dados reais no banco de dados.
 *
 * Executa como nó do graph APÓS receber resultado da tool,
 * ANTES do final_report_node emitir a resposta.
 */
export async function spotCheckCitations(
  citations: Array<{ chat_id: number; text: string; sender: string }>,
  supabase: SupabaseClient
): Promise<SpotCheckResult> {

  // Pegar até 5 citações para verificar (balancear custo vs confiança)
  const toCheck = citations.slice(0, 5);
  const results: SpotCheckResult["details"] = [];

  for (const citation of toCheck) {
    // Buscar mensagem real no banco
    const { data } = await supabase
      .from("chat_messages")
      .select("message_text, sender")
      .eq("chat_id", citation.chat_id)
      .eq("sender", citation.sender)
      .ilike("message_text", `%${citation.text.slice(0, 50)}%`) // Busca parcial
      .limit(1);

    if (data && data.length > 0) {
      results.push({
        citation,
        found: true,
        actual_text: data[0].message_text,
      });
    } else {
      // Tentar busca mais ampla (só pelo chat_id e trecho)
      const { data: broader } = await supabase
        .from("chat_messages")
        .select("message_text, sender")
        .eq("chat_id", citation.chat_id)
        .ilike("message_text", `%${citation.text.slice(0, 30)}%`)
        .limit(1);

      results.push({
        citation,
        found: broader !== null && broader.length > 0,
        actual_text: broader?.[0]?.message_text,
      });
    }
  }

  const confirmed = results.filter(r => r.found).length;
  const total = results.length;
  const ratio = total > 0 ? confirmed / total : 0;

  return {
    total_checked: total,
    confirmed,
    failed: total - confirmed,
    details: results,
    confidence: ratio >= 1 ? "HIGH" : ratio >= 0.6 ? "MEDIUM" : "LOW",
  };
}
```

**Integração no graph.ts:**

```typescript
// SPEC: Novo nó spot_check_node no graph

claraWorkflow.addNode("spot_check_node", async (state: ClaraState) => {
  // Extrair citações do último tool output
  const lastToolOutput = getLastToolOutput(state, "analyze_raw_conversations");
  if (!lastToolOutput) return {}; // Sem análise para verificar

  const spotCheckData = extractSpotCheckData(lastToolOutput);
  if (spotCheckData.length === 0) return {}; // Sem citações

  const result = await spotCheckCitations(spotCheckData, supabase);

  // Se confiança BAIXA → emitir warning e solicitar re-análise
  if (result.confidence === "LOW") {
    return {
      spot_check_result: result,
      spot_check_warning: `⚠️ Spot-check falhou: ${result.failed}/${result.total_checked} citações não confirmadas. Considere re-executar a análise.`,
    };
  }

  return { spot_check_result: result };
});

// EDGE: Após research_supervisor → spot_check_node → final_report_node
// (apenas quando analyze_raw_conversations foi usado)
```

**No System Prompt, adicionar regra:**

```
REGRA 7 — VERIFICAÇÃO DE CITAÇÕES
Quando receber resultado de analyze_raw_conversations, SEMPRE verifique o spot-check:
- Se confidence = "HIGH": use os dados com confiança
- Se confidence = "MEDIUM": use os dados mas mencione "verificação parcial"
- Se confidence = "LOW": NÃO use os dados. Informe ao usuário que houve inconsistência e sugira reformular
```

---

### 3.10 CAMADA 10: Interactive Questions — Perguntas com Sugestões Clicáveis (NOVO)

**Arquivos:**
- `src/ai/clara/interactive_questions.ts` (NOVO — lógica backend)
- `src/ai/clara/tools.ts` (MODIFICAÇÃO — nova tool `ask_user_question`)
- `src/app/api/ai/copilot/chat/route.ts` (MODIFICAÇÃO — novo evento de streaming)
- `src/components/clara/ClaraInteractiveQuestion.tsx` (NOVO — componente frontend)
- `src/app/api/ai/copilot/answer/route.ts` (NOVO — endpoint para receber resposta)

**Conceito:** Inspirado no Claude Code e no Cowork mode, a Clara pode pausar a execução no meio do fluxo e fazer uma pergunta interativa ao usuário. A pergunta vem com sugestões clicáveis (botões) + opção de "Outro" que abre campo de texto livre. Quando o usuário responde, a Clara retoma de onde parou.

**Quando a Clara pergunta:**
1. **Ambiguidade temporal** — "me dá um relatório" → Clara pergunta qual período
2. **Escopo indefinido** — "como estão as coisas?" → Clara pergunta o quê especificamente
3. **Decisão de caminho** — múltiplas interpretações possíveis
4. **Confirmação antes de ação custosa** — análise que vai demorar >10s
5. **Sem dados no período** — em vez de expandir silenciosamente, pergunta

**Tool: `ask_user_question`**

```typescript
// SPEC: interactive_questions.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

interface InteractiveQuestion {
  question_id: string;          // UUID para tracking
  question: string;             // "Qual período você quer analisar?"
  suggestions: Array<{
    label: string;              // "Esta semana"
    value: string;              // "esta_semana"
    is_recommended: boolean;    // true → destaque visual (azul/bold)
    description?: string;       // "03/03 a 09/03 — 7 dias de dados"
  }>;
  allow_free_text: boolean;     // true → mostra botão "Outro" que abre input
  free_text_placeholder?: string; // "Digite o período desejado..."
  context?: string;             // Explicação adicional (opcional)
}

export const askUserQuestionTool = new DynamicStructuredTool({
  name: "ask_user_question",
  description: `Faz uma pergunta interativa ao usuário com sugestões clicáveis.
Use quando:
- A pergunta é ambígua (sem período, sem escopo claro)
- Existem múltiplas interpretações possíveis
- Precisa de confirmação antes de uma análise demorada
- O período pedido não tem dados e você quer sugerir alternativas

A pergunta aparece como um card interativo no chat com botões clicáveis.
Sempre inclua uma opção recomendada (is_recommended: true) com base no contexto.
SEMPRE inclua allow_free_text: true para o usuário poder digitar algo diferente.

IMPORTANTE: Após enviar a pergunta, PARE e aguarde a resposta do usuário.
Não continue a execução até receber a resposta.`,

  schema: z.object({
    question: z.string().describe("A pergunta para o usuário. Seja direto e conciso."),
    suggestions: z.array(z.object({
      label: z.string().describe("Texto curto do botão. Ex: 'Esta semana'"),
      value: z.string().describe("Valor técnico. Ex: 'esta_semana'"),
      is_recommended: z.boolean().describe("true para a opção que você recomenda"),
      description: z.string().optional().describe("Detalhe extra. Ex: '03/03 a 09/03'"),
    })).min(2).max(5).describe("2-5 sugestões clicáveis"),
    allow_free_text: z.boolean().default(true).describe("Permitir texto livre. SEMPRE true."),
    free_text_placeholder: z.string().optional().describe("Placeholder do campo de texto livre"),
    context: z.string().optional().describe("Explicação adicional se necessário"),
  }),

  func: async ({ question, suggestions, allow_free_text, free_text_placeholder, context }) => {
    // Esta tool NÃO executa diretamente — ela emite um evento de streaming
    // que o frontend renderiza como card interativo.
    // O graph PAUSA aqui e aguarda a resposta via /api/ai/copilot/answer

    const questionId = crypto.randomUUID();

    // O retorno é interceptado pelo route.ts e convertido em evento de streaming
    return JSON.stringify({
      __type: "interactive_question",
      question_id: questionId,
      question,
      suggestions,
      allow_free_text,
      free_text_placeholder: free_text_placeholder || "Digite sua resposta...",
      context,
    });
  },
});
```

**Evento de streaming no route.ts:**

```typescript
// SPEC: Interceptar output da tool ask_user_question e emitir evento especial

if (event.event === "on_tool_end" && event.name === "ask_user_question") {
  const toolOutput = event.data?.output;

  try {
    const parsed = JSON.parse(toolOutput);
    if (parsed.__type === "interactive_question") {
      // Emitir evento especial para o frontend
      enqueue({
        type: "interactive_question",
        content: parsed.question,
        metadata: {
          question_id: parsed.question_id,
          suggestions: parsed.suggestions,
          allow_free_text: parsed.allow_free_text,
          free_text_placeholder: parsed.free_text_placeholder,
          context: parsed.context,
        },
      });

      // Salvar estado do graph para retomar depois
      await saveGraphCheckpoint(state, parsed.question_id);

      // PARAR o streaming — aguardar resposta do usuário
      return; // O graph será retomado quando o endpoint /answer receber a resposta
    }
  } catch (e) {
    // Não é interactive question, continuar normalmente
  }
}
```

**Componente Frontend: `ClaraInteractiveQuestion.tsx`**

```tsx
// SPEC: ClaraInteractiveQuestion.tsx

interface InteractiveQuestionProps {
  questionId: string;
  question: string;
  suggestions: Array<{
    label: string;
    value: string;
    is_recommended: boolean;
    description?: string;
  }>;
  allowFreeText: boolean;
  freeTextPlaceholder?: string;
  context?: string;
  onAnswer: (questionId: string, answer: string) => void;
}

// VISUAL DO COMPONENTE:
//
// ┌──────────────────────────────────────────────────────┐
// │  🤔 Qual período você quer analisar?                │
// │                                                      │
// │  Encontrei dados desde 09/12/2025. Escolha:         │
// │                                                      │
// │  ┌─────────────────────────────────────────────┐    │
// │  │ ⭐ Esta semana (03/03 a 09/03)              │    │  ← botão RECOMENDADO (destaque)
// │  │    7 dias — dados mais recentes              │    │
// │  └─────────────────────────────────────────────┘    │
// │                                                      │
// │  ┌──────────────────┐ ┌──────────────────┐          │
// │  │ Este mês         │ │ Últimos 3 meses  │          │  ← botões normais
// │  └──────────────────┘ └──────────────────┘          │
// │                                                      │
// │  ┌──────────────────┐                               │
// │  │ Todo o histórico │                               │
// │  └──────────────────┘                               │
// │                                                      │
// │  ┌──────────────────────────────────────────────┐   │
// │  │ ✏️ Outro: [Digite o período desejado...    ] │   │  ← campo texto livre
// │  │           [Enviar →]                          │   │
// │  └──────────────────────────────────────────────┘   │
// └──────────────────────────────────────────────────────┘
//
// REGRAS DE UX:
// 1. O botão recomendado (is_recommended=true) aparece PRIMEIRO e com destaque visual:
//    - Borda mais grossa ou cor de destaque (ex: azul primário)
//    - Ícone de ⭐ ou ✨
//    - Descrição extra visível
// 2. Os outros botões aparecem em grid (2-3 por linha), menores
// 3. O campo "Outro" fica por último, colapsado por padrão
//    - Ao clicar em "Outro", expande um input de texto + botão "Enviar"
// 4. Ao clicar qualquer opção, o card se transforma em texto estático:
//    "✓ Brendo escolheu: Esta semana (03/03 a 09/03)"
// 5. Não é possível mudar a resposta depois de clicada
// 6. Cards de pergunta ficam no histórico do chat (não desaparecem)
// 7. Se o usuário digitar no input principal do chat em vez de clicar,
//    considerar como resposta ao interactive_question ativo

// IMPLEMENTAÇÃO:
// - Botão recomendado: bg-blue-500/10 border-blue-500 text-blue-700
// - Botões normais: bg-gray-100 border-gray-300 text-gray-700
// - Campo "Outro": bg-gray-50 com input de texto + botão
// - Após resposta: bg-green-50 com ✓ e texto da escolha
```

**Endpoint para receber resposta: `/api/ai/copilot/answer`**

```typescript
// SPEC: src/app/api/ai/copilot/answer/route.ts

// POST /api/ai/copilot/answer
// Body: { question_id: string, answer: string, chat_id: number }

export async function POST(req: Request) {
  const { question_id, answer, chat_id } = await req.json();

  // 1. Recuperar checkpoint do graph salvo quando a pergunta foi emitida
  const checkpoint = await loadGraphCheckpoint(question_id);
  if (!checkpoint) {
    return new Response(JSON.stringify({ error: "Question not found" }), { status: 404 });
  }

  // 2. Injetar a resposta do usuário como nova mensagem no state
  const updatedState = {
    ...checkpoint.state,
    messages: [
      ...checkpoint.state.messages,
      { role: "user", content: `[Resposta à pergunta "${checkpoint.question}"]: ${answer}` },
    ],
    // Se a resposta é uma seleção temporal, re-resolver o temporal anchor
    temporal_anchor: await maybeResolveFromAnswer(answer, checkpoint.state.temporal_anchor),
  };

  // 3. Retomar o graph de onde parou (stream a partir daqui)
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: any) => {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + "\n"));
      };

      // Retomar execução do graph
      for await (const event of claraGraph.streamEvents(updatedState, { version: "v2" })) {
        // ... mesmo handling de eventos do route.ts principal
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
```

**Checkpoint do graph (persistência para retomar):**

```typescript
// SPEC: Graph checkpoint para perguntas interativas

// Usando uma tabela simples no Supabase ou cache local (Redis/in-memory)
// para persistir o estado do graph enquanto aguarda resposta do usuário.

interface GraphCheckpoint {
  question_id: string;
  question: string;
  state: ClaraState;       // Estado completo do graph no momento da pausa
  node_name: string;       // Nó que emitiu a pergunta
  created_at: string;
  expires_at: string;      // TTL de 30 minutos (depois disso, descarta)
}

// Opção 1: In-memory (simples, perde em restart)
const checkpoints = new Map<string, GraphCheckpoint>();

// Opção 2: Supabase (persistente, sobrevive restart)
// Criar tabela: clara_graph_checkpoints (question_id PK, state JSONB, ...)

async function saveGraphCheckpoint(state: ClaraState, questionId: string) {
  checkpoints.set(questionId, {
    question_id: questionId,
    question: extractQuestionFromState(state),
    state,
    node_name: state.current_node || "unknown",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
}

async function loadGraphCheckpoint(questionId: string): Promise<GraphCheckpoint | null> {
  const checkpoint = checkpoints.get(questionId);
  if (!checkpoint) return null;
  if (new Date(checkpoint.expires_at) < new Date()) {
    checkpoints.delete(questionId);
    return null;
  }
  return checkpoint;
}
```

**Exemplos de perguntas interativas que a Clara faria:**

```
EXEMPLO 1 — Ambiguidade temporal:
User: "me dá um relatório dos atendimentos"
Clara detecta: intent_type = "ambiguous" (sem período, sem escopo claro)

→ ask_user_question({
    question: "Qual período você quer analisar?",
    suggestions: [
      { label: "Esta semana", value: "esta_semana", is_recommended: true, description: "03/03 a 09/03 — 272 mensagens" },
      { label: "Este mês", value: "este_mes", is_recommended: false, description: "01/03 a 09/03" },
      { label: "Últimos 30 dias", value: "30_dias", is_recommended: false },
      { label: "Todo o histórico", value: "tudo", is_recommended: false, description: "Desde 09/12/2025" },
    ],
    allow_free_text: true,
    free_text_placeholder: "Ex: 01/02 a 28/02",
    context: "Encontrei 4.691 mensagens de 237 conversas desde 09/12/2025."
  })

EXEMPLO 2 — Escopo indefinido:
User: "como estão as coisas?"
Clara detecta: ambíguo — pode ser atendimento, vendas, agendamentos...

→ ask_user_question({
    question: "O que você quer saber especificamente?",
    suggestions: [
      { label: "Volume de atendimento", value: "atendimento", is_recommended: true, description: "Mensagens, conversas, tempo de resposta" },
      { label: "Vendas e faturamento", value: "vendas", is_recommended: false, description: "Produtos, valores, conversão" },
      { label: "Agendamentos", value: "agendamentos", is_recommended: false, description: "Consultas, cancelamentos, horários" },
      { label: "Visão geral completa", value: "completa", is_recommended: false, description: "Um pouco de tudo — leva ~30s" },
    ],
    allow_free_text: true,
    free_text_placeholder: "Descreva o que quer saber...",
  })

EXEMPLO 3 — Sem dados no período:
Clara executa query e retorna 0 resultados para "esta semana"

→ ask_user_question({
    question: "Não encontrei dados de vendas nesta semana (03/03 a 09/03). Quer que eu expanda o período?",
    suggestions: [
      { label: "Últimos 30 dias", value: "30_dias", is_recommended: true },
      { label: "Mês passado (fevereiro)", value: "fev", is_recommended: false },
      { label: "Todo o histórico", value: "tudo", is_recommended: false },
    ],
    allow_free_text: true,
    free_text_placeholder: "Digite outro período...",
    context: "O período mais recente com dados de vendas é 28/02/2026."
  })

EXEMPLO 4 — Confirmação antes de análise pesada:
User: "analise todas as conversas desde que abrimos"
Clara detecta: ~4.691 mensagens, análise vai levar ~15-20s

→ ask_user_question({
    question: "Analisar todo o histórico (4.691 mensagens desde 09/12/2025) pode levar até 20 segundos. O que prefere?",
    suggestions: [
      { label: "Analisar tudo", value: "tudo", is_recommended: false, description: "~20 segundos de espera" },
      { label: "Últimos 3 meses", value: "3_meses", is_recommended: true, description: "Mais rápido, dados recentes" },
      { label: "Último mês", value: "1_mes", is_recommended: false, description: "Análise rápida (~5s)" },
    ],
    allow_free_text: true,
    free_text_placeholder: "Digite outro período...",
  })
```

---

### 3.11 CAMADA 11: DB Stats Snapshot (NOVO)

**Arquivo:** `src/ai/clara/db_stats.ts`

**Propósito:** Snapshot rápido do estado atual do banco, injetado no system prompt para dar contexto real à Clara. Usado também para alimentar as sugestões nas perguntas interativas.

```typescript
// SPEC: db_stats.ts

interface DbStats {
  total_chats: number;
  total_messages: number;
  total_tokens_approx: number;   // Para a Clara saber se cabe em single pass
  last_chat_activity: string;    // BRT formatado
  chats_today: number;
  messages_today: number;
  first_message_date: string;    // Quando a clínica começou (para sugestões de período)
  data_quality_warnings: string[]; // Ex: ["100% dos stages = 'new' (não analisados)"]
}

// Execução: 3 queries paralelas no início da sessão
// Cache: 5 minutos (não recarregar a cada mensagem)
// Injeção: No buildClaraSystemPrompt como contexto
// Uso nas perguntas interativas: para mostrar "Encontrei X mensagens desde Y"
```

---

### 3.12 CAMADA 12: Classificação Segura de Chats — `update_chat_classification` (NOVO — FIX BRECHA 8)

**Arquivo:** `src/ai/clara/tools.ts` (MODIFICAÇÃO — nova tool dedicada)

**Problema original:** A Camada 9 da v1 propunha liberar UPDATE genérico no execute_sql. Isso é perigoso — o Gemini pode gerar SQL com IDs errados e corromper dados de produção.

**Solução:** Tool dedicada que aceita UM chat por vez, valida valores, e faz log de auditoria.

```typescript
// SPEC: Nova tool update_chat_classification (substitui UPDATE via execute_sql)

export const updateChatClassificationTool = new DynamicStructuredTool({
  name: "update_chat_classification",
  description: `Atualiza stage e/ou ai_sentiment de UM chat específico.
Use SOMENTE quando tiver evidência real (de analyze_raw_conversations ou leitura do chat).
NUNCA classifique em massa sem análise individual.
Faz log de auditoria de cada alteração.`,

  schema: z.object({
    chat_id: z.number().describe("ID do chat a classificar"),
    stage: z.enum([
      "new", "contacted", "interested", "scheduled", "won", "lost", "no_response"
    ]).optional().describe("Novo stage do chat"),
    sentiment: z.enum([
      "positive", "neutral", "negative", "mixed"
    ]).optional().describe("Novo sentimento detectado"),
    reason: z.string().describe("Motivo da classificação (evidência da análise)"),
  }),

  func: async ({ chat_id, stage, sentiment, reason }) => {
    const supabase = getSupabaseAdminClient();

    // Validar que o chat existe
    const { data: chat } = await supabase
      .from("chats")
      .select("id, contact_name, stage, ai_sentiment")
      .eq("id", chat_id)
      .single();

    if (!chat) return `Erro: Chat ${chat_id} não encontrado.`;

    // Montar update
    const updates: Record<string, string> = {};
    if (stage) updates.stage = stage;
    if (sentiment) updates.ai_sentiment = sentiment;

    if (Object.keys(updates).length === 0) {
      return "Nenhum campo para atualizar. Forneça stage ou sentiment.";
    }

    // Executar update
    const { error } = await supabase
      .from("chats")
      .update(updates)
      .eq("id", chat_id);

    if (error) return `Erro ao atualizar: ${error.message}`;

    // Log de auditoria (salvar como memória para rastreabilidade)
    const logEntry = `Chat ${chat_id} (${chat.contact_name}): ${
      stage ? `stage ${chat.stage} → ${stage}` : ""
    }${stage && sentiment ? ", " : ""}${
      sentiment ? `sentiment ${chat.ai_sentiment} → ${sentiment}` : ""
    }. Motivo: ${reason}`;

    // Opcional: salvar na clara_memories ou tabela de audit log
    await supabase.from("clara_memories").insert({
      content: `[AUDIT] ${logEntry}`,
      type: "audit_log",
      metadata: { chat_id, old_stage: chat.stage, new_stage: stage, old_sentiment: chat.ai_sentiment, new_sentiment: sentiment },
    });

    return `✅ ${logEntry}`;
  },
});

// IMPORTANTE: execute_sql continua SOMENTE com SELECT/WITH.
// NUNCA liberar UPDATE/INSERT/DELETE no execute_sql.
```

---

## 4. MODIFICAÇÕES EM ARQUIVOS EXISTENTES

### 4.1 `src/ai/clara/graph.ts` — Modificações

```
0. NOVO NÓ — load_context_node (ANTES de tudo):
   - Chamar loadContextForInteraction(userMessage, chatId)
   - Retornar loaded_context no state
   - EDGE: START → load_context_node → classify_node

1. classify_node:
   - ADICIONAR: Chamar resolveTemporalAnchor(userMessage, previousAnchor)
   - ADICIONAR: temporal_anchor ao state (incluindo comparison_period e intent_type)
   - ADICIONAR: Chamar getDbStats() (com cache)
   - ADICIONAR: Se intent_type === "ambiguous", desviar para pergunta interativa

2. simple_agent:
   - MODIFICAR: buildSystemPrompt → buildClaraSystemPrompt (novo, com temporal anchor, db stats E loaded_context)
   - ADICIONAR: Injetar temporal_anchor nos tool calls
   - ADICIONAR: Bloco <relevant_memories>, <chat_notes>, <knowledge_base> no prompt
   - ADICIONAR: tool ask_user_question na lista de tools disponíveis

3. write_research_brief_node:
   - MODIFICAR: Usar temporal_anchor em vez de calcular today/yesterday
   - ADICIONAR: Se comparison_period existe, incluir no brief

4. research_supervisor_node:
   - MODIFICAR: Usar temporal_anchor para gerar tasks com datas corretas
   - ADICIONAR: Validação pós-researcher (verificar se dados retornados estão no período)

5. NOVO NÓ — spot_check_node (após research_supervisor, antes de final_report):
   - Executar spot-check de citações quando analyze_raw_conversations foi usado
   - Injetar resultado no state para o final_report_node usar

6. final_report_node:
   - ADICIONAR: Regra "📅 Período analisado: ..." obrigatória no início do relatório
   - ADICIONAR: Se comparison_period, incluir "📅 Comparação: ..."
   - ADICIONAR: Chain of Verification + resultado do spot-check antes de emitir resposta
   - ADICIONAR: Se spot_check confidence = "LOW", emitir warning em vez de relatório
```

### 4.2 `src/ai/clara/tools.ts` — Modificações

```
1. execute_sql:
   - WRAPPEAR com QueryValidator (pre_validate + post_validate)
   - ADICIONAR: Auto-retry com SQL corrigido se validação falhar
   - ADICIONAR: Retornar metadata de validação junto com resultado
   - MANTER: Apenas SELECT/WITH (NUNCA liberar UPDATE/INSERT/DELETE)

2. get_volume_metrics:
   - ADICIONAR: Retornar missing_days (dias com zero) explicitamente
   - ADICIONAR: Retornar total_days no período para conferência

3. REMOVER das tools:
   - gerar_relatorio_qualidade_chats (substituída por analyze_raw_conversations)
   - deep_research_chats (substituída por analyze_raw_conversations)

4. ADICIONAR às tools:
   - analyze_raw_conversations (nova — análise direta na fonte com single pass ou map-reduce por chat_id)
   - ask_user_question (nova — perguntas interativas com sugestões clicáveis)
   - update_chat_classification (nova — classificação segura de chats, 1 por vez com audit log)
   - Emitir ui_log por etapa (carregando mensagens... analisando... consolidando... verificando citações...)
```

### 4.3 `src/app/api/ai/copilot/chat/route.ts` — Modificações

```
1. ANTES do invoke:
   - Resolver temporal anchor (com previous_anchor do state)
   - Classificar scope (LOCAL/GLOBAL) → remoção FÍSICA do patient_context se GLOBAL
   - Buscar db stats
   - Separar contexto em zonas XML

2. Durante streaming:
   - Emitir novos eventos detalhados (temporal, comparison, query_start, query_result, validation, spot_check)
   - Em on_tool_start: extrair parâmetros e mostrar preview
   - Em on_tool_end: extrair resultado e mostrar summary
   - NOVO: Interceptar output de ask_user_question → emitir interactive_question event
   - NOVO: Salvar graph checkpoint quando interactive_question é emitida

3. NOVO endpoint: /api/ai/copilot/answer
   - Recebe resposta do usuário a uma interactive_question
   - Carrega checkpoint do graph e retoma execução
```

### 4.4 `src/ai/clara/system_prompt.ts` — REESCRITA

Substituir o prompt atual pelo novo baseado em CO-STAR + Chain of Verification (seção 3.4).
Incluir blocos de memória, temporal anchor com comparison_period, e regras de interactive questions.

### 4.5 State do ClaraGraph — Adicionar campos

```typescript
// Adicionar ao ClaraState:
temporal_anchor: TemporalAnchor | null;        // Inclui comparison_period, intent_type, previous_anchor
db_stats: DbStats | null;
loaded_context: LoadedContext | null;           // Memórias + chat_notes + knowledge carregados automaticamente
query_validations: QueryValidationResult[];    // Histórico de validações da sessão
spot_check_result: SpotCheckResult | null;     // Resultado da verificação de citações
pending_question: InteractiveQuestion | null;  // Pergunta ativa aguardando resposta
```

---

## 5. FRONTEND: Novos Componentes

### 5.1 `ClaraProgressPanel.tsx` (NOVO)
- Lista vertical de etapas com status animado
- Expandível/colapsável
- Mostra acima da área de resposta

### 5.2 `ClaraInteractiveQuestion.tsx` (NOVO)
- Card de pergunta com botões de sugestão
- Botão recomendado com destaque visual
- Campo "Outro" com input de texto livre
- Transforma em texto estático após resposta
- Fica no histórico do chat

### 5.3 Atualização de `ClaraStatusIndicator.tsx`
- Consumir novos eventos de streaming (subtype)
- Labels dinâmicos baseados em metadata real
- Mostrar período em análise + comparação

### 5.4 Atualização de `ClaraMarkdownMessage.tsx`
- Suporte a novo bloco `📅 Período analisado:` com destaque visual
- Highlighting especial para números/métricas
- Badge de confiança do spot-check (✓ Verificado / ⚠️ Parcial)

---

## 6. NOVOS ARQUIVOS A CRIAR

| Arquivo | Propósito |
|---------|-----------|
| `src/ai/clara/temporal_anchor.ts` | Resolução de expressões temporais → timestamps BRT com comparison_period e multi-turn |
| `src/ai/clara/query_validator.ts` | Validação pré/pós execução de queries |
| `src/ai/clara/load_context.ts` | Auto-RAG: carregamento automático de memórias + chat_notes + knowledge_base |
| `src/ai/clara/db_stats.ts` | Snapshot do estado do banco com cache |
| `src/ai/clara/raw_data_analyzer.ts` | Análise direta na fonte — chunking por chat_id, múltiplos goals, citações para spot-check |
| `src/ai/clara/spot_check_verifier.ts` | Verificação de citações do inner LLM contra banco real |
| `src/ai/clara/interactive_questions.ts` | Tool + lógica de perguntas interativas com sugestões |
| `src/app/api/ai/copilot/answer/route.ts` | Endpoint para receber respostas de perguntas interativas |
| `src/components/clara/ClaraProgressPanel.tsx` | Dashboard de progresso em tempo real |
| `src/components/clara/ClaraInteractiveQuestion.tsx` | Card de pergunta interativa com botões |

---

## 7. ARQUIVOS A MODIFICAR

| Arquivo | Tipo de Modificação |
|---------|-------------------|
| `src/ai/clara/graph.ts` | Adicionar load_context_node, spot_check_node, temporal_anchor com comparison, interactive question handling |
| `src/ai/clara/tools.ts` | Wrappear execute_sql, remover gerar_relatorio + deep_research, adicionar 3 novas tools |
| `src/ai/clara/system_prompt.ts` | Reescrita completa com CO-STAR + Chain of Verification + regras de interactive questions |
| `src/app/api/ai/copilot/chat/route.ts` | Context separation física, novos eventos streaming, checkpoint para interactive questions |
| `src/components/clara/ClaraStatusIndicator.tsx` | Labels dinâmicos |
| `src/components/clara/ClaraMarkdownMessage.tsx` | Suporte a período destacado + badge de confiança |

---

## 8. ORDEM DE IMPLEMENTAÇÃO

### Fase 1 — Fundação de Precisão (CRÍTICA — fazer primeiro)
1. `temporal_anchor.ts` — resolver datas ANTES de qualquer processamento, com comparison_period e intent_type
2. `query_validator.ts` — validar queries e resultados
3. `raw_data_analyzer.ts` — nova tool que lê dados brutos, chunking por chat_id, múltiplos goals
4. `spot_check_verifier.ts` — verificação de citações do inner LLM
5. Modificar `tools.ts` — remover gerar_relatorio + deep_research, adicionar analyze_raw_conversations + update_chat_classification, wrappear execute_sql
6. Modificar `system_prompt.ts` — novo prompt CO-STAR com bloco de memória e nova lista de ferramentas

### Fase 2 — Memória Híbrida + Context Separation + State
7. `load_context.ts` — Auto-RAG: carregamento automático de memórias, chat_notes e knowledge_base
8. `db_stats.ts` — snapshot do banco com cache
9. Modificar `graph.ts` — adicionar load_context_node, spot_check_node, injetar temporal_anchor (com comparison + intent_type) e loaded_context no state
10. Modificar `route.ts` — separar contexto com remoção FÍSICA, resolver temporal anchor antes do invoke

### Fase 3 — Interactive Questions (Perguntas Inteligentes)
11. `interactive_questions.ts` — tool ask_user_question com sugestões clicáveis
12. `/api/ai/copilot/answer/route.ts` — endpoint para receber respostas + retomar graph
13. `ClaraInteractiveQuestion.tsx` — componente frontend com botões + texto livre
14. Integrar graph checkpoint: salvar estado ao perguntar, restaurar ao receber resposta

### Fase 4 — Progressive Streaming (Frontend)
15. Novos eventos de streaming no `route.ts` (incluindo evento de memória, query, análise, spot-check, comparison)
16. `ClaraProgressPanel.tsx` — componente de progresso
17. Atualizar `ClaraStatusIndicator.tsx` e `ClaraMarkdownMessage.tsx`

### Fase 5 — Qualidade de Dados (menor prioridade)
18. Clara pode classificar chats sob demanda via analyze_raw_conversations + update_chat_classification (1 por vez, com audit log)

---

## 9. MÉTRICAS DE SUCESSO

| Métrica | Antes | Meta |
|---------|-------|------|
| Precisão de período (data certa) | ~60% | 99%+ |
| Dados inventados/alucinados | ~15% das respostas | <1% (spot-check) |
| Mistura de contexto local/global | Frequente | Zero (remoção física) |
| Cobertura de análise | 74% (só insights processados) | 100% (lê fonte direta) |
| Perguntas comparativas corretas | ~30% (sem comparison_period) | 95%+ |
| Retrabalho por escopo errado | ~40% | <5% (interactive questions) |
| Citações verificadas (spot-check) | 0% | 100% |
| Feedback visual de progresso | Labels genéricos | Etapas com dados reais |
| Tempo para o usuário entender o que está acontecendo | 10-30s (sem feedback) | Instantâneo |

---

## 10. TESTES DE VALIDAÇÃO

Após implementação, testar com estas perguntas exatas:

```
1. "Como está o atendimento hoje?"
   → DEVE retornar SOMENTE dados de hoje (09/03/2026), com período declarado

2. "Quantas conversas tivemos esta semana?"
   → DEVE retornar dados de 03/03 a 09/03, dia a dia, incluindo zeros

3. "Me mostra o relatório de ontem"
   → DEVE retornar SOMENTE dados de 08/03, nunca de outros dias

4. "Quantas mensagens a Joana enviou hoje?"
   → DEVE filtrar sender='HUMAN_AGENT' + created_at de hoje + contar

5. "Quais foram as objeções dos pacientes esta semana?"
   → DEVE usar analyze_raw_conversations lendo mensagens brutas, NÃO chat_insights
   → Spot-check DEVE confirmar citações

6. (Estando na tela do paciente João) "Como foi o atendimento da clínica hoje?"
   → DEVE retornar dados GLOBAIS, NÃO do paciente João (patient_context REMOVIDO fisicamente)

7. "Quantos atendimentos tivemos de 01/02 a 28/02?"
   → DEVE retornar dados EXATOS de fevereiro, com período declarado

8. "Por que meu faturamento caiu esse mês?" (NOVO — teste comparativo)
   → DEVE gerar comparison_period automaticamente (março vs fevereiro)
   → DEVE consultar vendas em AMBOS os períodos
   → DEVE cruzar com conversas para encontrar causas qualitativas

9. "Me dá um relatório" (NOVO — teste interactive question)
   → DEVE perguntar qual período e escopo com sugestões clicáveis
   → NÃO deve adivinhar e gerar relatório genérico

10. "Quais são as objeções mais comuns dos pacientes?" (NOVO — teste intent_type strategic)
    → DEVE usar intent_type="strategic" → últimos 90 dias (NÃO 7 dias)
    → OU perguntar ao usuário qual período

11. "E o mês passado?" (NOVO — teste multi-turn)
    → DEVE usar previous_anchor para resolver "mês passado" em relação ao período anterior
    → NÃO deve confundir com o mês anterior ao atual

12. "Como estão as coisas?" (NOVO — teste ambiguidade)
    → DEVE fazer interactive_question perguntando O QUE quer saber
    → NÃO deve gerar relatório genérico
```

---

## 11. BRECHAS IDENTIFICADAS E RESOLVIDAS (v2.1)

### Rodada 1 (v2.0)

| # | Brecha | Gravidade | Fix | Camada |
|---|--------|-----------|-----|--------|
| 1 | Alucinação na inner LLM call (analyze_raw_conversations) | 🔴 Grave | Spot-check de citações contra banco real | Camada 9 |
| 2 | Perguntas comparativas sem período de comparação | 🔴 Grave | comparison_period automático no TemporalAnchor | Camada 1 |
| 3 | Default 7 dias para perguntas estratégicas | 🟡 Médio | intent_type classifica operacional vs estratégico vs ambíguo | Camada 1 |
| 4 | Map-Reduce perde padrões cross-chat (chunking cronológico) | 🟡 Médio | Chunking por chat_id em vez de cronológico | Camada 8 |
| 5 | Gemini vaza context entre XML zones | 🟡 Médio | Remoção FÍSICA do patient_context quando pergunta é global | Camada 2 |
| 6 | Multi-turn perde contexto temporal | 🟡 Médio | previous_anchor no state + resolução relativa | Camada 1 |
| 7 | Custo multiplicado (múltiplas chamadas carregando mesmos dados) | 🟢 Baixo | Múltiplos analysis_goals numa única chamada | Camada 8 |
| 8 | UPDATE livre no execute_sql (risco de corrupção) | 🟢 Baixo | Tool dedicada update_chat_classification com audit log | Camada 12 |

### Rodada 2 (v2.1)

| # | Brecha | Gravidade | Fix | Onde implementar |
|---|--------|-----------|-----|------------------|
| 9 | Observation Masking nunca implementado — conversas longas degradam qualidade | 🔴 Grave | Context Compactor: manter últimas 6 msgs + resumir anteriores | `src/ai/clara/context_compactor.ts` (NOVO) — executar em `load_context_node` quando `messages.length > 12` |
| 10 | Spot-check quebra com caracteres especiais (`%`, `_`) na citação do LLM | 🟡 Médio | Escapar chars especiais antes do ILIKE: `text.replace(/%/g, '\\%').replace(/_/g, '\\_')`. Ou usar Postgres `position()` em vez de ILIKE | `src/ai/clara/spot_check_verifier.ts` — na query de verificação |
| 11 | Race condition: double-click no botão de sugestão gera resposta duplicada | 🟡 Médio | (1) Frontend: disable botões ao primeiro clique. (2) Backend: `loadGraphCheckpoint` faz DELETE atômico — segundo request recebe 409. (3) Frontend: trata 409 silenciosamente | `ClaraInteractiveQuestion.tsx` + `/api/ai/copilot/answer/route.ts` |
| 12 | Dead time sem feedback durante inner LLM call do analyze_raw_conversations (~10-20s) | 🟡 Médio | Emitir eventos intermediários via callback LangChain: "📥 Carregando X msgs..." → "📊 Processando..." → "✍️ Gerando análise..." → "🔎 Extraindo citações..." | `src/ai/clara/raw_data_analyzer.ts` — adicionar `config.callbacks` para propagar events ao stream |
| 13 | Graph checkpoint pode perder dados ao serializar (objetos LangChain não são JSON-safe) | 🟡 Médio | Criar `serializeState()` / `deserializeState()`: converter Messages para `{role, content, tool_calls}` plano e rehidratar com construtores LangChain (`HumanMessage`, `AIMessage`, `ToolMessage`) | `src/ai/clara/interactive_questions.ts` — funções de serialização |
| 14 | classifyScope falha em perguntas híbridas ("pacientes como esse na clínica") | 🟡 Médio | Adicionar terceiro escopo `"HYBRID"`: quando ambos scores > 0, injetar patient_context COM instrução "use como referência, mas análise é GLOBAL" | `src/app/api/ai/copilot/chat/route.ts` — função `classifyScope()` |

### Especificações detalhadas das brechas 9-14

**BRECHA 9 — Context Compactor (Observation Masking)**

```typescript
// SPEC: src/ai/clara/context_compactor.ts (NOVO)

const MAX_FULL_MESSAGES = 6;  // Manter as últimas 6 mensagens inteiras
const COMPACTION_TRIGGER = 12; // Compactar quando > 12 mensagens no state

/**
 * Executar dentro do load_context_node, ANTES de qualquer processamento.
 * Se messages.length > COMPACTION_TRIGGER:
 *   1. Separar: mensagens_antigas = messages[0..n-6], mensagens_recentes = messages[n-6..n]
 *   2. Gerar resumo das antigas via Gemini (temperature=0, max_tokens=300):
 *      "Resumo da conversa até agora: [resumo de 1 parágrafo]"
 *   3. Substituir mensagens_antigas por UMA SystemMessage com o resumo
 *   4. Retornar: [SystemMessage(resumo), ...mensagens_recentes]
 *
 * Resultado: o contexto NUNCA cresce indefinidamente.
 * As últimas 6 mensagens mantêm detalhe completo (ida e volta recente).
 * O restante é compactado em ~100-200 tokens.
 */

export async function compactMessages(
  messages: BaseMessage[],
  model: ChatGoogleGenerativeAI
): Promise<BaseMessage[]> {
  if (messages.length <= COMPACTION_TRIGGER) return messages; // Nada a compactar

  const cutoff = messages.length - MAX_FULL_MESSAGES;
  const oldMessages = messages.slice(0, cutoff);
  const recentMessages = messages.slice(cutoff);

  // Gerar resumo compacto das mensagens antigas
  const oldContent = oldMessages
    .map(m => `${m._getType()}: ${typeof m.content === 'string' ? m.content.slice(0, 200) : '[tool_call]'}`)
    .join('\n');

  const summaryResponse = await model.invoke([
    { role: "system", content: "Resuma a conversa abaixo em 1-2 parágrafos curtos. Mantenha: datas mencionadas, decisões tomadas, dados pedidos, resultados obtidos. Descarte: saudações e formalidades." },
    { role: "user", content: oldContent },
  ], { maxOutputTokens: 300, temperature: 0 });

  const summary = typeof summaryResponse.content === 'string' ? summaryResponse.content : '';

  return [
    new SystemMessage(`[RESUMO DA CONVERSA ANTERIOR]\n${summary}`),
    ...recentMessages,
  ];
}
```

**Integração:** Adicionar ao `load_context_node` em `graph.ts`:
```typescript
// Após carregar contexto, compactar mensagens se necessário
const compactedMessages = await compactMessages(state.messages, compactModel);
return { loaded_context: context, messages: compactedMessages };
```

**BRECHA 10 — Sanitização de citações no spot-check**

```typescript
// SPEC: Adicionar ao spot_check_verifier.ts

function sanitizeForIlike(text: string): string {
  return text
    .replace(/\\/g, '\\\\')  // Escape backslash primeiro
    .replace(/%/g, '\\%')     // Escape wildcard %
    .replace(/_/g, '\\_');     // Escape wildcard _
}

// Usar em todas as queries:
.ilike("message_text", `%${sanitizeForIlike(citation.text.slice(0, 50))}%`)
```

**BRECHA 11 — Proteção contra double-click**

```typescript
// SPEC: Frontend — ClaraInteractiveQuestion.tsx
// Adicionar estado local:
const [isAnswered, setIsAnswered] = useState(false);

const handleAnswer = async (value: string) => {
  if (isAnswered) return; // Proteção 1: ignorar cliques após o primeiro
  setIsAnswered(true);    // Proteção 2: desabilitar UI imediatamente

  try {
    await fetch('/api/ai/copilot/answer', { ... });
  } catch (err) {
    if (err.status === 409) {
      // Já foi respondido — ignorar silenciosamente
      return;
    }
    setIsAnswered(false); // Re-habilitar se erro real
  }
};

// SPEC: Backend — /api/ai/copilot/answer/route.ts
// loadGraphCheckpoint deve fazer DELETE atômico:
async function loadAndDeleteCheckpoint(questionId: string): Promise<GraphCheckpoint | null> {
  const checkpoint = checkpoints.get(questionId);
  if (!checkpoint) return null;
  checkpoints.delete(questionId); // Proteção 3: impede segundo request
  if (new Date(checkpoint.expires_at) < new Date()) return null;
  return checkpoint;
}
```

**BRECHA 12 — Progress events dentro do analyze_raw_conversations**

```typescript
// SPEC: Adicionar ao raw_data_analyzer.ts
// A tool deve aceitar um callback de progresso via RunnableConfig

func: async ({ start_date, end_date, analysis_goals, ... }, runManager) => {
  // Emitir progresso em cada etapa:
  await runManager?.handleToolStart?.({ name: "analyze_raw_conversations" }, "📥 Carregando mensagens...");

  // ... carregar mensagens ...
  await runManager?.handleText?.(`📥 ${allMessages.length} mensagens carregadas`);

  // ... antes da chamada ao Gemini ...
  await runManager?.handleText?.(`📊 Analisando ${approxTokens.toLocaleString()} tokens via ${method}...`);

  // ... após Gemini retornar ...
  await runManager?.handleText?.(`🔎 Extraindo citações para verificação...`);

  // O route.ts captura esses events via on_tool_stream e emite como ui_log
}
```

**BRECHA 13 — Serialização segura do state**

```typescript
// SPEC: Adicionar ao interactive_questions.ts

import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

interface SerializedMessage {
  type: "human" | "ai" | "system" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  additional_kwargs?: Record<string, any>;
}

function serializeMessages(messages: BaseMessage[]): SerializedMessage[] {
  return messages.map(m => ({
    type: m._getType() as SerializedMessage["type"],
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    name: (m as any).name,
    tool_call_id: (m as any).tool_call_id,
    additional_kwargs: m.additional_kwargs,
  }));
}

function deserializeMessages(serialized: SerializedMessage[]): BaseMessage[] {
  return serialized.map(s => {
    const opts = { content: s.content, name: s.name, additional_kwargs: s.additional_kwargs };
    switch (s.type) {
      case "human": return new HumanMessage(opts);
      case "ai": return new AIMessage(opts);
      case "system": return new SystemMessage(opts);
      case "tool": return new ToolMessage({ ...opts, tool_call_id: s.tool_call_id || "" });
      default: return new HumanMessage(opts);
    }
  });
}

// Usar em saveGraphCheckpoint:
const serialized = { ...state, messages: serializeMessages(state.messages) };
// Usar em loadGraphCheckpoint:
const state = { ...raw, messages: deserializeMessages(raw.messages) };
```

**BRECHA 14 — Escopo HYBRID no classifyScope**

```typescript
// SPEC: Atualizar classifyScope em route.ts

function classifyScope(message: string, chatId: number): "LOCAL" | "GLOBAL" | "HYBRID" {
  const msg = message.toLowerCase();

  const localIndicators = [
    "esse paciente", "esta conversa", "esse chat", "esse contato",
    "histórico dele", "histórico dela", "última mensagem",
    "o que ele disse", "o que ela disse", "responda pra",
    "como esse", "como essa", "igual a esse", "igual a essa",
    "desse paciente", "dessa paciente"
  ];

  const globalIndicators = [
    "clínica", "atendimento", "período", "semana", "dia", "relatório",
    "quantos", "quantas", "como está", "como estão", "total",
    "faturamento", "vendas", "agendamento", "objeções", "padrões",
    "todos os", "todas as", "geral", "visão geral"
  ];

  const localScore = localIndicators.filter(i => msg.includes(i)).length;
  const globalScore = globalIndicators.filter(i => msg.includes(i)).length;

  // NOVO: Se ambos > 0, é HYBRID
  if (localScore > 0 && globalScore > 0) return "HYBRID";

  return localScore > globalScore ? "LOCAL" : "GLOBAL";
}

// No contextualMessage:
${scope === "LOCAL" ? `<patient_context scope="LOCAL">
${chatHistory}
</patient_context>` : scope === "HYBRID" ? `<patient_context scope="REFERÊNCIA" usage="Use APENAS como referência para entender 'esse/essa paciente'. A análise é GLOBAL.">
${chatHistory}
</patient_context>` : "<!-- patient_context REMOVIDO: pergunta classificada como GLOBAL -->"}
```

---

## 12. OBSERVAÇÕES FINAIS

**Sobre o modelo (Gemini):** O Gemini 3-Flash é bom mas tem tendência maior a hallucination em queries SQL e respeita XML boundaries pior que Claude. As camadas de validação (Query Validator), remoção física de contexto, e spot-check de citações compensam essas fraquezas.

**Sobre o banco:** Os dados reais mostram ~4.691 mensagens (~99K tokens) e ~237 chats. TODO o histórico cabe em 9.9% do contexto do Gemini Flash (1M tokens). Isso viabiliza a abordagem de análise direta na fonte sem nenhum resumo intermediário.

**Sobre a mudança de paradigma:** A Clara deixa de depender de tabelas intermediárias (`chat_insights`) e passa a ir direto nos dados brutos. Isso significa que ela pode responder QUALQUER pergunta, não apenas as que foram previstas. É o equivalente a ter um analista que lê todos os relatórios vs um que lê só os resumos.

**Sobre escalabilidade:** Quando a clínica crescer (ex: 50K mensagens, ~500K tokens), a estratégia de single pass ainda funciona (50% do contexto). Acima disso, o map-reduce automático entra em ação com chunking por chat_id (mantendo conversas inteiras). O sistema está futureproof.

**Sobre interactive questions:** Este é o diferencial mais importante da v2.0. Em vez de adivinhar e errar, Clara pergunta com sugestões inteligentes. O UX é inspirado no Claude Code — botões clicáveis com recomendação destacada + opção de texto livre. Isso elimina ~40% do retrabalho causado por escopo incorreto.

**Sobre stage/sentiment:** Esses campos são inúteis no estado atual (100% defaults). Com a nova tool `update_chat_classification`, a Clara pode classificá-los sob demanda com audit log, sem risco de corrupção de dados.

**Sobre a segurança dos dados:** execute_sql permanece SOMENTE com SELECT/WITH. Toda escrita no banco passa por tools dedicadas com validação de valores e audit log. Nenhum SQL de UPDATE/INSERT é gerado livremente pelo modelo.
