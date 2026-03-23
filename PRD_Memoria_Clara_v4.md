# PRD v4 — Sistema de Memória da Clara
**Pediatria v2 · Support Clinic · Revisado março 2026**
**Autor:** Brendo Sousa | Resolve IA
**Status:** Pronto para implementação

---

## 1. Missão e Objetivo

Clara é a IA da Clínica Aliança Kids. Sua missão é **aumentar o faturamento e a margem de lucro** da empresa. Para isso ela precisa:

- Conhecer a empresa de ponta a ponta (preços, processos, equipe, protocolos)
- Aprender padrões reais de comportamento dos pacientes/responsáveis
- Detectar proativamente: perdas de receita, gargalos, oportunidades de melhoria
- Ser mais precisa que os funcionários humanos em informações operacionais

**O problema atual:** o sistema de memória trata observações de conversas como fatos de mesmo peso que regras da empresa. Uma conversa onde Joana oferece um desconto de R$400 pode fazer Clara "aprender" que a consulta custa R$400. Isso é poluição de memória.

---

## 2. Diagnóstico do Estado Atual

### 2.1 Mapa de Arquivos (Verificado)

| Arquivo | Função Real | Status |
|---|---|---|
| `src/ai/clara/tools.ts` — `manage_long_term_memory` | Ponto real de save. Já tem upsert semântico (threshold 0.80) | OK mas incompleto |
| `src/ai/clara/load_context.ts` | Retrieval real via `match_memories` RPC, threshold 0.65, limit 5 | Operacional |
| `src/ai/clara/memory_quality.ts` | Strip PII, check generalizabilidade. Mín 20 chars | Incompleto |
| `src/ai/clara/memory_types.ts` | 8 categorias + 113 aliases legacy | OK |
| `src/ai/clara/memoryManager.ts` | Legacy. Usa tabela `semantic_memory` (não `clara_memories`). Nunca chamado | CÓDIGO MORTO |
| `scripts/cleanup-memories.mts` | Consolidação semanal. Múltiplos bugs críticos | BUGS CRÍTICOS |
| `src/ai/vault/semantic.ts` | Hybrid search: pgvector + vault | OK |
| `worker/src/runtime.ts` | Cron: consolidação quarta 02:00 BRT | OK |

### 2.2 Bugs Confirmados no Código

**[P1] Ordem de delete invertida em `main()` — `cleanup-memories.mts` linha ~463**
```typescript
// CÓDIGO ATUAL (BUGADO):
for (const mem of cluster) allToDelete.push(mem.id);   // ← marca delete ANTES
const consolidated = await consolidateCluster(cluster); // ← só então consolida
// Se consolidateCluster retornar [], cluster foi deletado e nada substituiu
```
> **Nota:** O PRD v3 apontava o bug dentro de `consolidateCluster()`. O bug real está em `main()`. O `try/catch` dentro de `consolidateCluster` já existe e retorna `[]` — o problema é que os IDs já foram empilhados em `allToDelete` antes de saber o resultado.

**[P2] Hard delete sem rollback — `applyChanges()` linhas 309-316**
```typescript
supabase.from('clara_memories').delete().in('id', batch) // irreversível
```

**[P3] Vault regenerado via `rm -rf` — `regenerateVault()` linha 360**
```typescript
await fs.rm(vaultMemDir, { recursive: true, force: true }) // sem backup, sem atomic swap
```

**[P4] Quality gate incompleto — `memory_quality.ts`**
- Mín 20 chars (muito baixo)
- Sem detecção de RG, CNPJ
- Sem cálculo de quality score

**[P5] Threshold 0.65 não calibrado — `load_context.ts` linha 50**

**[P6] `--dry-run` ainda consome API — `cleanup-memories.mts` linha 436**
```typescript
// dry-run só previne delete/insert, mas embedText() ainda é chamado
mem.embedding = await embedText(mem.content); // gasta quota mesmo em dry-run
```

**[P7] Código morto — `memoryManager.ts`**
- Usa `text-embedding-004` via LangChain + tabela `semantic_memory` (legacy)
- Nenhuma importação ativa no codebase

**[P8] `audit_log` contamina `clara_memories`**
```typescript
// tools.ts linha 1159 — INSERT com memory_type não canonical:
await adminSb.from("clara_memories").insert({ memory_type: "audit_log", ... })
// O cleanup vai mapear isso como "padrao_comportamental" (fallback default)
```

**[P9] Dois thresholds de busca divergentes**
- `load_context.ts` busca automática: `0.65`
- `manage_long_term_memory` consulta manual: `0.70`
- Nenhum foi calibrado com dados reais

**[P10] `quality_score` nunca salvo no insert real**
- Migration adiciona o campo mas `manage_long_term_memory` não calcula nem persiste
- Re-ranking usa DEFAULT 50 para todas as memórias (valor artificial)

**[P11] `last_accessed` / `access_count` órfãos**
- Adicionados na migration mas nenhuma tarefa popula esses campos

**[P12] Memórias sem vínculo com paciente**
- Padrões como "Paciente com zinco baixo" são salvos sem referência ao paciente
- Observações individuais que passam o quality gate viram "conhecimento geral"

---

