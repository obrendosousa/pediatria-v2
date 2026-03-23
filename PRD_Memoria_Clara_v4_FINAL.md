# PRD v4 FINAL — Sistema de Memória da Clara
**Pediatria v2 · Clínica Aliança Kids · Março 2026**
**Autor:** Brendo Sousa | Resolve IA
**Status:** Arquitetura definida — pronto para implementação

---

## 1. Missão

Clara é a IA da Clínica Aliança Kids. Sua missão é **aumentar o faturamento e a margem de lucro** da empresa:

- Conhecer a empresa de ponta a ponta (preços, processos, equipe, protocolos)
- Aprender padrões reais de comportamento de pacientes e responsáveis
- Detectar proativamente: perdas de receita, gargalos, oportunidades de melhoria
- Ser mais precisa que funcionários humanos em informações operacionais
- Conectar informações entre si para gerar insights que nenhum funcionário conseguiria sozinho

---

## 2. Problema Central

O sistema anterior tinha dois problemas fundamentais:

**Problema 1 — Poluição de memória**
Uma conversa onde Joana oferece desconto de R$400 podia fazer Clara "aprender" que a consulta custa R$400. Observações individuais tinham o mesmo peso que regras da empresa.

**Problema 2 — Memórias isoladas**
Supabase armazenava memórias como linhas independentes numa tabela flat. Clara sabia que "retorno custa R$200" e que "Dra. Fernanda agenda retorno na consulta" — mas não sabia que os dois fatos estão conectados. Quando a pergunta chegava, ela buscava por similaridade semântica e devolvia fragmentos soltos, sem contexto.

**A solução é uma base de conhecimento em grafo, não uma tabela flat.**

---

## 3. Decisão de Arquitetura

### 3.1 Vault Local = Única Fonte de Verdade de Memórias

A memória da Clara vive **100% em arquivos `.md` locais** (`clinica-vault/`). Não existe tabela `clara_memories` no Supabase.

**Por quê isso funciona:**
- Com ~750–2000 arquivos, busca vetorial local (cosine similarity em Node.js) leva <30ms
- Sem dependência de rede para acessar memórias
- Sem dual-write, sem drift, sem migration SQL para manter
- O grafo de conexões (wikilinks) vive nos arquivos .md — Brendo navega no Obsidian
- Embeddings ficam em `.memory-index.json` (arquivo único, não nos `.md`)

**Os embeddings ficam em `clinica-vault/.memory-index.json` (NÃO no frontmatter):**

Separar embeddings dos `.md` resolve dois problemas: Obsidian não trava com arrays de 768 floats no painel de Properties; e se o modelo de embedding mudar, o backfill recalcula sem tocar nos arquivos.

O `.md` fica limpo:
```yaml
---
type: memory
memory_type: regra_negocio
quality_score: 92
connections:
  - slug: regra_negocio/retorno-dra-fernanda-agenda-consulta
    strength: forte
  - slug: processo_operacional/sistema-ordem-chegada-0830
    strength: media
updated_at: '2026-03-23T10:00:00.000Z'
---
Consultas pediátricas custam R$ 500,00. Retornos custam R$ 200,00 a partir de abril/2026.

## Relacionados
- [[regra_negocio/retorno-dra-fernanda-agenda-consulta]] (forte)
- [[processo_operacional/sistema-ordem-chegada-0830]] (media)
```

O `.memory-index.json` contém entries (metadados) + mapa `slug → embedding[]`:
```json
{
  "version": 1,
  "built_at": "2026-03-23T...",
  "entries": [{ "slug": "regra_negocio/consulta-r500", "content": "...", "memory_type": "regra_negocio", "quality_score": 92, "connections": [...], "updated_at": "..." }],
  "embeddings": { "regra_negocio/consulta-r500": [0.023, -0.114, ...] }
}
```

### 3.2 Supabase = Apenas Dados Operacionais

O Supabase fica com o que é exclusivamente dele:

```
Supabase                          Vault Local
────────────────────              ─────────────────────────────
chats                             memories/          ← MEMÓRIA DA CLARA
messages                          agents/clara/      ← IDENTIDADE E REGRAS
appointments                      knowledge/         ← GABARITOS
patients                          decisions/         ← LOG DE DECISÕES
knowledge_base                    agents/clara/
clara_reports                       scratchpad.md
chat_notes
```

### 3.3 Busca = Vetorial + Grafo (GraphRAG)

