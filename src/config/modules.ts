// Configuração centralizada de módulos do sistema
// Cada módulo tem sua identidade visual, schema de banco, e configuração de IA

export interface ModuleTheme {
  // Cores principais (classes Tailwind)
  primary: string;           // 'pink' | 'blue'
  gradientFrom: string;      // ex: 'from-pink-500'
  gradientTo: string;        // ex: 'to-rose-400'
  activeGradient: string;    // ex: 'bg-gradient-to-r from-pink-500 to-rose-400'
  // Bordas e backgrounds
  border: string;            // ex: 'border-pink-100 dark:border-[#27272a]'
  borderAccent: string;      // ex: 'border-pink-200 dark:border-[#2e2e33]'
  bgSubtle: string;          // ex: 'bg-pink-50 dark:bg-pink-900/20'
  bgBlur: string;            // ex: 'bg-pink-100 dark:bg-pink-500'
  hoverBg: string;           // ex: 'hover:bg-pink-50 dark:hover:bg-white/5'
  // Textos
  text: string;              // ex: 'text-pink-400 dark:text-pink-300'
  textBold: string;          // ex: 'text-pink-600 dark:text-pink-400'
  // Shadows
  shadow: string;            // ex: 'shadow-[4px_0_24px_rgba(249,168,212,0.1)]'
  shadowActive: string;      // ex: 'shadow-md shadow-pink-200 dark:shadow-none'
  // Selection
  selectionBg: string;       // ex: 'selection:bg-pink-200 selection:text-pink-900'
  // Sparkles no MenuGroup
  sparkleColor: string;      // ex: 'text-pink-300 dark:text-pink-700'
}

export interface ModuleConfig {
  id: 'pediatria' | 'atendimento' | 'financeiro' | 'comercial' | 'ceo';
  label: string;             // Nome no header da nav
  sublabel: string;          // Badge abaixo do logo
  schema: string;            // Schema PostgreSQL ('public' | 'atendimento' | ...)
  aiAgentId: string;         // ID no agent_config do Supabase
  aiMagicPhone: string;      // Telefone "mágico" para o chat com o agente IA
  aiAgentName: string;       // Nome do agente no chat
  evolutionInstanceEnv: string; // Nome da env var da instância Evolution
  basePath: string;          // Rota base ('/atendimento', '' para pediatria)
  theme: ModuleTheme;
  // Rotas do módulo
  routes: {
    chat: string;            // Rota do chat WhatsApp
    crm: string;             // Rota do CRM
    dashboard: string;       // Rota do dashboard
    agenda: string;          // Rota da agenda
    clients: string;         // Rota de clientes
    financeiro: string;      // Rota financeira
    configuracoes: string;   // Rota de configurações
  };
}

export const PEDIATRIA_CONFIG: ModuleConfig = {
  id: 'pediatria',
  label: 'Centro Médico\nAliança',
  sublabel: 'Pediatria Integrada',
  schema: 'public',
  aiAgentId: 'clara',
  aiMagicPhone: '00000000000',
  aiAgentName: 'Clara',
  evolutionInstanceEnv: 'EVOLUTION_INSTANCE',
  basePath: '',
  theme: {
    primary: 'pink',
    gradientFrom: 'from-pink-500',
    gradientTo: 'to-rose-400',
    activeGradient: 'bg-gradient-to-r from-pink-500 to-rose-400 dark:from-pink-600 dark:to-rose-500',
    border: 'border-pink-100 dark:border-[#27272a]',
    borderAccent: 'border-pink-200 dark:border-pink-800/30',
    bgSubtle: 'bg-pink-50 dark:bg-pink-950/30',
    bgBlur: 'bg-pink-100 dark:bg-pink-500',
    hoverBg: 'hover:bg-pink-50 dark:hover:bg-white/[0.06]',
    text: 'text-pink-400 dark:text-pink-400',
    textBold: 'text-pink-600 dark:text-pink-400',
    shadow: 'shadow-[4px_0_24px_rgba(249,168,212,0.1)]',
    shadowActive: 'shadow-md shadow-pink-200 dark:shadow-lg dark:shadow-pink-500/10',
    selectionBg: 'selection:bg-pink-200 selection:text-pink-900',
    sparkleColor: 'text-pink-300 dark:text-pink-700',
  },
  routes: {
    chat: '/',
    crm: '/crm',
    dashboard: '/dashboard',
    agenda: '/agenda',
    clients: '/clients',
    financeiro: '/financeiro',
    configuracoes: '/configuracoes',
  },
};

export const ATENDIMENTO_CONFIG: ModuleConfig = {
  id: 'atendimento',
  label: 'Centro Médico\nAliança',
  sublabel: 'Sistema Geral da Clínica',
  schema: 'atendimento',
  aiAgentId: 'atendimento_agent',
  aiMagicPhone: '00000000001',
  aiAgentName: 'Agente Clínica',
  evolutionInstanceEnv: 'EVOLUTION_ATENDIMENTO_INSTANCE',
  basePath: '/atendimento',
  theme: {
    primary: 'teal',
    gradientFrom: 'from-teal-500',
    gradientTo: 'to-emerald-400',
    activeGradient: 'bg-gradient-to-r from-teal-500 to-emerald-400 dark:from-teal-600 dark:to-emerald-500',
    border: 'border-teal-100 dark:border-[#27272a]',
    borderAccent: 'border-teal-200 dark:border-teal-800/30',
    bgSubtle: 'bg-teal-50 dark:bg-teal-950/30',
    bgBlur: 'bg-teal-100 dark:bg-teal-500',
    hoverBg: 'hover:bg-teal-50 dark:hover:bg-white/[0.06]',
    text: 'text-teal-500 dark:text-teal-400',
    textBold: 'text-teal-600 dark:text-teal-400',
    shadow: 'shadow-[4px_0_24px_rgba(13,148,136,0.1)]',
    shadowActive: 'shadow-md shadow-teal-200 dark:shadow-lg dark:shadow-teal-500/10',
    selectionBg: 'selection:bg-teal-200 selection:text-teal-900',
    sparkleColor: 'text-teal-300 dark:text-teal-700',
  },
  routes: {
    chat: '/atendimento',
    crm: '/atendimento/crm',
    dashboard: '/atendimento/dashboard',
    agenda: '/atendimento/agenda',
    clients: '/atendimento/clients',
    financeiro: '/atendimento/financeiro',
    configuracoes: '/atendimento/configuracoes',
  },
};

// Mapa de módulos para lookup rápido
export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  pediatria: PEDIATRIA_CONFIG,
  atendimento: ATENDIMENTO_CONFIG,
};

// Detecta o módulo ativo baseado no pathname
export function getModuleFromPathname(pathname: string): ModuleConfig {
  if (pathname.startsWith('/atendimento')) return ATENDIMENTO_CONFIG;
  return PEDIATRIA_CONFIG;
}