## 3. Arquitetura de Memória — Decisão

### 3.1 Princípio Fundamental

> **Vault local = Memória da Clara. Supabase = Biblioteca de pesquisa.**

Clara **conhece** o que está no vault (sempre carregado ou buscado semanticamente).
Clara **pesquisa** o Supabase quando precisa de dados operacionais (pacientes, consultas, financeiro).

### 3.2 Hierarquia de Memória (3 Tiers)

```
┌────────────────────────────────────────────────────────────┐
│  TIER 1 — AUTORITATIVO (Clara lê, nunca escreve)           │
│  Fonte: Brendo / Dra. Fernanda / decisões explícitas       │
│  Arquivos: agents/clara/company.md                         │
│            agents/clara/rules.md                           │
│            knowledge/operations/*.md                       │
│            memories/regra-negocio/*                        │
│            memories/protocolo-clinico/*                    │
│            memories/recurso-equipe/*                       │
│  Prioridade: MÁXIMA — nunca pode ser contradito por Tier 2 │
└────────────────────────────────────────────────────────────┘
         ↓ se Tier 1 não responde, busca Tier 2
┌────────────────────────────────────────────────────────────┐
│  TIER 2 — APRENDIDO (Clara escreve com quality gate)       │
│  Fonte: Padrões observados em múltiplas conversas          │
│  Arquivos: memories/padrao-comportamental/*                │
│            memories/processo-operacional/*                 │
│            memories/feedback-melhoria/*                    │
│            memories/conhecimento-medico/*                  │
│  Prioridade: SECUNDÁRIA — usada para enriquecer contexto   │
│  Backing store: Supabase clara_memories (pgvector)         │
└────────────────────────────────────────────────────────────┘
         ↓ contexto imediato da conversa atual
┌────────────────────────────────────────────────────────────┐
│  SHORT-TERM — CONTEXTO VIVO                                │
│  chat_notes: notas sobre o paciente atual (por chat_id)    │
│  scratchpad.md: raciocínio da sessão em curso              │
│  Não persiste entre conversas diferentes                   │
└────────────────────────────────────────────────────────────┘
```

### 3.3 Supabase como Biblioteca (não como memória)

| Tabela | Papel para Clara |
|---|---|
| `clara_memories` | Backing store do Tier 2 (busca vetorial) |
| `chats` + `messages` | Dados brutos de conversas — Clara pesquisa quando precisa de evidências |
| `patients` / cadastros | Dados de pacientes — Clara consulta para vincular contexto |
| `appointments` | Agenda — Clara consulta, nunca aprende a partir dela |
| `memory_audit_log` | Logs de operações — nunca carregado como contexto |

Clara **nunca** deriva generalizações diretamente de `chats` ou `messages`. Ela pode pesquisar essas tabelas via ferramentas de análise (Analyst), mas o aprendizado só acontece via `manage_long_term_memory` com quality gate.

### 3.4 Ordem de Carregamento por Mensagem

Executado em paralelo em `load_context.ts` a cada interação:

```
1. [SEMPRE] company.md + rules.md (Tier 1 core) ← já em memória, sem I/O
2. [SEMPRE] chat_notes do chat atual (Short-term)
3. [KEYWORD] knowledge/operations/ — match por palavras-chave da mensagem
4. [SEMANTIC] clara_memories via match_memories — threshold calibrado, limit 10 → rerank → top 5
5. [RECENTE] decisions/ — 3 últimas decisões ativas
6. [OPCIONAL] scratchpad.md — se não vazio
```

### 3.5 Prioridade em Caso de Contradição

Se Tier 2 retorna algo que contradiz Tier 1, **Tier 1 sempre vence** e Clara deve ignorar o resultado do Tier 2. Isso é implementado via:
1. `AUTHORITATIVE_FACTS` — conjunto de fatos extraídos do Tier 1 carregados no contexto do sistema
2. Validação pré-save que detecta contradições antes de salvar no Tier 2

---

## 4. Mecanismo Anti-Poluição

### 4.1 O Problema

```
Joana oferece desconto → R$400 → conversa salva →
Clara aprende "consulta = R$400" → contradiz regra "consulta = R$500"
```

### 4.2 Solução: Contradiction Guard

Antes de salvar qualquer memória de Tier 2, o sistema verifica contra fatos autoritativos do Tier 1:

```typescript
// Arquivo: src/ai/clara/contradiction_guard.ts (NOVO)

const AUTHORITATIVE_FACTS: AuthoritativeFact[] = [
  // Extraídos automaticamente do Tier 1 na inicialização
  // Formato: { pattern: RegExp, canonical_value: string, memory_types: string[] }
  {
    pattern: /consulta.*R\$\s*(\d+)/i,
    canonical_value: "R$ 500,00",
    reject_if_different: true,
    rejection_message: "Valor de consulta conflita com regra autoritativa (R$ 500,00). Use manage_long_term_memory para registrar exceções como padrão comportamental de objeção de preço, não como regra de negócio."
  },
  // ... outros fatos críticos
];

export function checkContradiction(content: string, memory_type: string): ContradictionResult
```

