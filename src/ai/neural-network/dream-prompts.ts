// Clara v2 Neural Network - Dream Prompts
// 4-phase consolidation prompt based on Claude Code's auto_dream.rs
// Each agent "dreams" by reflecting on recent learnings and consolidating memories

import type { AgentId } from './types';
import { AGENT_DEFINITIONS } from './types';

export function buildDreamPrompt(agentId: AgentId): string {
  const definition = AGENT_DEFINITIONS[agentId];

  return `## SONHO DE CONSOLIDACAO — ${definition.name}

Voce esta realizando um SONHO — uma passagem reflexiva sobre suas memorias.
Seu objetivo e sintetizar o que aprendeu recentemente em memorias duraveis e organizadas,
para que sessoes futuras possam se orientar rapidamente.

== FASE 1: ORIENTACAO ==
Entenda o que voce JA sabe antes de criar algo novo.
1. Use vault_search("${agentId}") para ver suas memorias existentes
2. Use search_knowledge_base("${definition.description}") para contexto
3. Anote mentalmente: quais temas voce ja cobriu? O que esta desatualizado?

== FASE 2: COLETAR SINAIS ==
Busque novos aprendizados desde seu ultimo sonho.
1. Use get_daily_kpis dos ultimos 3 dias para detectar mudancas de padroes
2. Use vault_search("decisions") para decisoes recentes da clinica
3. Procure CONTRADICOES: algo que voce sabia mudou? Precos, regras, horarios?
4. NAO leia conversas inteiras. Busque apenas termos especificos que suspeita serem relevantes.

== FASE 3: CONSOLIDAR ==
Para cada novo aprendizado relevante:
1. Use vault_write_memory com o formato OBRIGATORIO:
   memory_type: [regra_negocio|protocolo_clinico|padrao_comportamental|recurso_equipe|processo_operacional]
   content: "**Padrao:** [nome curto]
   **Frequencia:** [alta/media/baixa] — [evidencia]
   **Observacao:** [o que acontece concretamente]
   **Impacto:** [consequencia real para a clinica]
   **Acao recomendada:** [o que fazer quando isso ocorrer]"

2. Se um fato antigo esta ERRADO: crie a versao correta (o sistema detecta contradicoes)
3. Converta datas relativas ("ontem", "semana passada") em absolutas ("02/04/2026")
4. NAO salve fragmentos soltos ("paciente X fez Y") — apenas PADROES generalizaveis

== FASE 4: PODAR ==
Mantenha a qualidade do acervo:
1. Se encontrou memorias duplicadas ou redundantes durante a Fase 1, anote para nao criar mais
2. Foque em qualidade sobre quantidade — 5 memorias excelentes > 20 mediocres
3. Resolva contradicoes: o fato mais recente com evidencia concreta vence

== RESTRICOES ==
- Use APENAS ferramentas de leitura e vault_write_memory
- NAO execute SQL com INSERT/UPDATE/DELETE
- NAO invente dados — se nao encontrou evidencia, nao crie memoria
- NAO salve PII (nomes de pacientes, CPFs, telefones)
- Fuso horario: America/Sao_Paulo (BRT, UTC-3)
- Dados de producao a partir de 21/03/2026

== SEU SETOR ==
${definition.description}
Tabelas que voce monitora: ${definition.schema_access.join(', ')}`;
}
