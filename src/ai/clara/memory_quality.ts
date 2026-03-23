/**
 * Quality Gate para memórias da Clara.
 *
 * Garante que apenas padrões generalizáveis são salvos,
 * filtrando PII, referências individuais e observações não-reutilizáveis.
 * Inclui cálculo de quality_score (0-100).
 */

// ═══════════════════════════════════════════════════════════════════════════
// PII / REFERENCE STRIPPING
// ═══════════════════════════════════════════════════════════════════════════

const INSIGHT_PREFIX_REGEX = /^Insight Validado \(Chat \d+\):\s*/i;
const CHAT_ID_REGEX = /\b[Cc]hat\s*#?\s*\d+\b/g;
const PHONE_REGEX = /\(?\+?\d{1,3}\)?\s*\d{2,5}[\s-]?\d{4,5}[\s-]?\d{4}/g;
const CPF_REGEX = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const RG_REGEX = /\b\d{2}\.?\d{3}\.?\d{3}-?[\dxX]\b/g;
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
const WHATSAPP_GROUP_REGEX = /\b(grupo|grp)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][^\n,\.]{3,30}/gi;

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
    .replace(INSIGHT_PREFIX_REGEX, "")
    .replace(CHAT_ID_REGEX, "")
    .replace(PHONE_REGEX, "")
    .replace(CPF_REGEX, "")
    .replace(EMAIL_REGEX, "")
    .replace(RG_REGEX, "")
    .replace(CNPJ_REGEX, "")
    .replace(WHATSAPP_GROUP_REGEX, "")
    .replace(NAME_AFTER_ROLE_REGEX, (match) => match.split(/\s+/)[0])
    .replace(/\s{2,}/g, " ")
    .trim();

  // Mínimo 40 chars após limpeza (era 20 — aumentado para qualidade)
  if (cleaned.length < 40) return null;

  return cleaned;
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERALIZABILITY CHECK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Padrões que indicam observação individual, não generalizável.
 * Substituem a heurística de verbo (que era ineficaz em pt-BR).
 */
const SINGLE_CASE_PATTERNS = [
  /^[Pp]aciente\s+\([\w\s]+\)\./,              // "Paciente (zinco baixo)."
  /^[Pp]aciente\s+[A-Z][a-z]+\s/,              // "Paciente João está..."
  /\b(esse|este|esta|essa)\s+paciente\b/i,      // "esse paciente tem..."
  /\b(o|a)\s+paciente\s+(especifico|específico|em\s+questão)\b/i,
  /\butiliza\s+o\s+e-?mail\b/i,
  /\breside\s+em\s+[A-Z]/i,
  /\bmora\s+em\s+[A-Z]/i,
];

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
  ];

  for (const pattern of individualEventPatterns) {
    if (pattern.test(content)) return false;
  }

  // Rejeitar padrões de caso único
  for (const pattern of SINGLE_CASE_PATTERNS) {
    if (pattern.test(content)) return false;
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY SCORE (0-100)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula um score de qualidade 0-100 para uma memória.
 *
 * Critérios:
 * - Comprimento (0-25 pts): 40 chars=0, 200+ chars=25
 * - Especificidade clínica (0-30 pts): preços, procedimentos
 * - Completude — múltiplas frases (0-25 pts)
 * - Acionabilidade — contém diretriz clara (0-20 pts)
 */
export function calculateQualityScore(content: string): number {
  let score = 0;

  // Comprimento (0-25 pts)
  score += Math.min(25, Math.round(((content.length - 40) / 160) * 25));

  // Especificidade clínica (0-30 pts)
  if (/R\$\s*[\d.,]+/.test(content)) score += 10;
  if (/\d+/.test(content)) score += 5;
  if (/\b(consulta|retorno|exame|vacina|protocolo|agenda|encaixe|fila|triagem|neonatal)\b/i.test(content)) score += 15;

  // Completude — múltiplas frases (0-25 pts)
  const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 10);
  score += Math.min(25, sentences.length * 10);

  // Acionabilidade — contém diretriz (0-20 pts)
  if (/\b(deve|sempre|nunca|priorizar|evitar|obrigatório|obrigatorio|recomendado|padrão|padrao)\b/i.test(content)) score += 20;

  return Math.min(100, Math.max(0, score));
}

/**
 * Aplica o pipeline completo de qualidade:
 * 1. Strip PII
 * 2. Verifica generalizabilidade
 * 3. Calcula score
 *
 * Retorna null se a memória deve ser rejeitada.
 * Retorna { cleaned, score } se aprovada.
 */
export function applyQualityPipeline(content: string): { cleaned: string; score: number } | null {
  const cleaned = stripPIIAndReferences(content);
  if (!cleaned) return null;
  if (!isGeneralizablePattern(cleaned)) return null;
  const score = calculateQualityScore(cleaned);
  return { cleaned, score };
}
