'use client';

import { ElementType } from 'react';
import {
  Bot,
  Brain,
  Database,
  Search,
  BookOpen,
  PenLine,
  BookmarkPlus,
  Sparkles,
  Table2,
  Map,
  Layers,
  FileSearch,
  ClipboardList,
  CheckCircle2,
  FileText,
} from 'lucide-react';

type StatusConfig = {
  Icon: ElementType;
  label: string;
  iconBg: string;
  dotColor: string;
  iconAnimation: 'spin' | 'bounce' | 'pulse';
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  // ── Estado base ───────────────────────────────────────────────────────────
  thinking: {
    Icon: Sparkles,
    label: 'Clara está pensando...',
    iconBg: 'from-violet-500 to-purple-600',
    dotColor: 'bg-violet-400',
    iconAnimation: 'pulse',
  },
  typing: {
    Icon: Bot,
    label: 'Clara está escrevendo...',
    iconBg: 'from-blue-500 to-cyan-500',
    dotColor: 'bg-blue-400',
    iconAnimation: 'pulse',
  },

  // ── Deep Research — nós do grafo (Efeito Cursor) ──────────────────────────
  planning: {
    Icon: ClipboardList,
    label: 'Criando plano de pesquisa...',
    iconBg: 'from-fuchsia-500 to-pink-600',
    dotColor: 'bg-fuchsia-400',
    iconAnimation: 'pulse',
  },
  executing_step: {
    Icon: Layers,
    label: 'Executando passo do plano...',
    iconBg: 'from-amber-500 to-orange-600',
    dotColor: 'bg-amber-400',
    iconAnimation: 'spin',
  },
  step_done: {
    Icon: CheckCircle2,
    label: 'Passo concluído, consolidando...',
    iconBg: 'from-lime-500 to-green-600',
    dotColor: 'bg-lime-400',
    iconAnimation: 'pulse',
  },
  writing_report: {
    Icon: FileText,
    label: 'Redigindo relatório final...',
    iconBg: 'from-blue-500 to-indigo-600',
    dotColor: 'bg-blue-400',
    iconAnimation: 'pulse',
  },

  // ── Deep Research — ferramentas especializadas ────────────────────────────
  'tool:deep_research_chats': {
    Icon: Map,
    label: 'Processando conversas em lote (Map-Reduce)...',
    iconBg: 'from-rose-500 to-pink-600',
    dotColor: 'bg-rose-400',
    iconAnimation: 'spin',
  },
  'tool:get_filtered_chats_list': {
    Icon: FileSearch,
    label: 'Buscando conversas no banco de dados...',
    iconBg: 'from-cyan-500 to-blue-600',
    dotColor: 'bg-cyan-400',
    iconAnimation: 'spin',
  },
  'tool:get_chat_cascade_history': {
    Icon: Layers,
    label: 'Lendo transcrição da conversa...',
    iconBg: 'from-indigo-500 to-violet-600',
    dotColor: 'bg-indigo-400',
    iconAnimation: 'spin',
  },

  // ── Ferramentas originais da Clara ────────────────────────────────────────
  'tool:query_database_table': {
    Icon: Database,
    label: 'Consultando banco de dados...',
    iconBg: 'from-emerald-500 to-teal-600',
    dotColor: 'bg-emerald-400',
    iconAnimation: 'spin',
  },
  'tool:get_database_schema': {
    Icon: Table2,
    label: 'Lendo estrutura do banco...',
    iconBg: 'from-teal-500 to-cyan-600',
    dotColor: 'bg-teal-400',
    iconAnimation: 'spin',
  },
  'tool:manage_long_term_memory': {
    Icon: Brain,
    label: 'Acessando memórias...',
    iconBg: 'from-violet-500 to-indigo-600',
    dotColor: 'bg-violet-400',
    iconAnimation: 'pulse',
  },
  'tool:read_brain_files': {
    Icon: BookOpen,
    label: 'Lendo arquivos do cérebro...',
    iconBg: 'from-indigo-500 to-blue-600',
    dotColor: 'bg-indigo-400',
    iconAnimation: 'pulse',
  },
  'tool:update_brain_file': {
    Icon: PenLine,
    label: 'Atualizando regras permanentes...',
    iconBg: 'from-orange-500 to-amber-600',
    dotColor: 'bg-orange-400',
    iconAnimation: 'bounce',
  },
  'tool:extract_and_save_knowledge': {
    Icon: BookmarkPlus,
    label: 'Salvando novo conhecimento...',
    iconBg: 'from-green-500 to-emerald-600',
    dotColor: 'bg-green-400',
    iconAnimation: 'pulse',
  },
  'tool:search_knowledge_base': {
    Icon: Search,
    label: 'Buscando gabaritos...',
    iconBg: 'from-sky-500 to-blue-600',
    dotColor: 'bg-sky-400',
    iconAnimation: 'bounce',
  },
};

interface Props {
  status: string;
}

export default function ClaraStatusIndicator({ status }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.thinking;
  const { Icon, label, iconBg, dotColor, iconAnimation } = config;

  return (
    <>
      <style>{`
        @keyframes claraFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes claraShimmer {
          0%   { transform: translateX(-200%) skewX(-15deg); }
          100% { transform: translateX(400%) skewX(-15deg); }
        }
        @keyframes claraDot {
          0%, 70%, 100% { transform: scale(0.5); opacity: 0.35; }
          35%            { transform: scale(1.3); opacity: 1; }
        }
        @keyframes claraGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0); }
          50%       { box-shadow: 0 0 10px 2px rgba(139,92,246,0.25); }
        }
      `}</style>

      <div
        className="flex items-end gap-2 px-4 mb-1"
        style={{ animation: 'claraFadeUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Avatar — mesma aparência do MessageBubble */}
        <div
          className="w-[30px] h-[30px] rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md ring-2 ring-white dark:ring-[#0b141a]"
          style={{ animation: 'claraGlow 2.5s ease-in-out infinite' }}
        >
          <Bot size={15} className="text-white" />
        </div>

        {/* Bolha de status */}
        <div className="relative overflow-hidden rounded-2xl rounded-bl-sm bg-white dark:bg-[#202c33] shadow-sm border border-black/5 dark:border-white/5 px-3.5 py-2.5">
          {/* Shimmer contínuo */}
          <div
            className="absolute inset-0 w-[35%] bg-gradient-to-r from-transparent via-white/30 dark:via-white/10 to-transparent pointer-events-none"
            style={{ animation: 'claraShimmer 2.4s ease-in-out infinite' }}
          />

          <div className="flex items-center gap-2.5 relative z-10">
            {/* Ícone da ação atual */}
            <div
              className={`w-[22px] h-[22px] rounded-md flex items-center justify-center bg-gradient-to-br ${iconBg} shadow-sm flex-shrink-0 transition-all duration-500`}
            >
              <Icon
                size={12}
                className={`text-white transition-all duration-300 ${
                  iconAnimation === 'spin'
                    ? 'animate-spin'
                    : iconAnimation === 'bounce'
                    ? 'animate-bounce'
                    : 'animate-pulse'
                }`}
              />
            </div>

            {/* Texto descritivo */}
            <span className="text-[11.5px] font-medium text-gray-500 dark:text-gray-400 select-none whitespace-nowrap transition-all duration-300">
              {label}
            </span>

            {/* Três pontos animados */}
            <div className="flex items-center gap-[3px] ml-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`block w-[5px] h-[5px] rounded-full ${dotColor} transition-colors duration-500`}
                  style={{
                    animation: 'claraDot 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