```
QUERY DO USUÁRIO
      │
      ▼
[1] Gera embedding da query (API Gemini)
      │
      ▼
[2] Cosine similarity local contra todos os .md
    → top 3 seeds (mais similares)
      │
      ▼
[3] Expande pelo grafo: lê wikilinks strength='forte' de cada seed
    → vizinhos diretos (1 hop)
      │
      ▼
[4] Retorna seeds + vizinhos (max 8, deduplicados, ordenados por score)
      │
      ▼
[5] Clara responde com contexto conectado, não fragmentado
```

**Exemplo concreto:**
> Query: "paciente quer remarcar retorno"
>
> Busca vetorial encontra seed: *"Retornos custam R$200 a partir de abril/2026"*
>
> Grafo expande para vizinhos fortes:
> - *"Retorno não é agendado via chat — orientar paciente a remarcar na consulta"*
> - *"Dra. Fernanda agenda retornos presencialmente, não por WhatsApp"*
>
> Clara responde com os 3 fatos conectados → resposta completa, não fragmentada.

---

## 4. Arquitetura de Memórias

### 4.1 Dois Tiers

**Tier 1 — Conhecimento Autoritativo (imutável pela Clara)**
Regras da empresa que nunca podem ser sobrescritas por observações de conversas.

```
clinica-vault/
  agents/clara/company.md          ← contexto da empresa
  agents/clara/rules.md            ← regras operacionais
  knowledge/operations/*.md        ← Q&A gabaritos
  memories/regra_negocio/          ← preços, políticas
  memories/protocolo_clinico/      ← protocolos médicos
  memories/recurso_equipe/         ← equipe e disponibilidade
```

Escrita: **apenas Brendo via `save_authoritative_knowledge`**, com confirmação explícita.

**Tier 2 — Padrões Aprendidos (Clara pode escrever)**
Observações generalizáveis derivadas de conversas reais.

```
clinica-vault/memories/
  padrao_comportamental/           ← reações de pacientes
  processo_operacional/            ← fluxos identificados
  feedback_melhoria/               ← gaps e problemas
  conhecimento_medico/             ← observações clínicas
  preferencia_sistema/             ← preferências operacionais
```

Escrita: Clara pode escrever com **quality gate completo** (40+ chars, sem PII, padrão generalizável, sem contradição com Tier 1).

### 4.2 Fontes de Aprendizado por Canal

```
Canal                 Trust Level    Pode escrever em
──────────────────────────────────────────────────────
Brendo (admin)        ALTO           Tier 1 + Tier 2
Dra. Fernanda         MÉDIO          protocolo_clinico, conhecimento_medico
Conversas pacientes   BAIXO          Tier 2 apenas (com quality gate)
```

### 4.3 Memória de Curto Prazo vs Longo Prazo

```
CURTO PRAZO (por sessão/chat)
  └── chat_notes (Supabase)         ← notas por paciente (chat_id único)
  └── agents/clara/scratchpad.md    ← contexto de sessões ADMIN apenas
                                       NÃO injetado em chats de pacientes

LONGO PRAZO (permanente)
  └── memories/**/*.md              ← padrões generalizáveis
  └── decisions/*.md                ← decisões registradas
```

**Regra do scratchpad:** injetado no contexto somente quando `chatId === 0` ou `chatId === -1` (sessão interna/admin). Chats de pacientes usam exclusivamente `chat_notes` para contexto individual — evita mistura de contexto entre conversas simultâneas.

---

## 5. Quality Gate (Anti-Poluição)

Toda memória que Clara tenta salvar no Tier 2 passa por 4 filtros em sequência:

```
[1] Strip PII
    Remove: CPF, RG, CNPJ, telefone, email, nome após papel,
    grupos WhatsApp. Se restar <40 chars → REJEITAR.

[2] Generalização
    Rejeitar se: data específica, chat ID, "esse paciente",
    "hoje o paciente agendou para...". Deve ser padrão
    aplicável a múltiplos casos.

[3] Contradiction Guard
    Se mencionar preço/serviço: verificar contra fatos
    autoritativos do Tier 1.
    - Tier 1 (regra_negocio): BLOQUEAR se contradiz
    - Tier 2 (padrao_comportamental): ACEITAR com aviso
      "salvo como exceção/observação"

[4] Quality Score (0-100)
    Comprimento (0-25) + especificidade clínica (0-30) +
    completude/frases (0-25) + acionabilidade (0-20).
    Score salvo no frontmatter para re-ranking futuro.
```

### 5.1 Fatos Autoritativos (Contradiction Guard)

| Fato | Valor Canônico | Tipo Estrito |
|------|----------------|--------------|
| Consulta padrão | R$ 500,00 | regra_negocio |
| Retorno (abr/2026+) | R$ 200,00 | regra_negocio |
| Check-up neonatal | R$ 800,00 | regra_negocio |