**Regra:** Se `memory_type` é `regra_negocio` ou `protocolo_clinico`, o Contradiction Guard é obrigatório. Para `padrao_comportamental`, apenas loga o conflito sem rejeitar (porque "paciente pagou R$400 com desconto" é um padrão válido, desde que salvo como comportamento, não como regra).

### 4.3 Memórias Individuais vs. Padrões Generalizáveis

**Regra de ouro:** Observação sobre 1 paciente específico → vai para `chat_notes`, não para `clara_memories`.

```
❌ "Paciente com zinco baixo" → individual, vai pro chat_notes
✅ "Pacientes pediátricos com sintomas de carência de zinco respondem bem a suplementação de 10 gotas/dia por 6 meses" → generalizável, vai pro clara_memories
```

Adicionado ao quality gate em `memory_quality.ts`: detector de referência a paciente único sem generalização.

---

## 5. Spec de Implementação

Executar na ordem dos blocos. Cada bloco é independente após suas dependências.

---

### BLOCO A — Baseline (sem dependências, executar primeiro)

#### A.1 — Script de Auditoria do Supabase
**Criar:** `scripts/audit-supabase.mts`

Retorna:
- Total de memórias em `clara_memories`
- Total com `embedding IS NULL`
- Total por `memory_type`
- Top-10 pares com maior similaridade (>0.90) — candidatos a duplicata
- Memórias com `memory_type = 'audit_log'` (contaminação P8)
- Divergência vault vs. Supabase: arquivos no vault sem `supabase_id` válido e vice-versa

**Output:** JSON + sumário no console.

#### A.2 — Script de Avaliação de Retrieval
**Criar:** `scripts/eval-retrieval.mts`

**Responsabilidade do golden set:** Brendo cria manualmente o arquivo `scripts/eval-golden-set.json` com 50 queries cobrindo: preços, agendamento, urgências, retorno, exames, Dra. Fernanda, ordem de chegada. Formato:
```json
[
  { "query": "qual o valor da consulta?", "expected_contains": ["500", "R$"] },
  { "query": "quando a dra fernanda atende?", "expected_contains": ["terça"] }
]
```

O script lê esse arquivo, roda cada query contra `match_memories` com os thresholds testados (0.65, 0.70, 0.75, 0.80) e calcula precision@5. Output: JSON com scores por threshold.

**Pré-condição de D.1:** Este script deve estar funcionando antes de calibrar threshold.

---

### BLOCO B — Segurança (executar antes de qualquer consolidação)

#### B.1 — Migration: Soft Delete + Quality Fields + Audit Log
**Arquivo:** `supabase/migrations/YYYYMMDD_memory_safety.sql`

```sql
-- Soft delete
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS archive_reason text;

-- Quality e status de embedding
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS quality_score int DEFAULT NULL;
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS embedding_status text DEFAULT 'ok';

-- Backfill embedding_status baseado em embedding existente
UPDATE clara_memories SET embedding_status = CASE
  WHEN embedding IS NULL THEN 'failed'
  ELSE 'ok'
END;

-- Índices
CREATE INDEX IF NOT EXISTS idx_clara_memories_active ON clara_memories(archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_embedding_pending ON clara_memories(embedding_status) WHERE embedding_status IN ('pending', 'failed');

-- Tabela de audit log (separada de clara_memories)
CREATE TABLE IF NOT EXISTS memory_audit_log (
  id serial PRIMARY KEY,
  run_at timestamptz NOT NULL DEFAULT now(),
  operation text NOT NULL, -- 'consolidation' | 'save' | 'archive' | 'hard_delete' | 'dedup_skip'
  memories_before int,
  memories_after int,
  clusters_found int,
  singletons_kept int,
  singletons_discarded int,
  embedding_failures int,
  details jsonb,
  dry_run boolean DEFAULT false
);
```

> **Nota:** `last_accessed` e `access_count` foram removidos. Não há código que os popule e o re-ranking não os usa. Podem ser adicionados numa iteração futura quando houver instrumentação real.

#### B.2 — Fix da Ordem de Delete em `main()` — `cleanup-memories.mts`
**Localização:** `main()`, seção "5. Consolidar clusters via LLM" (~linha 458)

**Mudança:** mover `allToDelete.push()` para DEPOIS de verificar que a consolidação gerou output válido.

```typescript
// ANTES (bugado):
for (const mem of cluster) allToDelete.push(mem.id); // ← ANTES do resultado
const consolidated = await consolidateCluster(cluster);

// DEPOIS (correto):
const consolidated = await consolidateCluster(cluster);
if (consolidated.length > 0) {
  // Só marca para delete se consolidação gerou algo
  for (const mem of cluster) allToDelete.push(mem.id);
  for (const c of consolidated) allConsolidated.push(c);
} else {
  // Consolidação falhou ou retornou vazio — manter originais
  console.warn(`[Consolidation] Cluster de ${cluster.length} não gerou output. Mantendo originais.`);
  for (const mem of cluster) {
    // Cada membro vira singleton e passa pelo quality gate
    singletons.push(mem);
  }
}
```

#### B.3 — Soft Delete em `applyChanges()` — `cleanup-memories.mts`
**Localização:** `applyChanges()` linhas ~309-316

**Mudança:** substituir hard delete por soft delete. Primeira, inserir consolidadas. Depois, arquivar antigas.

