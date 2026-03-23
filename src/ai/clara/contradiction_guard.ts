/**
 * Contradiction Guard — protege o Tier 1 (fatos autoritativos) de ser
 * sobrescrito por observações do Tier 2 (padrões aprendidos).
 */

export interface AuthoritativeFact {
  description: string;
  pattern: RegExp;
  canonical_value: string;
  wrong_value_pattern: RegExp;
  strict_types: string[];
  soft_types: string[];
}

export type ContradictionSeverity = 'block' | 'warn' | 'ok';

export interface ContradictionResult {
  ok: boolean;
  severity: ContradictionSeverity;
  message?: string;
  fact?: AuthoritativeFact;
}

export let AUTHORITATIVE_FACTS: AuthoritativeFact[] = [
  {
    description: 'Preço consulta padrão',
    pattern: /consulta\s*(pediatrica|pediátrica|de\s+pediatria)?/i,
    canonical_value: 'R$ 500,00',
    wrong_value_pattern: /R\$\s*(([1-4]\d{2})|([6-9]\d{2})|(\d{4,}))[,.]?\d*/,
    strict_types: ['regra_negocio'],
    soft_types: ['padrao_comportamental', 'processo_operacional'],
  },
  {
    description: 'Preço retorno (a partir de abril/2026)',
    pattern: /retorno/i,
    canonical_value: 'R$ 200,00',
    // Captura qualquer R$ que NÃO seja R$200 (negativo lookahead exclui o canônico)
    wrong_value_pattern: /R\$\s*(?!200(?:[,.]\d+)?\b)(\d+(?:[,.]\d+)?)/,
    strict_types: ['regra_negocio'],
    soft_types: ['padrao_comportamental'],
  },
  {
    description: 'Check-up neonatal / triagem',
    pattern: /(check.?up|check\s*up|neonatal|triagem)/i,
    canonical_value: 'R$ 800,00',
    wrong_value_pattern: /R\$\s*(([1-7]\d{2})|([9]\d{2})|(\d{4,}))[,.]?\d*/,
    strict_types: ['regra_negocio'],
    soft_types: ['padrao_comportamental'],
  },
];

export function upsertAuthoritativeFact(fact: AuthoritativeFact): void {
  const idx = AUTHORITATIVE_FACTS.findIndex(f => f.description === fact.description);
  if (idx >= 0) {
    AUTHORITATIVE_FACTS[idx] = fact;
  } else {
    AUTHORITATIVE_FACTS.push(fact);
  }
}

export function checkContradiction(
  content: string,
  memory_type: string,
  source_role: string = 'system'
): ContradictionResult {
  if (source_role === 'admin') {
    return { ok: true, severity: 'ok' };
  }

  for (const fact of AUTHORITATIVE_FACTS) {
    if (!fact.pattern.test(content)) continue;
    if (!fact.wrong_value_pattern.test(content)) continue;

    if (fact.strict_types.includes(memory_type)) {
      return {
        ok: false,
        severity: 'block',
        message: `Contradição com fato autoritativo: "${fact.description}" = ${fact.canonical_value}. ` +
          `Memórias do tipo '${memory_type}' não podem contradizer fatos de Tier 1. ` +
          `Se este é um valor de exceção/desconto, salve como 'padrao_comportamental' com contexto claro.`,
        fact,
      };
    }

    if (fact.soft_types.includes(memory_type)) {
      return {
        ok: true,
        severity: 'warn',
        message: `⚠️ Aviso: conteúdo menciona valor diferente do canônico para "${fact.description}" (${fact.canonical_value}). Salvo como observação de exceção.`,
        fact,
      };
    }
  }

  return { ok: true, severity: 'ok' };
}