Atualizar via `save_authoritative_knowledge` — requer confirmação do admin.

---

## 6. Canal de Aprendizado do Admin (Brendo)

Clara pode aprender diretamente em conversa com Brendo:

**Trigger phrases:**
> "aprenda que...", "a partir de agora...", "nova regra:", "corrija sua memória sobre...", "atualize o valor de...", "salva isso:"

**Fluxo:**
```
Brendo: "a partir de agora encaixe de urgência custa R$300"
Clara:  "Entendido. Vou salvar como regra definitiva:
         [regra_negocio] Encaixe de urgência = R$300.
         Confirma?"
Brendo: "sim"
Clara:  → save_authoritative_knowledge()
        → Atualiza Contradiction Guard
        → Arquiva memórias contraditórias
        → Registra em decisions/
```

**Regra de ouro:** Clara NUNCA executa `save_authoritative_knowledge` sem confirmação explícita.

---

## 7. Re-ranking de Resultados

Após busca vetorial + expansão de grafo, os resultados são ordenados por score composto:

```
finalScore = 0.65 × similarity
           + 0.25 × (quality_score / 100)
           + 0.10 × recencyScore

recencyScore = max(0, 1 − ageDays / 365)   ← usa entry.updated_at do índice
```

- **Similarity (65%):** sinal mais forte — semântica da query
- **Quality (25%):** penaliza memórias vagas ou fragmentadas
- **Recência (10%):** desempata — preços atualizados têm vantagem

O campo `updated_at` está presente em todas as entries do índice (obrigatório no `MemoryEntry`).

---

## 8. Spec de Implementação

### Bloco A — Busca Local (núcleo)

**A.1 — Cache de embeddings em memória**
Arquivo: `src/ai/vault/memory-index.ts` (criado)

```
- Singleton que lê clinica-vault/.memory-index.json no startup (lazy load)
- Fallback: se .memory-index.json não existir, escaneia .md sem embeddings
- Índice em memória: { slug, path, content, memory_type, quality_score,
  connections, updated_at }  ← updated_at incluído para re-ranking
- Embeddings separados: Record<slug, float[]> (não nos .md)
- Expõe: search(queryEmbedding, topK) + graphExpand(seedSlugs, maxTotal)
- invalidate() força reload; rebuild() reconstrói a partir dos .md
```

**A.2 — Expansão de grafo**
Arquivo: `src/ai/vault/memory-index.ts`

```
- graphExpand(seedSlugs: string[], maxTotal: 8) → MemoryEntry[]
- Slug = path relativo dentro de memories/, sem extensão .md
  Ex: "regra_negocio/consulta-pediatrica-custa-r500"
- Lê frontmatter.connections onde strength='forte' (1 hop apenas)
- Deduplicação: Set de slugs visitados
- Limite: max 8 resultados totais (seeds + vizinhos)
```

**A.3 — Atualizar load_context.ts**
Arquivo: `src/ai/clara/load_context.ts`

```
Substituir chamada RPC match_memories por:
1. embedQuery(userMessage)
2. memoryIndex.search(embedding, topK=3)   → seeds
3. memoryIndex.graphExpand(seeds, hops=1) → vizinhos
4. rerank(seeds + vizinhos)               → top 8
5. return contents
```

### Bloco B — Escrita Local

**B.1 — Salvar memória no vault**
Arquivo: `src/ai/clara/tools.ts`, função `manageLongTermMemoryTool`

```
1. Quality pipeline (strip PII + generalizability + score)
2. Contradiction guard
3. Trust level check
4. Gerar embedding (API Gemini)
5. Calcular connections (cosine similarity vs índice local, threshold 0.75)
6. Escrever .md com frontmatter completo (incluindo embedding)
7. Invalidar cache do memory-index
8. Dedup: se similarity ≥ 0.80 com arquivo existente → update, não insert
```

**B.2 — save_authoritative_knowledge**
Arquivo: `src/ai/clara/tools.ts`

```
(já implementado — apenas adaptar para escrever .md local em vez de Supabase)
```

### Bloco C — Manutenção

**C.1 — Consolidação semanal**
Arquivo: `worker/src/cron/memoryCrons.ts`

```
Substituir lógica de Supabase por:
1. Ler todos os .md de memories/
2. Clustering por cosine similarity (threshold 0.75)
3. Para clusters >1: LLM consolida (gemini-2.0-flash, pt-BR obrigatório)
4. Validar quality output vs input
5. Se melhorou: substituir arquivo antigo pelo consolidado
6. Se piorou: manter original
```