```typescript
async function applyChanges(toDelete: number[], toInsert: ConsolidatedMemory[]): Promise<void> {
  if (DRY_RUN) { /* ... */ return; }

  // 1. PRIMEIRO: inserir consolidadas com novos embeddings
  let insertCount = 0;
  for (const mem of toInsert) {
    try {
      const embedding = await embedText(mem.content);
      const score = calculateQualityScore(mem.content); // ← NOVO
      const { error } = await supabase.from('clara_memories').insert({
        memory_type: mem.memory_type,
        content: mem.content,
        embedding,
        quality_score: score, // ← NOVO
        source_role: 'consolidation',
        updated_at: new Date().toISOString(),
      });
      if (!error) insertCount++;
      await sleep(200);
    } catch (err) { /* log */ }
  }
  console.log(`[Insert] ${insertCount}/${toInsert.length} memórias consolidadas inseridas`);

  // 2. SÓ DEPOIS: arquivar antigas (soft delete)
  for (let i = 0; i < toDelete.length; i += 50) {
    const batch = toDelete.slice(i, i + 50);
    await supabase.from('clara_memories').update({
      archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: 'consolidation',
    }).in('id', batch);
  }
  console.log(`[Archive] ${toDelete.length} memórias arquivadas (soft delete)`);
}
```

#### B.4 — Vault Regen Atômico — `regenerateVault()` — `cleanup-memories.mts`
**Localização:** `regenerateVault()` linhas ~350-403

**Estratégia:** gerar em `memories_temp/`, swap atômico após sucesso, manter `memories_old/` como backup por 24h.

```typescript
async function regenerateVault(): Promise<void> {
  if (DRY_RUN) { /* ... */ return; }

  const vaultMemDir = path.join(process.cwd(), 'clinica-vault', 'memories');
  const tempDir = vaultMemDir + '_temp';
  const oldDir = vaultMemDir + '_old';

  // 1. Gerar em diretório temporário
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });

  // [gerar todos os arquivos em tempDir...]
  // Busca, geração de .md, escrita — mesma lógica atual mas em tempDir

  // 2. Validar integridade mínima antes do swap
  const generated = await fs.readdir(tempDir, { recursive: true });
  const mdFiles = generated.filter(f => String(f).endsWith('.md'));
  if (mdFiles.length === 0) {
    console.error('[Vault] Geração produziu 0 arquivos. Abortando swap. Vault original intacto.');
    await fs.rm(tempDir, { recursive: true, force: true });
    return;
  }

  // 3. Swap atômico
  await fs.rm(oldDir, { recursive: true, force: true });
  await fs.rename(vaultMemDir, oldDir);   // memories/ → memories_old/
  await fs.rename(tempDir, vaultMemDir);  // memories_temp/ → memories/

  console.log(`[Vault] ${mdFiles.length} arquivos gerados. Swap atômico concluído.`);
  // memories_old/ removido no próximo ciclo ou após 24h via cron
}
```

**Decisão de arquitetura — Incremental vs. Atômico:** usar **atômico** (B.4 acima). A regeneração incremental descrita na Seção 6 do PRD v3 é descartada — ela exige rastrear `ultima_regeneracao` e sincronizar com updates no Supabase, adicionando complexidade sem ganho real dado o volume atual (~750 memórias, <5s de geração).

#### B.5 — Retry de Embedding com Status — `cleanup-memories.mts`
**Localização:** `embedText()` linha ~68

```typescript
async function embedText(text: string, retries = 3): Promise<number[] | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
        config: { outputDimensionality: 768 },
      });
      return response.embeddings?.[0]?.values ?? null;
    } catch (err) {
      if (attempt === retries) {
        console.error(`[Embed] Falha após ${retries} tentativas:`, err instanceof Error ? err.message : err);
        return null;
      }
      await sleep(1000 * Math.pow(3, attempt - 1)); // 1s, 3s, 9s
    }
  }
  return null;
}
// Chamador: se retornar null, setar embedding_status='failed' na memória
```

#### B.6 — Fix do Dry-run — `cleanup-memories.mts`
**Localização:** fase de geração de embeddings (~linha 434)

```typescript
// Antes de chamar embedText, verificar DRY_RUN:
if (!DRY_RUN) {
  mem.embedding = await embedText(mem.content) ?? mem.embedding;
}
// Em dry-run, usar embedding existente (já está no objeto mem)
```

Mesma lógica para `consolidateCluster()`: em dry-run, apenas logar tamanho do cluster e conteúdo, sem chamar o LLM.

#### B.7 — Cron de Hard Delete após 90 dias (LGPD)
**Arquivo:** `worker/src/cron/memoryHardDeleteCron.ts` (novo)

```typescript
// Rodar diariamente às 03:00 BRT
// Busca: archived = true AND archived_at < now() - interval '90 days'
// Hard delete em batches de 100
// Registra em memory_audit_log
```

**Registrar em** `worker/src/runtime.ts` junto aos outros crons.

---

### BLOCO C — Qualidade de Escrita (depende de B)

#### C.1 — Contradiction Guard
**Criar:** `src/ai/clara/contradiction_guard.ts`

