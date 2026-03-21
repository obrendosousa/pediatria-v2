/**
 * Taxonomia de memórias da Clara — 8 categorias fixas.
 *
 * Substitui o campo memory_type free-text que gerava 113+ categorias fragmentadas.
 * Inclui mapa de migração para re-categorizar memórias legadas.
 */

export const MEMORY_TYPES = [
  "regra_negocio",
  "protocolo_clinico",
  "padrao_comportamental",
  "recurso_equipe",
  "processo_operacional",
  "conhecimento_medico",
  "feedback_melhoria",
  "preferencia_sistema",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_TYPE_DESCRIPTIONS: Record<MemoryType, string> = {
  regra_negocio:
    "Regras de negocio, politicas de preco, convenios aceitos, horarios de funcionamento, valores",
  protocolo_clinico:
    "Protocolos clinicos, procedimentos medicos, calendarios de vacinacao, fluxos de atendimento clinico",
  padrao_comportamental:
    "Padroes recorrentes de pacientes/equipe, objecoes comuns, tendencias de comportamento, reacoes tipicas",
  recurso_equipe:
    "Membros da equipe, papeis, responsabilidades, disponibilidade, escalas, horarios de medicos",
  processo_operacional:
    "Fluxos de trabalho documentados, SOPs, processos de agendamento, processos administrativos",
  conhecimento_medico:
    "Conhecimento medico geral, condicoes de saude, tratamentos, medicamentos, informacoes clinicas",
  feedback_melhoria:
    "Sugestoes de melhoria, gaps identificados, problemas de qualidade, falhas recorrentes, gargalos",
  preferencia_sistema:
    "Preferencias de configuracao do sistema, padroes operacionais, configuracoes de atendimento",
};

/**
 * Mapeamento das 113+ categorias legadas para as 8 novas.
 * Chaves normalizadas (lowercase, underscores).
 */
export const LEGACY_TYPE_MAP: Record<string, MemoryType> = {
  // ── regra_negocio ──
  regra_negocio: "regra_negocio",
  "regra-negocio": "regra_negocio",
  "regra-de-negocio": "regra_negocio",
  regra_de_negocio: "regra_negocio",
  regra_atendimento: "regra_negocio",
  "regra-atendimento": "regra_negocio",
  politica_preco: "regra_negocio",
  "politica-preco": "regra_negocio",
  "politica-de-precos": "regra_negocio",
  politica_de_precos: "regra_negocio",
  politica_clinica: "regra_negocio",
  "politica-clinica": "regra_negocio",
  politica_atendimento: "regra_negocio",
  "politica-atendimento": "regra_negocio",
  politica_comercial: "regra_negocio",
  "politica-comercial": "regra_negocio",
  reajuste_preco: "regra_negocio",
  "reajuste-preco": "regra_negocio",
  valor_consulta: "regra_negocio",
  "valor-consulta": "regra_negocio",
  tabela_precos: "regra_negocio",
  "tabela-precos": "regra_negocio",
  servicos_e_valores: "regra_negocio",
  "servicos-e-valores": "regra_negocio",
  dados_faturamento: "regra_negocio",
  "dados-faturamento": "regra_negocio",
  dados_financeiros: "regra_negocio",
  "dados-financeiros": "regra_negocio",
  dados_fiscais: "regra_negocio",
  "dados-fiscais": "regra_negocio",
  faturamento_especifico: "regra_negocio",
  "faturamento-especifico": "regra_negocio",
  necessidade_fiscal: "regra_negocio",
  "necessidade-fiscal": "regra_negocio",
  historico_financeiro: "regra_negocio",
  "historico-financeiro": "regra_negocio",

  // ── protocolo_clinico ──
  protocolo_clinico: "protocolo_clinico",
  "protocolo-clinico": "protocolo_clinico",
  protocolo_agendamento: "protocolo_clinico",
  "protocolo-agendamento": "protocolo_clinico",
  procedimento_administrativo: "protocolo_clinico",
  "procedimento-administrativo": "protocolo_clinico",

  // ── padrao_comportamental ──
  padrao_comportamental: "padrao_comportamental",
  insight_observador: "padrao_comportamental",
  "insight-observador": "padrao_comportamental",
  reacao_a_preco: "padrao_comportamental",
  "reacao-a-preco": "padrao_comportamental",
  preferencia_paciente: "padrao_comportamental",
  "preferencia-paciente": "padrao_comportamental",
  reacao_paciente: "padrao_comportamental",
  "reacao-paciente": "padrao_comportamental",
  reacao_a_atendimento: "padrao_comportamental",
  "reacao-a-atendimento": "padrao_comportamental",
  reacao_a_atraso: "padrao_comportamental",
  "reacao-a-atraso": "padrao_comportamental",
  reacao_a_disponibilidade: "padrao_comportamental",
  "reacao-a-disponibilidade": "padrao_comportamental",
  reacao_a_especialidade: "padrao_comportamental",
  "reacao-a-especialidade": "padrao_comportamental",
  reacao_a_indisponibilidade: "padrao_comportamental",
  "reacao-a-indisponibilidade": "padrao_comportamental",
  reacao_a_logistica: "padrao_comportamental",
  "reacao-a-logistica": "padrao_comportamental",
  reacao_a_medicamento: "padrao_comportamental",
  "reacao-a-medicamento": "padrao_comportamental",
  reacao_a_processo: "padrao_comportamental",
  "reacao-a-processo": "padrao_comportamental",
  reacao_a_profissional: "padrao_comportamental",
  "reacao-a-profissional": "padrao_comportamental",
  comportamento_paciente: "padrao_comportamental",
  "comportamento-paciente": "padrao_comportamental",
  comportamento_de_agendamento: "padrao_comportamental",
  "comportamento-de-agendamento": "padrao_comportamental",
  perfil_paciente: "padrao_comportamental",
  "perfil-paciente": "padrao_comportamental",
  perfil_comportamental: "padrao_comportamental",
  "perfil-comportamental": "padrao_comportamental",
  perfil_contato: "padrao_comportamental",
  "perfil-contato": "padrao_comportamental",
  perfil_pagamento: "padrao_comportamental",
  "perfil-pagamento": "padrao_comportamental",
  perfil_responsavel: "padrao_comportamental",
  "perfil-responsavel": "padrao_comportamental",
  fidelidade_paciente: "padrao_comportamental",
  "fidelidade-paciente": "padrao_comportamental",
  relacionamento_paciente: "padrao_comportamental",
  "relacionamento-paciente": "padrao_comportamental",
  preferencia_agendamento: "padrao_comportamental",
  "preferencia-agendamento": "padrao_comportamental",
  preferencia_comunicacao: "padrao_comportamental",
  "preferencia-comunicacao": "padrao_comportamental",
  preferencia_medico: "padrao_comportamental",
  "preferencia-medico": "padrao_comportamental",
  preferencia_pagamento: "padrao_comportamental",
  "preferencia-pagamento": "padrao_comportamental",
  interesse_especialidade: "padrao_comportamental",
  "interesse-especialidade": "padrao_comportamental",
  interesse_produto: "padrao_comportamental",
  "interesse-produto": "padrao_comportamental",
  interesse_servico: "padrao_comportamental",
  "interesse-servico": "padrao_comportamental",
  contato_comercial: "padrao_comportamental",
  "contato-comercial": "padrao_comportamental",
  novo_convenio_solicitado: "padrao_comportamental",
  "novo-convenio-solicitado": "padrao_comportamental",
  motivo_consulta: "padrao_comportamental",
  "motivo-consulta": "padrao_comportamental",
  origem_contato: "padrao_comportamental",
  "origem-contato": "padrao_comportamental",
  restricao_comunicacao: "padrao_comportamental",
  "restricao-comunicacao": "padrao_comportamental",

  // ── recurso_equipe ──
  recurso_equipe: "recurso_equipe",
  escala_medica: "recurso_equipe",
  "escala-medica": "recurso_equipe",
  disponibilidade_medica: "recurso_equipe",
  "disponibilidade-medica": "recurso_equipe",
  disponibilidade_clinica: "recurso_equipe",
  "disponibilidade-clinica": "recurso_equipe",
  horario_medico: "recurso_equipe",
  "horario-medico": "recurso_equipe",
  corpo_clinico: "recurso_equipe",
  "corpo-clinico": "recurso_equipe",
  identificacao_atendente: "recurso_equipe",
  "identificacao-atendente": "recurso_equipe",
  atraso_profissional: "recurso_equipe",
  "atraso-profissional": "recurso_equipe",
  situacao_profissional: "recurso_equipe",
  "situacao-profissional": "recurso_equipe",
  status_profissional: "recurso_equipe",
  "status-profissional": "recurso_equipe",
  perfil_atendimento: "recurso_equipe",
  "perfil-atendimento": "recurso_equipe",
  perfil_clinica: "recurso_equipe",
  "perfil-clinica": "recurso_equipe",

  // ── processo_operacional ──
  processo_operacional: "processo_operacional",
  processo_interno: "processo_operacional",
  "processo-interno": "processo_operacional",
  processo_clinica: "processo_operacional",
  "processo-clinica": "processo_operacional",
  processo_atendimento: "processo_operacional",
  "processo-atendimento": "processo_operacional",
  processo_agendamento: "processo_operacional",
  "processo-agendamento": "processo_operacional",
  fluxo_agendamento: "processo_operacional",
  "fluxo-agendamento": "processo_operacional",
  fluxo_atendimento: "processo_operacional",
  "fluxo-atendimento": "processo_operacional",
  logistica_atendimento: "processo_operacional",
  "logistica-atendimento": "processo_operacional",
  logistica_medica: "processo_operacional",
  "logistica-medica": "processo_operacional",
  logistica_paciente: "processo_operacional",
  "logistica-paciente": "processo_operacional",
  status_atendimento: "processo_operacional",
  "status-atendimento": "processo_operacional",

  // ── conhecimento_medico ──
  conhecimento_medico: "conhecimento_medico",
  historico_clinico: "conhecimento_medico",
  "historico-clinico": "conhecimento_medico",
  informacao_clinica: "conhecimento_medico",
  "informacao-clinica": "conhecimento_medico",
  condicao_saude: "conhecimento_medico",
  "condicao-saude": "conhecimento_medico",
  condicao_saude_responsavel: "conhecimento_medico",
  "condicao-saude-responsavel": "conhecimento_medico",
  diagnostico_paciente: "conhecimento_medico",
  "diagnostico-paciente": "conhecimento_medico",
  historico_saude: "conhecimento_medico",
  "historico-saude": "conhecimento_medico",
  historico_saude_responsavel: "conhecimento_medico",
  "historico-saude-responsavel": "conhecimento_medico",
  historico_familiar: "conhecimento_medico",
  "historico-familiar": "conhecimento_medico",
  historico_paciente: "conhecimento_medico",
  "historico-paciente": "conhecimento_medico",
  estoque_medicamento: "conhecimento_medico",
  "estoque-medicamento": "conhecimento_medico",
  alerta_laboratorial: "conhecimento_medico",
  "alerta-laboratorial": "conhecimento_medico",
  status_exame: "conhecimento_medico",
  "status-exame": "conhecimento_medico",
  status_exames: "conhecimento_medico",
  "status-exames": "conhecimento_medico",

  // ── feedback_melhoria ──
  feedback_melhoria: "feedback_melhoria",
  falha_processo: "feedback_melhoria",
  "falha-processo": "feedback_melhoria",
  falha_operacional: "feedback_melhoria",
  "falha-operacional": "feedback_melhoria",
  falha_de_processo: "feedback_melhoria",
  "falha-de-processo": "feedback_melhoria",
  falha_na_comunicacao: "feedback_melhoria",
  "falha-na-comunicacao": "feedback_melhoria",
  falha_no_fluxo: "feedback_melhoria",
  "falha-no-fluxo": "feedback_melhoria",
  falha_atendimento: "feedback_melhoria",
  "falha-atendimento": "feedback_melhoria",
  gargalo_operacional: "feedback_melhoria",
  "gargalo-operacional": "feedback_melhoria",
  gargalo_logistico: "feedback_melhoria",
  "gargalo-logistico": "feedback_melhoria",
  erro_operacional: "feedback_melhoria",
  "erro-operacional": "feedback_melhoria",
  erro_processo: "feedback_melhoria",
  "erro-processo": "feedback_melhoria",
  incidente_atendimento: "feedback_melhoria",
  "incidente-atendimento": "feedback_melhoria",
  tempo_de_resposta: "feedback_melhoria",
  "tempo-de-resposta": "feedback_melhoria",
  alerta_mercado: "feedback_melhoria",
  "alerta-mercado": "feedback_melhoria",
  servico_indisponivel: "feedback_melhoria",
  "servico-indisponivel": "feedback_melhoria",
  comportamento_bot: "feedback_melhoria",
  "comportamento-bot": "feedback_melhoria",
  estrategia_marketing: "feedback_melhoria",
  "estrategia-marketing": "feedback_melhoria",

  // ── preferencia_sistema ──
  preferencia_sistema: "preferencia_sistema",
  comunicacao_direta: "preferencia_sistema",
  "comunicacao-direta": "preferencia_sistema",
  contato_endereco: "preferencia_sistema",
  "contato-endereco": "preferencia_sistema",
  documentacao: "preferencia_sistema",

  // ── Dados de pacientes individuais → padrao_comportamental (serão filtrados pelo quality gate) ──
  dados_paciente: "padrao_comportamental",
  "dados-paciente": "padrao_comportamental",
  dados_cadastrais: "padrao_comportamental",
  "dados-cadastrais": "padrao_comportamental",
  dados_cadastrais_paciente: "padrao_comportamental",
  "dados-cadastrais-paciente": "padrao_comportamental",
  dados_usuario: "padrao_comportamental",
  "dados-usuario": "padrao_comportamental",
  dados_dependente: "padrao_comportamental",
  "dados-dependente": "padrao_comportamental",
  dados_familiares: "padrao_comportamental",
  "dados-familiares": "padrao_comportamental",
  cadastro_paciente: "padrao_comportamental",
  "cadastro-paciente": "padrao_comportamental",
  identificacao_paciente: "padrao_comportamental",
  "identificacao-paciente": "padrao_comportamental",
  informacao_paciente: "padrao_comportamental",
  "informacao-paciente": "padrao_comportamental",
  endereco_paciente: "padrao_comportamental",
  "endereco-paciente": "padrao_comportamental",
  localizacao_paciente: "padrao_comportamental",
  "localizacao-paciente": "padrao_comportamental",
  contexto_familiar: "padrao_comportamental",
  "contexto-familiar": "padrao_comportamental",
  perfil_familiar: "padrao_comportamental",
  "perfil-familiar": "padrao_comportamental",
  dependente_paciente: "padrao_comportamental",
  "dependente-paciente": "padrao_comportamental",
  paciente_dependente: "padrao_comportamental",
  "paciente-dependente": "padrao_comportamental",
  necessidade_paciente: "padrao_comportamental",
  "necessidade-paciente": "padrao_comportamental",
};

/**
 * Mapeia um tipo legado para a nova taxonomia.
 * Normaliza para lowercase e tenta com underscores e hifens.
 */
export function mapLegacyType(legacyType: string): MemoryType {
  const normalized = legacyType.toLowerCase().trim();

  // Tenta direto
  if (LEGACY_TYPE_MAP[normalized]) return LEGACY_TYPE_MAP[normalized];

  // Tenta com hifens → underscores
  const withUnderscores = normalized.replace(/-/g, "_");
  if (LEGACY_TYPE_MAP[withUnderscores]) return LEGACY_TYPE_MAP[withUnderscores];

  // Tenta com underscores → hifens
  const withHyphens = normalized.replace(/_/g, "-");
  if (LEGACY_TYPE_MAP[withHyphens]) return LEGACY_TYPE_MAP[withHyphens];

  // Se já é um dos tipos válidos, retorna direto
  if ((MEMORY_TYPES as readonly string[]).includes(normalized)) {
    return normalized as MemoryType;
  }

  // Fallback
  return "padrao_comportamental";
}
