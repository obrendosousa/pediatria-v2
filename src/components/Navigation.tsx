'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageSquare, CalendarDays, Settings, LogOut, LucideIcon,
  LayoutDashboard, Trello, Stethoscope, CheckSquare,
  Store, PieChart, Heart, Sparkles, Users, Moon, Sun,
  ChevronLeft, ChevronRight, Zap, FileText, ArrowLeftRight, Receipt,
  ClipboardList, Ban, DollarSign, BarChart3, BookOpen, Tv,
} from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadChatsCount } from '@/hooks/useUnreadChatsCount';
import { getModuleFromPathname, type ModuleConfig, type ModuleTheme } from '@/config/modules';

export default function Navigation() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { signOut, profile, modules } = useAuth();
  const navRef = useRef<HTMLElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ top: number; height: number } | null>(null);
  const [enableTransition, setEnableTransition] = useState(false);

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

  // Floating indicator measurement (only for atendimento)
  useEffect(() => {
    if (!navRef.current || !isAtendimento) return;

    const measure = () => {
      const nav = navRef.current;
      if (!nav) return;
      const activeEl = nav.querySelector('[data-nav-active="true"]') as HTMLElement | null;
      if (!activeEl) { setIndicatorStyle(null); return; }

      const navRect = nav.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();
      setIndicatorStyle({
        top: itemRect.top - navRect.top + nav.scrollTop,
        height: itemRect.height,
      });
    };

    // Measure after paint
    const raf = requestAnimationFrame(() => {
      measure();
      // Enable transitions after first paint so indicator doesn't animate from 0,0
      if (!enableTransition) {
        requestAnimationFrame(() => setEnableTransition(true));
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [pathname, isAtendimento, isCollapsed, enableTransition]);

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
      className={`flex shrink-0 flex-col sidebar-slide-in ${isAtendimento ? 'bg-[#0B1120] border-r border-[#1a2744]/60' : `bg-white dark:bg-[#08080b] border-r ${mt.border}`} ${mt.shadow} dark:shadow-none relative z-10 h-screen overflow-hidden sidebar-transition dark:bg-[#08080b] dark:border-r dark:border-[#1c1c21]`}
      style={{
        width: isCollapsed ? '80px' : '260px',
        minWidth: isCollapsed ? '80px' : '260px',
        maxWidth: isCollapsed ? '80px' : '260px',
      }}
    >

      {/* --- FUNDO DECORATIVO --- */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30 dark:opacity-10">
        <div className={`absolute top-[-10%] left-[-20%] w-48 h-48 ${mt.bgBlur} rounded-full blur-[60px]`}></div>
      </div>

      {/* --- PARTÍCULAS (só atendimento) --- */}
      {isAtendimento && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[8%] left-[15%] w-1 h-1 bg-white/15 rounded-full animate-[float_6s_ease-in-out_infinite]" />
          <div className="absolute top-[15%] right-[20%] w-1.5 h-1.5 bg-blue-400/10 rounded-full animate-[float_8s_ease-in-out_infinite_1s]" />
          <div className="absolute top-[25%] left-[60%] w-1 h-1 bg-white/10 rounded-full animate-[float_7s_ease-in-out_infinite_2s]" />
          <div className="absolute top-[35%] left-[25%] w-1 h-1 bg-blue-300/10 rounded-full animate-[float_9s_ease-in-out_infinite_0.5s]" />
          <div className="absolute top-[42%] right-[15%] w-1.5 h-1.5 bg-white/10 rounded-full animate-[float_5s_ease-in-out_infinite_3s]" />
          <div className="absolute top-[50%] left-[40%] w-1 h-1 bg-indigo-400/10 rounded-full animate-[float_10s_ease-in-out_infinite_1.5s]" />
          <div className="absolute top-[58%] left-[10%] w-1 h-1 bg-white/15 rounded-full animate-[float_6s_ease-in-out_infinite_4s]" />
          <div className="absolute top-[65%] right-[30%] w-1.5 h-1.5 bg-blue-400/10 rounded-full animate-[float_8s_ease-in-out_infinite_2.5s]" />
          <div className="absolute top-[72%] left-[50%] w-1 h-1 bg-white/10 rounded-full animate-[float_7s_ease-in-out_infinite_0.8s]" />
          <div className="absolute top-[80%] left-[20%] w-1 h-1 bg-indigo-300/10 rounded-full animate-[float_9s_ease-in-out_infinite_3.5s]" />
          <div className="absolute top-[88%] right-[25%] w-1.5 h-1.5 bg-white/10 rounded-full animate-[float_5s_ease-in-out_infinite_1.2s]" />
          <div className="absolute top-[95%] left-[35%] w-1 h-1 bg-blue-300/15 rounded-full animate-[float_11s_ease-in-out_infinite_4.5s]" />
        </div>
      )}

      {/* --- HEADER / LOGO --- */}
      <div className={`relative z-10 flex flex-col items-center pt-14 pb-4 px-4 border-b ${isAtendimento ? 'border-white/[0.06]' : 'border-pink-50 dark:border-[#2d2d36]/60'} overflow-hidden`}>

        {/* Botão Toggle */}
        <button
          onClick={toggleSidebar}
          className={`absolute ${isCollapsed ? 'top-3 right-2' : 'top-3 right-3'} z-50 w-7 h-7 rounded-full ${isAtendimento ? 'bg-[#0B1120] border-2 border-white/10 text-white/60 hover:bg-white/10' : `bg-white dark:bg-[#08080b] border-2 ${mt.borderAccent} ${mt.hoverBg}`} shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group cursor-pointer dark:bg-[#08080b] dark:border-white/10`}
          aria-label={isCollapsed ? 'Expandir menu' : 'Minimizar menu'}
        >
          {isCollapsed ? (
            <ChevronRight className={`w-4 h-4 ${mt.textBold} transition-all duration-300 group-hover:translate-x-0.5`} />
          ) : (
            <ChevronLeft className={`w-4 h-4 ${mt.textBold} transition-all duration-300 group-hover:-translate-x-0.5`} />
          )}
        </button>

        <div className="flex items-center gap-3 w-full mb-2 transition-all duration-300">
          <div className={`relative w-10 h-10 flex items-center justify-center bg-white dark:bg-[#1c1c21] rounded-xl shadow-sm border ${isAtendimento ? 'border-slate-200 dark:border-[#2d2d36]' : 'border-pink-100 dark:border-[#2d2d36]'} p-1 transition-colors shrink-0`}>
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
            <h2 className={`text-sm font-bold leading-tight ${isAtendimento ? 'text-white/90' : 'text-slate-700 dark:text-[#fafafa]'}`}>Centro Médico<br />Aliança</h2>
          </div>
        </div>

        {/* Module badge */}
        <span
          className={`text-[10px] font-bold ${mt.text} ${mt.bgSubtle} px-2 py-0.5 rounded-md uppercase tracking-wider w-full text-center sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 h-0 mt-0' : 'opacity-100 h-auto mt-2'}`}
          style={{ transitionDelay: isCollapsed ? '0ms' : '250ms' }}
        >
          {currentModule.sublabel}
        </span>

        {/* Switcher de módulo */}
        {hasMultipleModules && !isCollapsed && !isDoctor && (
          <Link
            href={isAtendimento ? '/' : '/atendimento'}
            className={`mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all w-full justify-center cursor-pointer ${isAtendimento ? 'text-white/40 hover:text-white/70 hover:bg-white/5' : 'text-slate-400 dark:text-[#71717a] hover:text-slate-600 dark:hover:text-[#d4d4d8] hover:bg-slate-50 dark:hover:bg-white/5'}`}
          >
            <ArrowLeftRight className="w-3 h-3" />
            {isAtendimento ? 'Ir para Pediatria' : 'Ir para Clínica Geral'}
          </Link>
        )}
      </div>

      {/* --- NAVEGAÇÃO --- */}
      <nav ref={navRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-6 py-4 relative">

        {/* ── Floating Indicator (só atendimento) ── */}
        {isAtendimento && indicatorStyle && (
          <div
            className="absolute left-3 right-3 rounded-xl pointer-events-none z-0"
            style={{
              top: indicatorStyle.top,
              height: indicatorStyle.height,
              transition: enableTransition
                ? 'top 0.4s cubic-bezier(0.22, 1, 0.36, 1), height 0.3s ease, opacity 0.3s ease'
                : 'none',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.02) 30%, rgba(255,255,255,0.08) 70%, rgba(255,255,255,0.15) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Barra branca lateral */}
            <div
              className="absolute right-2 top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-white"
              style={{
                height: '55%',
                boxShadow: '0 0 8px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.15)',
              }}
            />
          </div>
        )}

        {isAtendimento && isDoctor ? (
          <>
            <MenuGroup title="Clínico" moduleTheme={mt}>
              <NavItem icon={Stethoscope} label="Painel Médico" path="/atendimento/doctor" active={isActive('/atendimento/doctor')} color="teal" moduleTheme={mt} showHeart={false} />
              <NavItem icon={CalendarDays} label="Minha Agenda" path="/atendimento/agenda" active={pathname === '/atendimento/agenda'} color="blue" moduleTheme={mt} showHeart={false} />
              <NavItem icon={Users} label="Meus Pacientes" path="/atendimento/clients" active={isActive('/atendimento/clients')} color="blue" moduleTheme={mt} showHeart={false} />
            </MenuGroup>

            <MenuGroup title="Operacional" moduleTheme={mt}>
              <NavItem icon={Trello} label="CRM" path="/atendimento/crm" active={isActive('/atendimento/crm')} color="purple" moduleTheme={mt} showHeart={false} />
              <NavItem icon={CheckSquare} label="Tasks" path="/atendimento/tasks" active={isActive('/atendimento/tasks')} color="orange" moduleTheme={mt} showHeart={false} />
            </MenuGroup>
          </>
        ) : isAtendimento ? (
          <>
            <MenuGroup title="Operacional" moduleTheme={mt}>
              <NavItem icon={LayoutDashboard} label="Dashboard" path="/atendimento/dashboard" active={isActive('/atendimento/dashboard')} color="blue" moduleTheme={mt} showHeart={false} />
              <NavItem icon={MessageSquare} label="Chat" path="/atendimento" active={pathname === '/atendimento'} badge={unreadCount > 0 ? unreadCount : undefined} color="teal" moduleTheme={mt} showHeart={false} />
              <NavItem icon={Trello} label="CRM" path="/atendimento/crm" active={isActive('/atendimento/crm')} color="purple" moduleTheme={mt} showHeart={false} />
              <NavItem icon={CheckSquare} label="Tasks" path="/atendimento/tasks" active={isActive('/atendimento/tasks')} color="orange" moduleTheme={mt} showHeart={false} />
            </MenuGroup>

            <MenuGroup title="Clínico" moduleTheme={mt}>
              <NavItem icon={Stethoscope} label="Painel Médico" path="/atendimento/doctor" active={isActive('/atendimento/doctor')} color="teal" moduleTheme={mt} showHeart={false} />
              <NavItem icon={Tv} label="Painel TV" path="/atendimento/tv" active={isActive('/atendimento/tv')} color="blue" moduleTheme={mt} showHeart={false} />
            </MenuGroup>

            <MenuGroup title="Agenda" moduleTheme={mt}>
              <NavItem icon={CalendarDays} label="Agenda" path="/atendimento/agenda" active={pathname === '/atendimento/agenda'} color="blue" moduleTheme={mt} showHeart={false} />
              <NavItem icon={ClipboardList} label="Gerenciar" path="/atendimento/agenda/gerenciar" active={isActive('/atendimento/agenda/gerenciar')} color="slate" moduleTheme={mt} showHeart={false} />
              <NavItem icon={Ban} label="Bloqueios" path="/atendimento/agenda/bloqueios" active={isActive('/atendimento/agenda/bloqueios')} color="rose" moduleTheme={mt} showHeart={false} />
            </MenuGroup>

            <MenuGroup title="Gestão" moduleTheme={mt}>
              <NavItem icon={Users} label="Pacientes" path="/atendimento/clients" active={isActive('/atendimento/clients')} color="blue" moduleTheme={mt} showHeart={false} />
              <NavItem icon={Receipt} label="Orçamentos" path="/atendimento/orcamentos" active={isActive('/atendimento/orcamentos')} color="orange" moduleTheme={mt} showHeart={false} />
              <NavItem icon={DollarSign} label="Financeiro" path="/atendimento/financeiro" active={pathname === '/atendimento/financeiro'} color="green" moduleTheme={mt} showHeart={false} />
              <NavItem icon={FileText} label="NF-e" path="/atendimento/financeiro/nfe" active={isActive('/atendimento/financeiro/nfe')} color="slate" moduleTheme={mt} showHeart={false} />
            </MenuGroup>

            <MenuGroup title="Cadastros" moduleTheme={mt}>
              <NavItem icon={BookOpen} label="Cadastros" path="/atendimento/cadastros" active={isActive('/atendimento/cadastros')} color="indigo" moduleTheme={mt} showHeart={false} />
            </MenuGroup>

            <MenuGroup title="Sistema" moduleTheme={mt}>
              <NavItem icon={BarChart3} label="Relatórios" path="/atendimento/relatorios" active={isActive('/atendimento/relatorios')} color="indigo" moduleTheme={mt} showHeart={false} />
              <NavItem icon={Zap} label="Automações" path="/atendimento/automatizacoes" active={isActive('/atendimento/automatizacoes')} color="indigo" moduleTheme={mt} showHeart={false} />
              <NavItem icon={Settings} label="Configurações" path="/atendimento/configuracoes" active={isActive('/atendimento/configuracoes')} color="slate" moduleTheme={mt} showHeart={false} />
            </MenuGroup>
          </>
        ) : (
          <>
            {/* Menu da PEDIATRIA — igual à VPS */}
            <MenuGroup title="Operacional" moduleTheme={mt}>
              <NavItem icon={LayoutDashboard} label="Dashboard" path="/dashboard" active={isActive('/dashboard')} color="blue" moduleTheme={mt} />
              <NavItem
                icon={MessageSquare}
                label="Atendimento"
                path="/"
                active={isActive('/')}
                color="pink"
                badge={unreadCount > 0 ? unreadCount : undefined}
                moduleTheme={mt}
              />
              <NavItem icon={Trello} label="Recepção & CRM" path="/crm" active={isActive('/crm')} color="purple" moduleTheme={mt} />
              <NavItem icon={CheckSquare} label="Tarefas" path="/tasks" active={isActive('/tasks')} color="orange" moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Clínico" moduleTheme={mt}>
              <NavItem icon={Stethoscope} label="Painel Médico" path="/doctor" active={isActive('/doctor')} color="teal" moduleTheme={mt} />
              <NavItem icon={CalendarDays} label="Agenda" path="/agenda" active={isActive('/agenda')} color="blue" moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Gestão" moduleTheme={mt}>
              <NavItem icon={Users} label="Clientes & Prontuário" path="/clients" active={isActive('/clients')} color="blue" moduleTheme={mt} />
              <NavItem icon={Store} label="Loja & Estoque" path="/loja" active={isActive('/loja')} color="rose" moduleTheme={mt} />
              <NavItem icon={PieChart} label="Financeiro" path="/financeiro" active={isActive('/financeiro')} color="green" moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Sistema" moduleTheme={mt}>
              <NavItem icon={Zap} label="Automações" path="/automatizacoes" active={isActive('/automatizacoes')} color="indigo" moduleTheme={mt} />
              <NavItem icon={FileText} label="Relatórios IA" path="/relatorios" active={isActive('/relatorios')} color="indigo" moduleTheme={mt} />
              {profile?.role === 'admin' && (
                <NavItem icon={Settings} label="Configurações" path="/configuracoes" active={isActive('/configuracoes')} color="slate" moduleTheme={mt} />
              )}
            </MenuGroup>
          </>
        )}

      </nav>

      {/* --- FOOTER --- */}
      <div className={`p-3 border-t ${isAtendimento ? 'border-white/[0.06] bg-[#0B1120]' : 'border-pink-50 dark:border-[#2d2d36]/60 bg-white'} dark:bg-[#08080b] dark:border-[#1c1c21] transition-colors space-y-1`}>

        {/* Botão de Tema */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-2.5 rounded-xl ${isAtendimento ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.06]'} transition-all duration-200 group cursor-pointer relative`}
          title={isCollapsed ? (theme === 'light' ? 'Modo Claro' : 'Modo Escuro') : undefined}
        >
          <div className="flex items-center gap-2.5">
            {theme === 'light' ? (
              <Sun className="w-4.5 h-4.5 text-amber-500 shrink-0" />
            ) : (
              <Moon className="w-4.5 h-4.5 text-blue-400 shrink-0" />
            )}
            <span
              className={`text-xs font-bold text-slate-500 dark:text-[#a1a1aa] group-hover:text-slate-800 dark:group-hover:text-[#fafafa] sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}
              style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
            >
              {theme === 'light' ? 'Modo Claro' : 'Modo Escuro'}
            </span>
          </div>
          <div
            className={`w-8 h-4 rounded-full p-0.5 sidebar-content-transition ${theme === 'dark' ? 'bg-sky-500' : 'bg-slate-300'} ${isCollapsed ? 'opacity-0 scale-0 w-0' : 'opacity-100 scale-100 w-8'}`}
            style={{ transitionDelay: isCollapsed ? '0ms' : '250ms' }}
          >
            <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>

          {isCollapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-[#252530] text-[#fafafa] text-xs font-medium rounded-lg border border-[#3d3d48] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
              {theme === 'light' ? 'Modo Claro' : 'Modo Escuro'}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#252530]"></div>
            </div>
          )}
        </button>

        {/* Botão de Sair */}
        <button
          type="button"
          onClick={() => signOut()}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all duration-200 group cursor-pointer relative`}
          title={isCollapsed ? 'Sair' : undefined}
        >
          <div className="flex items-center gap-2.5">
            <LogOut className="w-4.5 h-4.5 text-slate-400 dark:text-[#71717a] group-hover:text-red-500 dark:group-hover:text-red-400 shrink-0" />
            <span
              className={`text-xs font-bold text-slate-500 dark:text-[#a1a1aa] group-hover:text-red-600 dark:group-hover:text-red-400 sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}
              style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
            >
              Sair
            </span>
          </div>
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-[#252530] text-[#fafafa] text-xs font-medium rounded-lg border border-[#3d3d48] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
              Sair
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#252530]"></div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── MenuGroup com Sparkles ───
function MenuGroup({ title, children, moduleTheme }: { title: string; children: React.ReactNode; moduleTheme: ModuleTheme }) {
  const { isCollapsed } = useSidebar();

  return (
    <div>
      <p
        className={`px-3 text-[10px] font-bold text-slate-400 dark:text-[#71717a] uppercase tracking-wider mb-1 flex items-center gap-1 sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 h-0 mb-0' : 'opacity-100 h-auto mb-1'}`}
        style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
      >
        <Sparkles className={`w-3 h-3 ${moduleTheme.sparkleColor} shrink-0`} />
        <span className="overflow-hidden">{title}</span>
      </p>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  );
}

// ─── NavItem ───
interface NavItemProps {
  icon: LucideIcon;
  label: string;
  path: string;
  active: boolean;
  color: string;
  badge?: number;
  moduleTheme: ModuleTheme;
  showHeart?: boolean;
}

const colorMap: Record<string, string> = {
  pink: 'text-pink-500 dark:text-pink-300',
  purple: 'text-purple-500 dark:text-purple-300',
  orange: 'text-orange-500 dark:text-orange-300',
  teal: 'text-blue-500 dark:text-blue-300',
  blue: 'text-sky-500 dark:text-sky-300',
  rose: 'text-rose-500 dark:text-rose-300',
  green: 'text-emerald-500 dark:text-emerald-300',
  indigo: 'text-indigo-500 dark:text-indigo-300',
  slate: 'text-slate-500 dark:text-slate-400',
};

function NavItem({ icon: Icon, label, path, active, color, badge, moduleTheme, showHeart = true }: NavItemProps) {
  const { isCollapsed } = useSidebar();
  const isBlueModule = moduleTheme.primary === 'blue';

  return (
    <Link href={path} className="block group relative cursor-pointer" title={isCollapsed ? label : undefined}>
      <div
        data-nav-active={active && isBlueModule ? 'true' : undefined}
        className={`
          relative flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium overflow-hidden
          ${active
            ? (isBlueModule
              ? 'text-[#fafafa] z-[1]'
              : `${moduleTheme.activeGradient} text-white ${moduleTheme.shadowActive}`)
            : (isBlueModule
              ? 'text-white/50 hover:text-white/90 hover:bg-white/[0.04]'
              : `text-slate-600 dark:text-[#a1a1aa] ${moduleTheme.hoverBg} hover:text-slate-900 dark:hover:text-[#fafafa]`)}
        `}
      >
        <Icon
          className={`w-5 h-5 transition-colors shrink-0 ${active ? (isBlueModule ? 'text-[#fafafa]' : 'text-white') : (isBlueModule ? 'text-white/40' : (colorMap[color] || 'text-slate-400 dark:text-[#71717a]'))}`}
        />
        <span
          className={`sidebar-content-transition whitespace-nowrap overflow-hidden inline-block ${isCollapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-auto ml-3'}`}
          style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
        >
          {label}
        </span>

        {badge !== undefined && badge > 0 && (
          <div
            className={`${isCollapsed ? 'absolute -right-0.5 -top-0.5' : 'ml-auto mr-5'} transition-all duration-500 ease-in-out z-10`}
          >
            <span className="relative flex items-center justify-center">
              {/* Glow pulse */}
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-30" style={{ animationDuration: '2s' }} />
              {/* Badge */}
              <span className={`relative flex ${badge > 99 ? 'min-w-[24px] px-1.5' : 'h-[22px] w-[22px]'} items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(16,185,129,0.4)]`}>
                {badge > 99 ? '99+' : badge}
              </span>
            </span>
          </div>
        )}

        {showHeart && active && (!badge || badge === 0) && (
          <div
            className={`absolute right-3 transition-all duration-500 ease-in-out ${isCollapsed ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}
            style={{ transitionDelay: isCollapsed ? '0ms' : '250ms' }}
          >
            <Heart className="w-3 h-3 fill-white text-white" />
          </div>
        )}

        {isCollapsed && (
          <div className="absolute left-full ml-2 px-3 py-2 bg-[#252530] text-[#fafafa] text-xs font-medium rounded-lg border border-[#3d3d48] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
            {label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#252530]"></div>
          </div>
        )}
      </div>
    </Link>
  );
}