```typescript
interface AuthoritativeFact {
  description: string;
  pattern: RegExp;           // detecta menção ao fato
  canonical_value: string;   // valor correto
  // Se memória menciona o padrão com valor DIFERENTE do canonical:
  strict_types: string[];    // nesses memory_types, REJEITA
  soft_types: string[];      // nesses memory_types, ACEITA mas loga aviso
}

const AUTHORITATIVE_FACTS: AuthoritativeFact[] = [
  {
    description: 'Preço consulta padrão',
    pattern: /consulta.*R\$\s*(\d+)|R\$\s*(\d+).*consulta/i,
    canonical_value: 'R$ 500',
    strict_types: ['regra_negocio'],
    soft_types: ['padrao_comportamental'], // aceita "paciente negociou R$400" como padrão
  },
  {
    description: 'Preço retorno',
    pattern: /retorno.*R\$\s*(\d+)|R\$\s*(\d+).*retorno/i,
    canonical_value: 'R$ 200',
    strict_types: ['regra_negocio'],
    soft_types: ['padrao_comportamental'],
  },
  // Adicionar outros fatos críticos conforme necessário
];

export function checkContradiction(content: string, memory_type: string): {
  ok: boolean;
  message?: string;
  severity: 'block' | 'warn' | 'ok';
}
```

**Chamar em** `manage_long_term_memory` em `tools.ts` antes do insert/update, após o quality gate existente.

#### C.2 — Fortalecer Quality Gate — `memory_quality.ts`

**Adicionar regexes de PII:**
```typescript
const RG_REGEX = /\b\d{2}\.?\d{3}\.?\d{3}-?[\dxX]\b/g;
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
// WhatsApp groups — detecta padrões como "Grupo Mamães", "Grp Pediatria"
const WHATSAPP_GROUP_REGEX = /\b(grupo|grp)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][^\n,\.]{3,30}/gi;
```

Adicionar ao chain de `.replace()` em `stripPIIAndReferences()`.

**Elevar mínimo:** linha 52: `if (cleaned.length < 40) return null;`

**Detector de observação individual (substitui PT_VERB_INDICATORS):**
```typescript
// Rejeitar se é claramente uma observação de caso único sem generalização
const SINGLE_CASE_PATTERNS = [
  /^[Pp]aciente\s+\([\w\s]+\)\./,           // "Paciente (zinco baixo)."
  /^[Pp]aciente\s+[A-Z][a-z]+\s/,           // "Paciente João está..."
  /\b(esse|este|esta|essa)\s+paciente\b/i,   // "esse paciente tem..."
  /\bem\s+específico\b/i,
];
for (const p of SINGLE_CASE_PATTERNS) {
  if (p.test(cleaned)) return null;
}
```

> **Por que não usar heurística de verbo:** qualquer texto em pt-BR contém "é", "foi", "tem" — a heurística é ineficaz. Substituída por detecção explícita de caso individual.

#### C.3 — Quality Score — `memory_quality.ts`
**Adicionar função exportada:**

```typescript
export function calculateQualityScore(content: string): number {
  let score = 0;

  // Comprimento (0-25 pts): 40 chars = 0, 200+ chars = 25
  score += Math.min(25, Math.round(((content.length - 40) / 160) * 25));

  // Especificidade clínica (0-30 pts)
  if (/R\$\s*[\d.,]+/.test(content)) score += 10;
  if (/\d+/.test(content)) score += 5;
  if (/\b(consulta|retorno|exame|vacina|protocolo|agenda|encaixe|fila)\b/i.test(content)) score += 15;

  // Completude — múltiplas frases (0-25 pts)
  const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 10);
  score += Math.min(25, sentences.length * 10);

  // Acionabilidade — contém diretriz (0-20 pts)
  if (/\b(deve|sempre|nunca|priorizar|evitar|obrigatório|recomendado|padrão)\b/i.test(content)) score += 20;

  return Math.min(100, Math.max(0, score));
}
```

**Usar em:**
1. Insert/update em `manage_long_term_memory` (tools.ts)
2. Insert em `applyChanges()` (cleanup-memories.mts)

**Backfill necessário:** criar `scripts/backfill-quality-scores.mts` que calcula e salva `quality_score` para todas as memórias existentes com `quality_score IS NULL`.

#### C.4 — Fix da Consolidação LLM — `cleanup-memories.mts` — `consolidateCluster()`

```typescript
// 1. Trocar modelo de 'gemini-3-flash-preview' para 'gemini-2.0-flash'
model: 'gemini-2.0-flash',

// 2. Adicionar instrução de idioma no prompt
'RESPONDA EXCLUSIVAMENTE EM PORTUGUÊS BRASILEIRO.\n\n' + prompt,

// 3. JSON.parse com try/catch separado (já tem, confirmar que está correto)
let parsed: ConsolidatedMemory[];
try {
  parsed = JSON.parse(text);
} catch {
  console.error(`[Consolidation] JSON inválido para cluster de ${cluster.length}. Mantendo originais.`);
  return []; // main() tratará como falha graças ao fix B.2
}

// 4. Validar quality_score dos outputs vs. inputs
const inputAvgScore = cluster.reduce((s, m) => s + calculateQualityScore(m.content), 0) / cluster.length;
const outputAvgScore = valid.reduce((s, m) => s + calculateQualityScore(m.content), 0) / valid.length;
if (outputAvgScore < inputAvgScore * 0.8) {
  console.warn(`[Consolidation] Output de qualidade inferior ao input (${outputAvgScore.toFixed(0)} < ${inputAvgScore.toFixed(0)}). Mantendo originais.`);
  return [];
}
```

