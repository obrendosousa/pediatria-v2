'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown, ChevronRight, Users, UserCog, Stethoscope,
  FlaskConical, Handshake, Beaker, TestTubes, Pill, ClipboardList,
  FileText, Apple, Activity, FileSearch, FileSignature,
  PanelLeftClose, PanelLeft,
} from 'lucide-react';

// --- Types ---

interface SidebarSection {
  title: string;
  icon: React.ReactNode;
  items: { label: string; href: string; icon: React.ReactNode }[];
}

// --- Menu structure ---

const SECTIONS: SidebarSection[] = [
  {
    title: 'Cadastros Gerais',
    icon: <Users className="w-4 h-4" />,
    items: [
      { label: 'Colaboradores', href: '/atendimento/cadastros/colaboradores', icon: <Users className="w-3.5 h-3.5" /> },
      { label: 'Profissionais', href: '/atendimento/cadastros/profissionais', icon: <UserCog className="w-3.5 h-3.5" /> },
    ],
  },
  {
    title: 'Clínico',
    icon: <Stethoscope className="w-4 h-4" />,
    items: [
      { label: 'Procedimentos', href: '/atendimento/cadastros/procedimentos', icon: <Stethoscope className="w-3.5 h-3.5" /> },
      { label: 'Protocolos', href: '/atendimento/cadastros/protocolos', icon: <ClipboardList className="w-3.5 h-3.5" /> },
      { label: 'Parceiros', href: '/atendimento/cadastros/parceiros', icon: <Handshake className="w-3.5 h-3.5" /> },
    ],
  },
  {
    title: 'Receituário',
    icon: <Beaker className="w-4 h-4" />,
    items: [
      { label: 'Substâncias', href: '/atendimento/cadastros/receituario/substancias', icon: <TestTubes className="w-3.5 h-3.5" /> },
      { label: 'Fórmulas', href: '/atendimento/cadastros/receituario/formulas', icon: <Beaker className="w-3.5 h-3.5" /> },
      { label: 'Protocolos', href: '/atendimento/cadastros/receituario/protocolos', icon: <ClipboardList className="w-3.5 h-3.5" /> },
      { label: 'Medicamentos', href: '/atendimento/cadastros/receituario/medicamentos', icon: <Pill className="w-3.5 h-3.5" /> },
    ],
  },
  {
    title: 'Modelos de Prontuário',
    icon: <FileText className="w-4 h-4" />,
    items: [
      { label: 'Anamneses', href: '/atendimento/cadastros/modelos/anamneses', icon: <ClipboardList className="w-3.5 h-3.5" /> },
      { label: 'Atestados', href: '/atendimento/cadastros/modelos/atestados', icon: <FileText className="w-3.5 h-3.5" /> },
      { label: 'Dietas', href: '/atendimento/cadastros/modelos/dietas', icon: <Apple className="w-3.5 h-3.5" /> },
      { label: 'Evolução', href: '/atendimento/cadastros/modelos/evolucao', icon: <Activity className="w-3.5 h-3.5" /> },
      { label: 'Exames', href: '/atendimento/cadastros/modelos/exames', icon: <FlaskConical className="w-3.5 h-3.5" /> },
      { label: 'Laudos', href: '/atendimento/cadastros/modelos/laudos', icon: <FileSearch className="w-3.5 h-3.5" /> },
      { label: 'Receitas', href: '/atendimento/cadastros/modelos/receitas', icon: <Pill className="w-3.5 h-3.5" /> },
    ],
  },
];

const STANDALONE_ITEM = {
  label: 'Modelos de Documentos',
  href: '/atendimento/cadastros/documentos',
  icon: <FileSignature className="w-3.5 h-3.5" />,
};

// --- Components ---

function CollapsibleSection({
  section,
  pathname,
  defaultOpen,
}: {
  section: SidebarSection;
  pathname: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasActive = section.items.some(i => pathname.startsWith(i.href));

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
          hasActive
            ? 'text-blue-700 dark:text-blue-300'
            : 'text-slate-500 dark:text-[#a1a1aa] hover:text-slate-700 dark:hover:text-gray-200'
        }`}
      >
        {section.icon}
        <span className="flex-1 text-left">{section.title}</span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 opacity-50" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        )}
      </button>

      {open && (
        <div className="ml-2 mt-0.5 space-y-0.5">
          {section.items.map(item => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-[#a1a1aa] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-gray-200'
                }`}
              >
                <span className={active ? 'text-blue-600' : 'text-slate-400 dark:text-[#71717a]'}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Layout ---

export default function CadastrosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`shrink-0 flex flex-col bg-white dark:bg-[#08080b] border-r border-slate-200 dark:border-[#3d3d48] transition-all duration-300 overflow-hidden ${
          collapsed ? 'w-0 min-w-0' : 'w-60 min-w-60'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-[#2d2d36]">
          <h2 className="text-sm font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wide">
            Cadastros
          </h2>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title="Recolher menu"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar nav */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-2 py-3 space-y-1">
          {SECTIONS.map(section => (
            <CollapsibleSection
              key={section.title}
              section={section}
              pathname={pathname}
              defaultOpen={section.items.some(i => pathname.startsWith(i.href))}
            />
          ))}

          {/* Standalone: Modelos de Documentos */}
          <div className="pt-1">
            <Link
              href={STANDALONE_ITEM.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith(STANDALONE_ITEM.href)
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-slate-600 dark:text-[#a1a1aa] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-gray-200'
              }`}
            >
              <span className={pathname.startsWith(STANDALONE_ITEM.href) ? 'text-blue-600' : 'text-slate-400 dark:text-[#71717a]'}>
                {STANDALONE_ITEM.icon}
              </span>
              {STANDALONE_ITEM.label}
            </Link>
          </div>
        </nav>
      </aside>

      {/* Expand button (shown when collapsed) */}
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="shrink-0 flex items-center justify-center w-8 border-r border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b] text-slate-400 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          title="Expandir menu"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
