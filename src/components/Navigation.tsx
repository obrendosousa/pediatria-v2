'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare, CalendarDays, Settings, LogOut, LucideIcon,
  LayoutDashboard, Trello, Stethoscope, CheckSquare,
  Store, PieChart, Users, Moon, Sun,
  ChevronLeft, ChevronRight, Zap, FileText, ArrowLeftRight, Receipt,
  ClipboardList, Ban, DollarSign, BarChart3, BookOpen, Tv,
} from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadChatsCount } from '@/hooks/useUnreadChatsCount';
import { getModuleFromPathname, type ModuleConfig } from '@/config/modules';

export default function Navigation() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { signOut, profile, modules } = useAuth();

  const isDoctor = modules.length > 0 &&
    modules.every(m => m.role === 'doctor') &&
    profile?.doctor_id != null;
  const { unreadCount } = useUnreadChatsCount();

  const currentModule: ModuleConfig = useMemo(
    () => getModuleFromPathname(pathname ?? '/'),
    [pathname]
  );
  const isAtendimento = currentModule.id === 'atendimento';
  const mt = currentModule.theme;

  const isActive = (path: string) => path === '/' ? pathname === '/' : pathname?.startsWith(path) ?? false;

  const hasMultipleModules = modules.length > 1;

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return saved === 'dark' || (!saved && systemDark) ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    localStorage.setItem('theme', newTheme);
  };

  return (
    <div
      className="flex shrink-0 flex-col bg-white dark:bg-[#0d0f15] border-r border-slate-200/80 dark:border-[#1e2334]/60 relative z-10 h-screen overflow-hidden sidebar-transition"
      style={{
        width: isCollapsed ? '80px' : '272px',
        minWidth: isCollapsed ? '80px' : '272px',
        maxWidth: isCollapsed ? '80px' : '272px',
      }}
    >

      {/* --- HEADER / LOGO --- */}
      <div className="relative z-10 flex flex-col items-center pt-14 pb-5 px-5 border-b border-slate-100 dark:border-[#1e2334]/60 overflow-hidden">

        {/* Botão Toggle */}
        <button
          onClick={toggleSidebar}
          className={`absolute ${isCollapsed ? 'top-3 right-2' : 'top-3 right-3'} z-50 w-7 h-7 rounded-full bg-white dark:bg-[#0d0f15] border border-slate-200 dark:border-[#252a3a] shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 group cursor-pointer`}
          aria-label={isCollapsed ? 'Expandir menu' : 'Minimizar menu'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-500 dark:text-[#828ca5]" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-[#828ca5]" />
          )}
        </button>

        <div className="flex items-center gap-3 w-full transition-all duration-300">
          <div className="relative w-11 h-11 flex items-center justify-center bg-white dark:bg-[#141722] rounded-xl shadow-sm border border-slate-100 dark:border-[#1e2334] p-1.5 transition-colors shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://i.imgur.com/W5fMxRM.png"
              alt="Logo Centro Médico Aliança"
              className="w-full h-full object-contain"
            />
          </div>
          <div
            className={`text-left sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}
            style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
          >
            <h2 className="text-sm font-bold text-slate-800 dark:text-[#e8ecf4] leading-tight">Centro Médico</h2>
            <h2 className="text-sm font-bold text-slate-800 dark:text-[#e8ecf4] leading-tight">Aliança</h2>
          </div>
        </div>

        {/* Module badge */}
        <div
          className={`sidebar-content-transition whitespace-nowrap overflow-hidden w-full ${isCollapsed ? 'opacity-0 h-0 mt-0' : 'opacity-100 h-auto mt-3'}`}
          style={{ transitionDelay: isCollapsed ? '0ms' : '250ms' }}
        >
          <span
            className={`block text-[10px] font-semibold ${mt.text} ${mt.bgSubtle} px-3 py-1 rounded-md uppercase tracking-widest text-center`}
          >
            {currentModule.sublabel}
          </span>
        </div>

        {/* Switcher de módulo */}
        {hasMultipleModules && !isCollapsed && !isDoctor && (
          <Link
            href={isAtendimento ? '/' : '/atendimento'}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 dark:text-[#565d73] hover:text-slate-600 dark:hover:text-[#c0c7d8] hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-200 w-full justify-center cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {isAtendimento ? 'Ir para Pediatria' : 'Ir para Sistema Geral'}
          </Link>
        )}
      </div>

      {/* --- NAVEGAÇÃO --- */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-6 py-5">

        {isAtendimento && isDoctor ? (
          <>
            <MenuGroup title="Clínico">
              <NavItem icon={Stethoscope} label="Painel Médico" path="/atendimento/doctor" active={isActive('/atendimento/doctor')} moduleTheme={mt} />
              <NavItem icon={CalendarDays} label="Minha Agenda" path="/atendimento/agenda" active={pathname === '/atendimento/agenda'} moduleTheme={mt} />
              <NavItem icon={Users} label="Meus Pacientes" path="/atendimento/clients" active={isActive('/atendimento/clients')} moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Operacional">
              <NavItem icon={Trello} label="CRM" path="/atendimento/crm" active={isActive('/atendimento/crm')} moduleTheme={mt} />
              <NavItem icon={CheckSquare} label="Tasks" path="/atendimento/tasks" active={isActive('/atendimento/tasks')} moduleTheme={mt} />
            </MenuGroup>
          </>
        ) : isAtendimento ? (
          <>
            <MenuGroup title="Operacional">
              <NavItem icon={LayoutDashboard} label="Dashboard" path="/atendimento/dashboard" active={isActive('/atendimento/dashboard')} moduleTheme={mt} />
              <NavItem icon={MessageSquare} label="Chat" path="/atendimento" active={pathname === '/atendimento'} badge={unreadCount > 0 ? unreadCount : undefined} moduleTheme={mt} />
              <NavItem icon={Trello} label="CRM" path="/atendimento/crm" active={isActive('/atendimento/crm')} moduleTheme={mt} />
              <NavItem icon={CheckSquare} label="Tasks" path="/atendimento/tasks" active={isActive('/atendimento/tasks')} moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Clínico">
              <NavItem icon={Stethoscope} label="Painel Médico" path="/atendimento/doctor" active={isActive('/atendimento/doctor')} moduleTheme={mt} />
              <NavItem icon={Tv} label="Painel TV" path="/atendimento/tv" active={isActive('/atendimento/tv')} moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Agenda">
              <NavItem icon={CalendarDays} label="Agenda" path="/atendimento/agenda" active={pathname === '/atendimento/agenda'} moduleTheme={mt} />
              <NavItem icon={ClipboardList} label="Gerenciar" path="/atendimento/agenda/gerenciar" active={isActive('/atendimento/agenda/gerenciar')} moduleTheme={mt} />
              <NavItem icon={Ban} label="Bloqueios" path="/atendimento/agenda/bloqueios" active={isActive('/atendimento/agenda/bloqueios')} moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Gestão">
              <NavItem icon={Users} label="Pacientes" path="/atendimento/clients" active={isActive('/atendimento/clients')} moduleTheme={mt} />
              <NavItem icon={Receipt} label="Orçamentos" path="/atendimento/orcamentos" active={isActive('/atendimento/orcamentos')} moduleTheme={mt} />
              <NavItem icon={DollarSign} label="Financeiro" path="/atendimento/financeiro" active={pathname === '/atendimento/financeiro'} moduleTheme={mt} />
              <NavItem icon={FileText} label="NF-e" path="/atendimento/financeiro/nfe" active={isActive('/atendimento/financeiro/nfe')} moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Cadastros">
              <NavItem icon={BookOpen} label="Cadastros" path="/atendimento/cadastros" active={isActive('/atendimento/cadastros')} moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Sistema">
              <NavItem icon={BarChart3} label="Relatórios" path="/atendimento/relatorios" active={isActive('/atendimento/relatorios')} moduleTheme={mt} />
              <NavItem icon={Zap} label="Automações" path="/atendimento/automatizacoes" active={isActive('/atendimento/automatizacoes')} moduleTheme={mt} />
              <NavItem icon={Settings} label="Configurações" path="/atendimento/configuracoes" active={isActive('/atendimento/configuracoes')} moduleTheme={mt} />
            </MenuGroup>
          </>
        ) : (
          <>
            <MenuGroup title="Operacional">
              <NavItem icon={LayoutDashboard} label="Dashboard" path="/dashboard" active={isActive('/dashboard')} moduleTheme={mt} />
              <NavItem
                icon={MessageSquare}
                label="Atendimento"
                path="/"
                active={isActive('/')}
                badge={unreadCount > 0 ? unreadCount : undefined}
                moduleTheme={mt}
              />
              <NavItem icon={Trello} label="Recepção & CRM" path="/crm" active={isActive('/crm')} moduleTheme={mt} />
              <NavItem icon={CheckSquare} label="Tarefas" path="/tasks" active={isActive('/tasks')} moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Clínico">
              <NavItem icon={Stethoscope} label="Painel Médico" path="/doctor" active={isActive('/doctor')} moduleTheme={mt} />
              <NavItem icon={CalendarDays} label="Agenda" path="/agenda" active={isActive('/agenda')} moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Gestão">
              <NavItem icon={Users} label="Clientes & Prontuário" path="/clients" active={isActive('/clients')} moduleTheme={mt} />
              <NavItem icon={Store} label="Loja & Estoque" path="/loja" active={isActive('/loja')} moduleTheme={mt} />
              <NavItem icon={PieChart} label="Financeiro" path="/financeiro" active={isActive('/financeiro')} moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Sistema">
              <NavItem icon={Zap} label="Automações" path="/automatizacoes" active={isActive('/automatizacoes')} moduleTheme={mt} />
              <NavItem icon={FileText} label="Relatórios IA" path="/relatorios" active={isActive('/relatorios')} moduleTheme={mt} />
              {profile?.role === 'admin' && (
                <NavItem icon={Settings} label="Configurações" path="/configuracoes" active={isActive('/configuracoes')} moduleTheme={mt} />
              )}
            </MenuGroup>
          </>
        )}

      </nav>

      {/* --- FOOTER --- */}
      <div className="p-3 border-t border-slate-100 dark:border-[#1e2334]/60 bg-white dark:bg-[#0d0f15] transition-colors space-y-1">

        {/* Botão de Tema */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all duration-200 group cursor-pointer relative`}
          title={isCollapsed ? (theme === 'light' ? 'Modo Claro' : 'Modo Escuro') : undefined}
        >
          <div className="flex items-center gap-3">
            {theme === 'light' ? (
              <Sun className="w-5 h-5 text-amber-500 shrink-0" />
            ) : (
              <Moon className="w-5 h-5 text-blue-400 shrink-0" />
            )}
            <span
              className={`text-[13px] font-medium text-slate-600 dark:text-[#828ca5] group-hover:text-slate-800 dark:group-hover:text-[#e8ecf4] sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}
              style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
            >
              {theme === 'light' ? 'Modo Claro' : 'Modo Escuro'}
            </span>
          </div>
          <div
            className={`w-9 h-5 rounded-full p-0.5 sidebar-content-transition ${theme === 'dark' ? 'bg-sky-500' : 'bg-slate-300'} ${isCollapsed ? 'opacity-0 scale-0 w-0' : 'opacity-100 scale-100 w-9'}`}
            style={{ transitionDelay: isCollapsed ? '0ms' : '250ms' }}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>

          {isCollapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-[#1a1e2e] text-[#e8ecf4] text-xs font-medium rounded-lg border border-[#252a3a] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
              {theme === 'light' ? 'Modo Claro' : 'Modo Escuro'}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1a1e2e]"></div>
            </div>
          )}
        </button>

        {/* Botão de Sair */}
        <button
          type="button"
          onClick={() => signOut()}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all duration-200 group cursor-pointer relative`}
          title={isCollapsed ? 'Sair' : undefined}
        >
          <div className="flex items-center gap-3">
            <LogOut className="w-5 h-5 text-slate-400 dark:text-[#565d73] group-hover:text-red-500 dark:group-hover:text-red-400 shrink-0" />
            <span
              className={`text-[13px] font-medium text-slate-600 dark:text-[#828ca5] group-hover:text-red-600 dark:group-hover:text-red-400 sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}
              style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
            >
              Sair
            </span>
          </div>
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-[#1a1e2e] text-[#e8ecf4] text-xs font-medium rounded-lg border border-[#252a3a] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
              Sair
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1a1e2e]"></div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

function MenuGroup({ title, children }: { title: string, children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <div>
      <div
        className={`px-3 mb-2.5 sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 h-0 mb-0' : 'opacity-100 h-auto mb-2.5'}`}
        style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
      >
        <p className="text-[11px] font-semibold text-slate-400 dark:text-[#565d73] uppercase tracking-widest">
          {title}
        </p>
      </div>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  path: string;
  active: boolean;
  badge?: number;
  moduleTheme: import('@/config/modules').ModuleTheme;
}

function NavItem({ icon: Icon, label, path, active, badge, moduleTheme }: NavItemProps) {
  const { isCollapsed } = useSidebar();

  return (
    <Link href={path} className="block group relative cursor-pointer" title={isCollapsed ? label : undefined}>
      <div className={`
        relative flex items-center px-3 py-3 rounded-xl transition-all duration-200 text-[13.5px] font-medium overflow-hidden
        ${active
          ? `${moduleTheme.activeGradient} text-white ${moduleTheme.shadowActive}`
          : 'text-slate-600 dark:text-[#828ca5] hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-[#e8ecf4]'}
      `}>
        {/* Active indicator bar */}
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white/40 rounded-r-full" />
        )}

        <Icon
          className={`w-5 h-5 transition-colors duration-200 shrink-0 ${active ? 'text-white' : 'text-slate-400 dark:text-[#565d73]'}`}
        />
        <span
          className={`sidebar-content-transition whitespace-nowrap overflow-hidden inline-block ${isCollapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-auto ml-3'}`}
          style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
        >
          {label}
        </span>

        {badge !== undefined && badge > 0 && (
          <div
            className={`absolute ${isCollapsed ? 'right-1 top-1' : 'right-2.5 top-1/2 -translate-y-1/2'} transition-all duration-500 ease-in-out z-10`}
          >
            <span className={`flex ${badge > 99 ? 'min-w-[28px] px-1.5' : 'h-5 w-5'} items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#0d0f15]`}>
              {badge > 99 ? '99+' : badge}
            </span>
          </div>
        )}

        {isCollapsed && (
          <div className="absolute left-full ml-2 px-3 py-2 bg-[#1a1e2e] text-[#e8ecf4] text-xs font-medium rounded-lg border border-[#252a3a] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
            {label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1a1e2e]"></div>
          </div>
        )}
      </div>
    </Link>
  );
}