#### C.5 — Dedup Pre-Save — VERIFICAÇÃO (não reimplementação)

O upsert semântico já existe em `manage_long_term_memory` (tools.ts linhas 186-208) com threshold 0.80.

**Ação necessária:** apenas verificar que o threshold 0.80 é adequado após calibração (Bloco D). Se calibração indicar threshold ideal abaixo de 0.80, ajustar.

**Adicionar log explícito quando dedup previne insert:**
```typescript
if (matches && matches.length > 0) {
  console.log(`[Dedup] Memória similar encontrada (sim=${(matches[0].similarity * 100).toFixed(0)}%). Fazendo update ao invés de insert.`);
  // ... update existente
}
```

#### C.6 — Redirecionar Audit Inserts — `tools.ts` linha ~1157

```typescript
// ANTES:
await adminSb.from("clara_memories").insert({ content: `[AUDIT] ${logEntry}`, memory_type: "audit_log" });

// DEPOIS:
await adminSb.from("memory_audit_log").insert({
  operation: 'reclassification',
  details: { log: logEntry, chat_id },
});
```

---

### BLOCO D — Qualidade de Leitura (depende de A.2 concluído)

#### D.1 — Calibrar Thresholds
**Pré-requisito:** A.2 (eval script funcionando + golden set criado por Brendo)

**Procedimento:** Rodar `eval-retrieval.mts` com thresholds 0.65, 0.70, 0.75, 0.80.

Atualizar **ambos** os pontos de busca:
- `load_context.ts` linha 50 — busca automática
- `manage_long_term_memory` consulta em `tools.ts` linha ~235 — busca manual

Se F1 não variar significativamente entre valores, adotar **0.72** como default conservador para busca automática e **0.75** para busca manual.

#### D.2 — Re-ranking Pós-busca — `load_context.ts`

**Pré-requisito:** C.3 concluído e backfill executado (quality_score populado).

Alterar RPC para retornar `limit 10` e aplicar re-ranking antes de retornar top 5:

```typescript
// Buscar 10 candidatos
const { data } = await supabase.rpc("match_memories", {
  query_embedding: queryEmbedding,
  match_threshold: calibratedThreshold,
  match_count: 10, // ← era 5
});

// Re-ranking
function rerank(results: MemoryResult[]): MemoryResult[] {
  const now = Date.now();
  return results
    .map(r => {
      const ageDays = (now - new Date(r.updated_at).getTime()) / 86400000;
      const recencyScore = Math.max(0, 1 - (ageDays / 365)); // decai em 1 ano
      const qualityNorm = (r.quality_score ?? 50) / 100;
      // Similarity domina (0.65), quality penaliza vagas (0.25), recência desempata (0.10)
      r.finalScore = (0.65 * r.similarity) + (0.25 * qualityNorm) + (0.10 * recencyScore);
      return r;
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 5);
}
```

> **Pesos ajustados vs. v3:** similarity aumentou de 0.60 para 0.65, recência diminuiu de 0.15 para 0.10. Justificativa: recência já é capturada pelo quality_score de memórias atualizadas. Pesos devem ser revisados após análise dos resultados do eval.

#### D.3 — Atualizar RPC `match_memories` — Migration
**Arquivo:** `supabase/migrations/YYYYMMDD_update_match_memories.sql`

```sql
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.65,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id int,
  content text,
  memory_type text,
  quality_score int,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.content,
    cm.memory_type,
    cm.quality_score,
    cm.updated_at,
    1 - (cm.embedding <=> query_embedding) AS similarity
  FROM clara_memories cm
  WHERE cm.archived = false
    AND 1 - (cm.embedding <=> query_embedding) > match_threshold
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END; $$;
```

#### D.4 — Remover Código Morto — `memoryManager.ts`

Verificar ausência de importações ativas:
```bash
grep -rn "memoryManager\|saveSemanticMemory\|searchSemanticMemory" src/ --include="*.ts"
```

Se nenhuma importação ativa: deletar `src/ai/clara/memoryManager.ts`.

Criar `src/ai/clara/constants.ts`:
```typescript
export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMS = 768;
```

Importar nos três pontos que usam o modelo hardcoded: `load_context.ts`, `cleanup-memories.mts`, `src/ai/vault/semantic.ts`.

---

### BLOCO E — Conexões do Vault (paralelo com C/D)

#### E.1 — Deduplicar Wikilinks
**Onde:** qualquer ponto que gera seção `## Relacionados` (buscar `[[` no codebase)

```typescript
const unique = [...new Set(wikilinks)];
```

#### E.2 — Conexões com Força
Durante vault regen, para cada memória buscar top-5 similares via embedding e classificar:

