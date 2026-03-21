/**
 * Quality Gate para memórias da Clara.
 *
 * Garante que apenas padrões generalizáveis são salvos,
 * filtrando PII, referências individuais e observações não-reutilizáveis.
 */

// ═══════════════════════════════════════════════════════════════════════════
// PII / REFERENCE STRIPPING
// ═══════════════════════════════════════════════════════════════════════════

const INSIGHT_PREFIX_REGEX = /^Insight Validado \(Chat \d+\):\s*/i;
const CHAT_ID_REGEX = /\b[Cc]hat\s*#?\s*\d+\b/g;
const PHONE_REGEX = /\(?\+?\d{1,3}\)?\s*\d{2,5}[\s-]?\d{4,5}[\s-]?\d{4}/g;
const CPF_REGEX = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Remove nomes próprios que aparecem após descritores de papel.
 * Ex: "paciente Maria Silva" → "paciente"
 *     "mãe Ana Luiza" → "mãe"
 */
const NAME_AFTER_ROLE_REGEX =
  /\b(paciente|cliente|mae|mãe|pai|responsavel|responsável|acompanhante|doutor|doutora|dra?\.?)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+(\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+)*/gi;

/**
 * Remove PII e referências específicas de um texto de memória.
 * Retorna o texto limpo, ou null se o resultado for muito curto/vazio.
 */
export function stripPIIAndReferences(text: string): string | null {
  let cleaned = text
    // Remover prefixo "Insight Validado (Chat NNN):"
    .replace(INSIGHT_PREFIX_REGEX, "")
    // Remover referências a chat IDs
    .replace(CHAT_ID_REGEX, "")
    // Remover telefones
    .replace(PHONE_REGEX, "")
    // Remover CPFs
    .replace(CPF_REGEX, "")
    // Remover e-mails
    .replace(EMAIL_REGEX, "")
    // Remover nomes próprios após descritores de papel
    .replace(NAME_AFTER_ROLE_REGEX, (match) => {
      // Mantém apenas o descritor (paciente, mãe, etc.)
      return match.split(/\s+/)[0];
    })
    // Limpar espaços duplos
    .replace(/\s{2,}/g, " ")
    .trim();

  // Se ficou muito curto, não vale salvar
  if (cleaned.length < 20) return null;

  return cleaned;
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERALIZABILITY CHECK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifica se o conteúdo é um padrão generalizável (não uma observação individual).
 * Retorna true se o conteúdo é generalizável e vale salvar.
 */
export function isGeneralizablePattern(content: string): boolean {
  // Rejeitar se contém referência a chat específico
  if (/\bchat\s*#?\s*\d+/i.test(content)) return false;

  // Rejeitar se contém data específica no formato DD/MM/YYYY ou DD/MM
  if (/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/.test(content)) return false;

  // Rejeitar se é claramente sobre um evento individual recente
  const individualEventPatterns = [
    /\b(hoje|ontem|amanhã)\s+(o|a)\s+(paciente|cliente)/i,
    /\bagendou\s+(para|em)\s+(o dia|dia)?\s*\d/i,
    /\b(no dia|em)\s+\d{1,2}\s+de\s+\w+/i,
    /\butiliza\s+o\s+e-?mail\b/i,
    /\breside\s+em\s+[A-Z]/i,
    /\bmora\s+em\s+[A-Z]/i,
  ];

  for (const pattern of individualEventPatterns) {
    if (pattern.test(content)) return false;
  }

  return true;
}