**C.2 — Regenerar connections**
Parte do C.1 — após consolidação, recalcular wikilinks de todos os arquivos modificados.

### Bloco D — Scripts Operacionais

| Script | Função |
|--------|--------|
| `scripts/audit-vault.mts` | Conta arquivos, detecta PII, broken links, orphans |
| `scripts/eval-retrieval.mts` | Mede precision@5 com golden set de 50 queries |
| `scripts/backfill-embeddings.mts` | Gera embedding para .md que não têm ainda |
| `scripts/build-connections.mts` | Reconstrói todos os wikilinks do vault |
| `scripts/vault-integrity.mts` | Verifica integridade completa (frontmatter, connections, duplicatas) |

### Bloco E — Remoção do clara_memories

```
1. Remover tabla clara_memories do Supabase (após confirmar que vault está completo)
2. Remover RPC match_memories
3. Remover migration 20260323_memory_safety.sql (não aplicar)
4. Remover migration 20260323_update_match_memories.sql (não aplicar)
5. Remover syncMemoryToVault() calls de tools.ts (vault É a fonte)
6. Remover scripts/seed-from-vault.mts (não precisa mais)
7. Remover scripts/backfill-quality-scores.mts (score fica no .md)
```

---

## 9. Ordem de Execução

```
1. Bloco D   (backfill-embeddings.mts) — gera embeddings p/ .md existentes
                                          e cria .memory-index.json
2. Bloco D   (build-connections.mts)   — calcula wikilinks entre memórias
3. Bloco A.1 (memory-index.ts)         — singleton já pode carregar o índice
4. Bloco A.2 (graphExpand)             — expansão de grafo funcional
5. Bloco A.3 (load_context.ts)         — Clara usa vault em vez de Supabase
6. Bloco B.1 (tools.ts)                — Clara escreve localmente
7. Bloco C.1 (memoryCrons.ts)          — manutenção semanal migrada
8. Bloco E   (remoção Supabase)        — após validar Blocos A+B funcionando
```

**Crítico:** passos 1 e 2 devem rodar ANTES de qualquer teste da Clara. Sem `.memory-index.json` populado, o índice carrega vazio e a busca retorna zero resultados.

---

## 10. Critérios de Validação

| Bloco | Critério |
|-------|----------|
| A.1 | `memoryIndex.search("valor consulta", 5)` retorna resultado em <50ms |
| A.2 | Seed com 2 wikilinks fortes retorna seed + 2 vizinhos |
| A.3 | Clara responde "quanto custa consulta?" usando memória local (sem Supabase) |
| B.1 | Salvar "Pacientes aceitam reajuste quando explicado" → arquivo .md criado com embedding e connections |
| B.2 | "aprenda que encaixe custa R$300" → confirmação → arquivo atualizado + decision registrada |
| C.1 | Cluster de 3 memórias similares → 1 arquivo consolidado, 2 antigos removidos |
| E   | clara_memories deletada → Clara ainda responde corretamente a 50 queries do golden set |

---

## 11. O Que NÃO Muda

- Supabase continua como fonte de dados operacionais (chats, pacientes, agendamentos, financeiro)
- Clara ainda acessa Supabase para análises (execute_sql, get_volume_metrics, etc.)
- Chat notes continuam no Supabase (por chat_id, não são memórias generalizáveis)
- Knowledge base (Q&A gabaritos) fica **apenas no Supabase** (tabela `knowledge_base`). A pasta `knowledge/operations/` no vault é **read-only para visualização no Obsidian**, gerada automaticamente — nunca editada diretamente. Fonte de verdade = Supabase.
- Toda a lógica de relatórios, agendamentos e comunicação com pacientes — sem alteração

---

## 12. Comparativo Antes / Depois

| Aspecto | Antes (v3) | Depois (v4 Final) |
|---------|------------|-------------------|
| Onde ficam as memórias | Supabase + vault (dual-write) | Vault local (única fonte) |
| Busca semântica | pgvector via rede | Cosine similarity local (<30ms) |
| Conexões entre memórias | Não existiam | Wikilinks com força forte/media |
| Contexto retornado | 5 fatos isolados | Seeds + vizinhos conectados |
| Memória aprende preço errado | Possível (sem guard) | Bloqueado (Contradiction Guard) |
| Admin pode ensinar Clara | Só editando arquivos | Conversa natural + confirmação |
| Dependência de rede p/ memória | Sim | Não |
| Drift entre vault e Supabase | Possível | Impossível (só um lugar) |