```typescript
// No frontmatter do arquivo .md gerado:
connections:
  - slug: nome-do-arquivo-relacionado
    strength: forte    # similarity > 0.85
  - slug: outro-arquivo
    strength: media    # similarity 0.70-0.85
// Conexões < 0.70 descartadas
```

---

### BLOCO F — Observabilidade (executar por último)

#### F.1 — Métricas Pós-Consolidação — `cleanup-memories.mts`
Ao final de `main()`, inserir em `memory_audit_log`:
```typescript
await supabase.from('memory_audit_log').insert({
  operation: 'consolidation',
  memories_before: memories.length,
  memories_after: allConsolidated.length,
  clusters_found: multiClusters.length,
  singletons_kept: singletonKept,
  singletons_discarded: singletonDiscarded,
  embedding_failures: countFailures,
  dry_run: DRY_RUN,
  details: { threshold_used: 0.75, model: 'gemini-2.0-flash' },
});
```

#### F.2 — Script de Integridade do Vault
**Criar:** `scripts/vault-integrity.mts`

Verifica:
1. Todos os `.md` em `memories/` têm frontmatter com `type: memory`
2. Todos os `supabase_id` existem em `clara_memories` (por `id` inteiro)
3. Nenhum wikilink aponta para arquivo inexistente
4. Nenhum arquivo contém PII (rodar `stripPIIAndReferences` e comparar)
5. Contagem por categoria bate com os MOC files
6. Zero memórias com `memory_type: 'audit_log'` em `clara_memories`

**Output:** JSON com totais + exit code 1 se qualquer falha.

---

### BLOCO G — Canal de Aprendizado Privilegiado (depende de B + C)

Este bloco permite que Brendo (e futuramente Dra. Fernanda) ensinem a Clara diretamente via conversa, com a Clara atualizando o Tier 1 de forma controlada.

#### G.1 — Trust Levels por Source Role
**Arquivo:** `src/ai/clara/memory_types.ts` — adicionar ao final

```typescript
export type TrustLevel = {
  can_write_tier1: boolean;
  can_write_tier2: boolean;
  allowed_types?: MemoryType[]; // undefined = todos os tipos do tier permitido
};

export const TRUST_LEVELS: Record<string, TrustLevel> = {
  admin: {
    can_write_tier1: true,
    can_write_tier2: true,
    // Pode escrever qualquer tipo, incluindo regra_negocio e protocolo_clinico
  },
  doctor: {
    can_write_tier1: false,
    can_write_tier2: true,
    allowed_types: ['protocolo_clinico', 'conhecimento_medico', 'padrao_comportamental'],
  },
  system: {
    can_write_tier1: false,
    can_write_tier2: true,
  },
  consolidation: {
    can_write_tier1: false,
    can_write_tier2: true,
  },
};
```

**Como identificar admins:** via variável de ambiente ou tabela de configuração no Supabase. Inicialmente, Brendo é identificado por `phone` ou `chat_id` específico definido em `.env.local`:
```
ADMIN_PHONE_NUMBERS=5598XXXXXXXXX,5598XXXXXXXXX
```

O `source_role` é resolvido em `tools.ts` antes de qualquer operação de memória, baseado no `chat_id` da conversa atual.

#### G.2 — Nova Ferramenta `save_authoritative_knowledge`
**Arquivo:** `src/ai/clara/tools.ts` — nova ferramenta no final do arquivo

**Disponível apenas quando** `source_role = 'admin'` (verificação em runtime — se chamada por não-admin, retornar erro imediatamente).

```typescript
// O que a ferramenta faz, em ordem:
// 1. Verifica que source_role === 'admin' (guard obrigatório)
// 2. Apresenta ao admin o que vai ser salvo e em qual tier/tipo — AGUARDA CONFIRMAÇÃO
// 3. Se confirmado:
//    a. Salva no vault: cria/atualiza arquivo em knowledge/operations/ ou memories/{tipo}/
//    b. Insere em clara_memories com quality_score=100, source_role='admin'
//    c. Registra em decisions/ com decided_by='admin', status='active'
//    d. Se novo valor contradiz AUTHORITATIVE_FACTS existente:
//       - Atualiza o canonical_value no Contradiction Guard
//       - Arquiva memórias de Tier 2 conflitantes (archived=true, archive_reason='superseded_by_admin')
// 4. Retorna resumo do que foi salvo para o admin revisar

schema: z.object({
  content: z.string().describe('O conhecimento/regra a ser salvo'),
  memory_type: z.enum([...MEMORY_TYPES]).describe('Categoria'),
  knowledge_file: z.string().optional().describe(
    'Se informado, atualiza também o arquivo em knowledge/operations/. Ex: "qual-o-valor-da-consulta"'
  ),
  supersedes: z.string().optional().describe(
    'Descrição do conhecimento anterior que está sendo substituído. Usado para arquivar memórias conflitantes.'
  ),
})
```

#### G.3 — Detecção de Intenção de Aprendizado

**Arquivo:** `src/ai/clara/soul.ts` ou `src/ai/clara/system_prompt.ts` — adicionar ao prompt do sistema

Quando source_role = 'admin', Clara deve reconhecer as seguintes frases como gatilho para propor uso de `save_authoritative_knowledge`:

