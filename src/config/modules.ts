// Configuração centralizada de módulos do sistema
// Cada módulo tem sua identidade visual, schema de banco, e configuração de IA

export interface ModuleTheme {
  // Cores principais (classes Tailwind)
  primary: string;           // 'pink' | 'blue'
  gradientFrom: string;      // ex: 'from-pink-500'
  gradientTo: string;        // ex: 'to-rose-400'
  activeGradient: string;    // ex: 'bg-gradient-to-r from-pink-500 to-rose-400'
  // Bordas e backgrounds
  border: string;            // ex: 'border-pink-100 dark:border-[#2d2d36]'
  borderAccent: string;      // ex: 'border-pink-200 dark:border-[#3d3d48]'
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
  // Config de attendance (sidebar + screens) — definida em src/config/attendance/
  attendanceConfigKey?: string; // chave no ATTENDANCE_CONFIGS (ex: 'pediatria', 'atendimento')
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
    primary: 'rose',
    gradientFrom: 'from-rose-400',
    gradientTo: 'to-rose-300',
    activeGradient: 'bg-gradient-to-r from-rose-400 to-rose-300 dark:from-rose-400 dark:to-rose-500',
    border: 'border-rose-100 dark:border-[#2a2a30]',
    borderAccent: 'border-rose-200 dark:border-[#35353d]',
    bgSubtle: 'bg-rose-50 dark:bg-white/[0.04]',
    bgBlur: 'bg-rose-100 dark:bg-white/[0.06]',
    hoverBg: 'hover:bg-rose-50 dark:hover:bg-white/[0.04]',
    text: 'text-rose-500 dark:text-rose-400',
    textBold: 'text-rose-600 dark:text-rose-300',
    shadow: 'shadow-[4px_0_24px_rgba(251,113,133,0.06)]',
    shadowActive: 'shadow-md shadow-rose-200/50 dark:shadow-none dark:ring-1 dark:ring-[#35353d]',
    selectionBg: 'selection:bg-rose-100 selection:text-rose-900',
    sparkleColor: 'text-rose-400 dark:text-rose-700',
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
    primary: 'blue',
    gradientFrom: 'from-blue-600',
    gradientTo: 'to-indigo-500',
    activeGradient: 'bg-gradient-to-r from-blue-600 to-indigo-500',
    border: 'border-slate-100 dark:border-[#2a2a30]',
    borderAccent: 'border-blue-200/60 dark:border-[#35353d]',
    bgSubtle: 'bg-blue-50/50 dark:bg-white/[0.04]',
    bgBlur: 'bg-blue-100 dark:bg-white/[0.06]',
    hoverBg: 'hover:bg-slate-50 dark:hover:bg-white/[0.04]',
    text: 'text-blue-600 dark:text-blue-400',
    textBold: 'text-blue-700 dark:text-blue-400',
    shadow: 'shadow-[0_0_20px_rgba(37,99,235,0.04)]',
    shadowActive: 'shadow-sm shadow-blue-200/30 dark:shadow-none dark:ring-1 dark:ring-[#35353d]',
    selectionBg: 'selection:bg-blue-100 selection:text-blue-900',
    sparkleColor: 'text-blue-300 dark:text-blue-800',
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