```
Gatilhos explícitos:
"aprenda que...", "a partir de agora...", "nova regra:",
"corrija sua memória sobre...", "atualize o valor de...",
"salva isso:", "anota isso:", "lembra que...",
"esquece o que você sabia sobre..."

Gatilhos implícitos (Clara propõe ao admin):
- Admin corrige informação que Clara deu errada
- Admin menciona mudança de processo/preço
- Admin descreve como algo funciona em detalhe
```

**Comportamento de Clara ao detectar gatilho:**
> "Posso salvar isso como conhecimento permanente:
> **[regra_negocio]** 'Encaixe de urgência custa R$300.'
> Isso vai substituir qualquer memória anterior sobre valor de encaixe.
> Confirma? (sim/não/ajustar)"

#### G.4 — Aprendizado Proposto ao Final de Sessão Admin

**Arquivo:** `src/ai/clara/system_prompt.ts` — instrução específica para sessões admin

Ao detectar intenção de encerramento de conversa com admin (frases como "ok, obrigado", "até logo", "pode fechar"), Clara deve verificar se identificou informações novas durante a sessão e propor salvá-las:

> "Antes de encerrar, identifiquei 2 informações novas nessa conversa que posso salvar:
> 1. **[processo_operacional]** Joana deve registrar consultas no sistema imediatamente após confirmação no WhatsApp
> 2. **[regra_negocio]** Desconto para irmãos: 10% na segunda consulta simultânea
>
> Salvo as duas? Quer ajustar alguma antes de confirmar?"

Se admin não quiser nenhuma, Clara descarta silenciosamente.

#### G.5 — Fluxo Completo de Aprendizado por Fonte

```
Fonte              Trust     Tier permitido    Quality gate    Confirmação
─────────────────────────────────────────────────────────────────────────────
Brendo (admin)     máximo    Tier 1 + Tier 2   bypassa*        OBRIGATÓRIA
Dra. Fernanda      alto      Tier 2 restrito   normal          não
Paciente/WhatsApp  nenhum    Tier 2 apenas     completo        não
Sistema/cron       interno   Tier 2 apenas     completo        não
```
*Clara bypassa o quality gate para source_role='admin' mas ainda detecta e avisa sobre PII
("Esse conteúdo parece ter um CPF. Removo antes de salvar?")

---

## 6. Ordem de Execução

```
A (Baseline)     → sem dependências, rodar primeiro
B (Segurança)    → rodar ANTES de qualquer consolidação
C (Escrita)      → depende de B estar deployado
D (Leitura)      → D.1 depende de A.2 (golden set + eval script)
                   D.2 depende de C.3 (quality_score populado)
E (Vault)        → paralelo com C/D
F (Observab.)    → último
G (Aprendizado)  → depende de B + C (trust levels + contradiction guard prontos)
```

---

## 7. Migrations em Ordem de Execução

1. `YYYYMMDD_memory_safety.sql` — soft delete + quality_score + embedding_status + audit_log table (Bloco B)
2. `YYYYMMDD_update_match_memories.sql` — RPC atualizada retornando quality_score e updated_at (Bloco D)

---

## 8. Critérios de Validação por Bloco

| Bloco | Critério |
|---|---|
| A | `audit-supabase.mts` roda e retorna contagens. `eval-retrieval.mts` roda com golden set e retorna precision@5. |
| B | Simular falha mid-consolidação: vault permanece intacto. Memórias antigas ficam `archived=true`, não deletadas. Dry-run não consome API. |
| C | 10 memórias de teste (5 boas, 5 ruins): quality gate aceita as boas, rejeita as ruins. Contradiction guard bloqueia "consulta = R$400" em `regra_negocio`. Audit insert vai para `memory_audit_log`, não para `clara_memories`. |
| D | precision@5 pós-calibração ≥ baseline medido em A.2. Ambos os thresholds (busca automática + manual) atualizados. |
| E | Zero wikilinks duplicados. Todas as conexões têm `strength` atribuído. |
| F | Após consolidação: `memory_audit_log` tem registro. `vault-integrity.mts` roda com exit code 0. |
| G | Admin diz "aprenda que consulta custa R$600": Clara confirma, salva, arquiva memórias conflitantes de Tier 2. Não-admin tenta usar `save_authoritative_knowledge`: recebe erro. |

---

## 9. O que NÃO muda

- Vault continua em `clinica-vault/` — estrutura de pastas, MOCs, temas transversais preservados
- `load_context.ts` mantém execução paralela em Promise.allSettled
- `agents/clara/scratchpad.md` continua como memória de sessão (limpo a cada nova conversa)
- `decisions/` continua sendo escrito via `logDecisionToVault()`
- `knowledge/operations/` pode ser editado manualmente por Brendo **ou** via `save_authoritative_knowledge` pela Clara

---

## 10. Fora de Escopo (próximas iterações)

- Memórias vinculadas a paciente específico via `patient_id` (requer schema de `patients` definido)
- Dashboard de saúde da memória (quality score médio, taxa de duplicatas/semana)
- `last_accessed` / `access_count` para métricas de uso real
- Aprendizado proativo pelo Analyst (Analyst detecta padrão → propõe memória → Brendo aprova)
