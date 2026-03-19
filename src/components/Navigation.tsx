'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageSquare, CalendarDays, Settings, LogOut, LucideIcon,
  LayoutDashboard, Trello, Stethoscope, CheckSquare,
  Store, PieChart, Heart, Sparkles, Users, Moon, Sun,
  ChevronRight, Zap, FileText, ArrowLeftRight, Receipt,
  ClipboardList, Ban, DollarSign, BarChart3, BookOpen, Monitor, ExternalLink,
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
  const [indicatorStyle, setIndicatorStyle] = useState<{ top: number; height: number; animate: boolean } | null>(null);
  const prevCollapsedRef = useRef(isCollapsed);
  const isFirstRender = useRef(true);

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

  // Measure indicator position
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measure = (animate: boolean) => {
      const activeEl = nav.querySelector('[data-nav-active="true"]') as HTMLElement | null;
      if (!activeEl) { setIndicatorStyle(null); return; }
      const navRect = nav.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();
      setIndicatorStyle({
        top: itemRect.top - navRect.top + nav.scrollTop,
        height: itemRect.height,
        animate,
      });
    };

    const collapseChanged = prevCollapsedRef.current !== isCollapsed;
    prevCollapsedRef.current = isCollapsed;

    if (isFirstRender.current) {
      // First render: measure without transition, then enable
      isFirstRender.current = false;
      requestAnimationFrame(() => {
        measure(false);
        requestAnimationFrame(() => measure(true));
      });
      return;
    }

    if (collapseChanged) {
      // Sidebar toggled: poll positions during layout shift (no CSS transition)
      let rafId: number;
      const start = performance.now();
      const poll = () => {
        measure(false);
        if (performance.now() - start < 500) {
          rafId = requestAnimationFrame(poll);
        } else {
          measure(true);
        }
      };
      rafId = requestAnimationFrame(poll);
      return () => cancelAnimationFrame(rafId);
    }

    // Route change: just measure (CSS transition will animate)
    requestAnimationFrame(() => measure(true));
  }, [pathname, isCollapsed]);

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
      className={`flex shrink-0 flex-col sidebar-slide-in ${isAtendimento ? 'bg-[#0B1120] border-r border-[#1a2744]/60' : 'bg-[#110B18] border-r border-[#2a1538]/60'} dark:shadow-none relative z-10 h-screen overflow-hidden sidebar-transition`}
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

      {/* --- PARTÍCULAS --- */}
      {isAtendimento ? (
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
      ) : (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[8%] left-[15%] w-1 h-1 bg-white/15 rounded-full animate-[float_6s_ease-in-out_infinite]" />
          <div className="absolute top-[15%] right-[20%] w-1.5 h-1.5 bg-pink-400/10 rounded-full animate-[float_8s_ease-in-out_infinite_1s]" />
          <div className="absolute top-[25%] left-[60%] w-1 h-1 bg-white/10 rounded-full animate-[float_7s_ease-in-out_infinite_2s]" />
          <div className="absolute top-[35%] left-[25%] w-1 h-1 bg-rose-300/10 rounded-full animate-[float_9s_ease-in-out_infinite_0.5s]" />
          <div className="absolute top-[42%] right-[15%] w-1.5 h-1.5 bg-white/10 rounded-full animate-[float_5s_ease-in-out_infinite_3s]" />
          <div className="absolute top-[50%] left-[40%] w-1 h-1 bg-pink-400/10 rounded-full animate-[float_10s_ease-in-out_infinite_1.5s]" />
          <div className="absolute top-[58%] left-[10%] w-1 h-1 bg-white/15 rounded-full animate-[float_6s_ease-in-out_infinite_4s]" />
          <div className="absolute top-[65%] right-[30%] w-1.5 h-1.5 bg-rose-400/10 rounded-full animate-[float_8s_ease-in-out_infinite_2.5s]" />
          <div className="absolute top-[72%] left-[50%] w-1 h-1 bg-white/10 rounded-full animate-[float_7s_ease-in-out_infinite_0.8s]" />
          <div className="absolute top-[80%] left-[20%] w-1 h-1 bg-pink-300/10 rounded-full animate-[float_9s_ease-in-out_infinite_3.5s]" />
          <div className="absolute top-[88%] right-[25%] w-1.5 h-1.5 bg-white/10 rounded-full animate-[float_5s_ease-in-out_infinite_1.2s]" />
          <div className="absolute top-[95%] left-[35%] w-1 h-1 bg-rose-300/15 rounded-full animate-[float_11s_ease-in-out_infinite_4.5s]" />
        </div>
      )}

      {/* --- HEADER / LOGO --- */}
      <div className="relative z-10 flex flex-col items-center pt-14 pb-4 px-4 border-b border-white/[0.06] overflow-hidden">

        {/* Botão Toggle */}
        <button
          onClick={toggleSidebar}
          className={`absolute top-3 z-50 w-7 h-7 rounded-full ${isAtendimento ? 'bg-[#0B1120]' : 'bg-[#110B18]'} border-2 border-white/10 text-white/60 hover:bg-white/10 shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group cursor-pointer`}
          style={{ right: isCollapsed ? '8px' : '12px', transition: 'right 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          aria-label={isCollapsed ? 'Expandir menu' : 'Minimizar menu'}
        >
          <ChevronRight
            className={`w-4 h-4 ${mt.textBold} transition-all duration-400`}
            style={{
              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </button>

        <div
          className="flex items-center w-full mb-2"
          style={{
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: isCollapsed ? '0px' : '12px',
            transition: 'gap 0.4s cubic-bezier(0.22, 1, 0.36, 1), justify-content 0.4s ease',
          }}
        >
          <div
            className={`relative flex items-center justify-center bg-white dark:bg-[#1c1c21] rounded-xl shadow-sm border ${isAtendimento ? 'border-slate-200 dark:border-[#2d2d36]' : 'border-pink-100 dark:border-[#2d2d36]'} p-1 shrink-0`}
            style={{
              width: isCollapsed ? '36px' : '40px',
              height: isCollapsed ? '36px' : '40px',
              transition: 'width 0.4s cubic-bezier(0.22, 1, 0.36, 1), height 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://i.imgur.com/W5fMxRM.png"
              alt="Logo Centro Médico Aliança"
              className="w-full h-full object-contain"
            />
          </div>
          <div
            className="text-left whitespace-nowrap overflow-hidden"
            style={{
              opacity: isCollapsed ? 0 : 1,
              maxWidth: isCollapsed ? '0px' : '160px',
              transition: isCollapsed
                ? 'opacity 0.15s ease, max-width 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
                : 'max-width 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease 0.15s',
            }}
          >
            <h2 className="text-sm font-bold leading-tight text-white/90">Centro Médico<br />Aliança</h2>
          </div>
        </div>

        {/* Module badge */}
        <span
          className={`text-[10px] font-bold ${isAtendimento ? `${mt.text} ${mt.bgSubtle}` : 'text-pink-400 bg-pink-950/30'} px-2 rounded-md uppercase tracking-wider w-full text-center whitespace-nowrap overflow-hidden`}
          style={{
            opacity: isCollapsed ? 0 : 1,
            maxHeight: isCollapsed ? '0px' : '24px',
            paddingTop: isCollapsed ? '0px' : '2px',
            paddingBottom: isCollapsed ? '0px' : '2px',
            marginTop: isCollapsed ? '0px' : '8px',
            transition: isCollapsed
              ? 'opacity 0.12s ease, max-height 0.25s ease 0.05s, padding 0.25s ease 0.05s, margin 0.25s ease 0.05s'
              : 'max-height 0.3s ease 0.1s, padding 0.3s ease 0.1s, margin 0.3s ease 0.1s, opacity 0.25s ease 0.2s',
          }}
        >
          {currentModule.sublabel}
        </span>

        {/* Switcher de módulo */}
        {hasMultipleModules && !isDoctor && (
          <Link
            href={isAtendimento ? '/' : '/atendimento'}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium w-full justify-center cursor-pointer text-white/40 hover:text-white/70 hover:bg-white/5"
            style={{
              opacity: isCollapsed ? 0 : 1,
              maxHeight: isCollapsed ? '0px' : '32px',
              marginTop: isCollapsed ? '0px' : '8px',
              pointerEvents: isCollapsed ? 'none' : 'auto',
              transition: isCollapsed
                ? 'opacity 0.12s ease, max-height 0.2s ease 0.05s, margin 0.2s ease 0.05s'
                : 'max-height 0.3s ease 0.15s, margin 0.3s ease 0.15s, opacity 0.25s ease 0.25s',
              overflow: 'hidden',
            }}
          >
            <ArrowLeftRight className="w-3 h-3 shrink-0" />
            <span className="whitespace-nowrap">{isAtendimento ? 'Ir para Pediatria' : 'Ir para Clínica Geral'}</span>
          </Link>
        )}
      </div>

      {/* --- NAVEGAÇÃO --- */}
      <nav
        ref={navRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 relative"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isCollapsed ? '8px' : '24px',
          transition: 'gap 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >

        {/* ── Floating Indicator ── */}
        {indicatorStyle && (
          <div
            className="absolute left-3 right-3 rounded-xl pointer-events-none z-0"
            style={{
              top: indicatorStyle.top,
              height: indicatorStyle.height,
              transition: indicatorStyle.animate
                ? 'top 0.4s cubic-bezier(0.22, 1, 0.36, 1), height 0.3s ease, opacity 0.3s ease, background 0.4s ease'
                : 'none',
              background: isCollapsed
                ? (isAtendimento
                  ? 'radial-gradient(ellipse at center, rgba(255,255,255,0.10) 0%, transparent 70%)'
                  : 'radial-gradient(ellipse at center, rgba(255,228,237,0.12) 0%, transparent 70%)')
                : (isAtendimento
                  ? 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.02) 30%, rgba(255,255,255,0.08) 70%, rgba(255,255,255,0.15) 100%)'
                  : 'linear-gradient(90deg, transparent 0%, rgba(255,228,237,0.03) 30%, rgba(255,228,237,0.08) 70%, rgba(255,228,237,0.16) 100%)'),
              border: isCollapsed
                ? '1px solid transparent'
                : (isAtendimento
                  ? '1px solid rgba(255,255,255,0.08)'
                  : '1px solid rgba(255,228,237,0.10)'),
            }}
          >
            {isAtendimento ? (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-white"
                style={{
                  height: '55%',
                  boxShadow: '0 0 8px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.15)',
                  right: isCollapsed ? '4px' : '8px',
                  opacity: isCollapsed ? 0.7 : 1,
                  transition: 'right 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
                }}
              />
            ) : (
              <Heart
                className="absolute top-1/2 w-3.5 h-3.5 fill-pink-200 text-pink-200"
                style={{
                  filter: 'drop-shadow(0 0 6px rgba(255,228,237,0.6)) drop-shadow(0 0 12px rgba(255,228,237,0.25))',
                  opacity: isCollapsed ? 0 : 1,
                  right: '10px',
                  transform: `translateY(-50%) scale(${isCollapsed ? 0 : 1})`,
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                }}
              />
            )}
          </div>
        )}

        {isAtendimento && isDoctor ? (
          <>
            <MenuGroup title="Clínico" moduleTheme={mt} isFirst>
              <NavItem icon={Stethoscope} label="Painel Médico" path="/atendimento/doctor" active={isActive('/atendimento/doctor')} color="teal" moduleTheme={mt} />
              <NavItem icon={CalendarDays} label="Minha Agenda" path="/atendimento/agenda" active={pathname === '/atendimento/agenda'} color="blue" moduleTheme={mt} />
              <NavItem icon={Users} label="Meus Pacientes" path="/atendimento/clients" active={isActive('/atendimento/clients')} color="blue" moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Operacional" moduleTheme={mt}>
              <NavItem icon={Trello} label="CRM" path="/atendimento/crm" active={isActive('/atendimento/crm')} color="purple" moduleTheme={mt} />
              <NavItem icon={CheckSquare} label="Tarefas" path="/atendimento/tasks" active={isActive('/atendimento/tasks')} color="orange" moduleTheme={mt} />
            </MenuGroup>
          </>
        ) : isAtendimento ? (
          <>
            <MenuGroup title="Operacional" moduleTheme={mt} isFirst>
              <NavItem icon={LayoutDashboard} label="Dashboard" path="/atendimento/dashboard" active={isActive('/atendimento/dashboard')} color="blue" moduleTheme={mt} />
              <NavItem icon={MessageSquare} label="Chat" path="/atendimento" active={pathname === '/atendimento'} badge={unreadCount > 0 ? unreadCount : undefined} color="teal" moduleTheme={mt} />
              <NavItem icon={Trello} label="CRM" path="/atendimento/crm" active={isActive('/atendimento/crm')} color="purple" moduleTheme={mt} />
              <NavItem icon={CheckSquare} label="Tarefas" path="/atendimento/tasks" active={isActive('/atendimento/tasks')} color="orange" moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Clínico" moduleTheme={mt}>
              <NavItem icon={Stethoscope} label="Painel Médico" path="/atendimento/doctor" active={isActive('/atendimento/doctor')} color="teal" moduleTheme={mt} />
              <a
                href="/atendimento/tv"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center py-1.5 mx-1 rounded-lg text-[11px] font-medium text-slate-400 dark:text-[#52525b] hover:text-slate-600 dark:hover:text-[#a1a1aa] hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  paddingLeft: isCollapsed ? '0px' : '12px',
                  paddingRight: isCollapsed ? '0px' : '12px',
                  transition: 'padding 0.4s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s ease, color 0.2s ease',
                }}
                title={isCollapsed ? 'Abrir Painel TV' : 'Abrir Painel TV em tela cheia'}
              >
                <Monitor className="w-3.5 h-3.5 shrink-0" />
                <span
                  className="whitespace-nowrap overflow-hidden"
                  style={{
                    opacity: isCollapsed ? 0 : 1,
                    maxWidth: isCollapsed ? '0px' : '120px',
                    marginLeft: isCollapsed ? '0px' : '12px',
                    transition: isCollapsed
                      ? 'opacity 0.12s ease, max-width 0.25s cubic-bezier(0.22, 1, 0.36, 1) 0.03s, margin-left 0.25s cubic-bezier(0.22, 1, 0.36, 1) 0.03s'
                      : 'max-width 0.35s cubic-bezier(0.22, 1, 0.36, 1) 0.08s, margin-left 0.35s cubic-bezier(0.22, 1, 0.36, 1) 0.08s, opacity 0.25s ease 0.18s',
                  }}
                >
                  Abrir Painel TV
                </span>
                <ExternalLink
                  className="w-3 h-3 shrink-0"
                  style={{
                    opacity: isCollapsed ? 0 : 0.5,
                    maxWidth: isCollapsed ? '0px' : '12px',
                    marginLeft: isCollapsed ? '0px' : 'auto',
                    transition: isCollapsed
                      ? 'opacity 0.1s ease, max-width 0.2s ease'
                      : 'max-width 0.3s ease 0.15s, opacity 0.25s ease 0.2s',
                    overflow: 'hidden',
                  }}
                />
              </a>
            </MenuGroup>

            <MenuGroup title="Agenda" moduleTheme={mt}>
              <NavItem icon={CalendarDays} label="Agenda" path="/atendimento/agenda" active={pathname === '/atendimento/agenda'} color="blue" moduleTheme={mt} />
              <NavItem icon={ClipboardList} label="Gerenciar" path="/atendimento/agenda/gerenciar" active={isActive('/atendimento/agenda/gerenciar')} color="slate" moduleTheme={mt} />
              <NavItem icon={Ban} label="Bloqueios" path="/atendimento/agenda/bloqueios" active={isActive('/atendimento/agenda/bloqueios')} color="rose" moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Gestão" moduleTheme={mt}>
              <NavItem icon={Users} label="Pacientes" path="/atendimento/clients" active={isActive('/atendimento/clients')} color="blue" moduleTheme={mt} />
              <NavItem icon={Receipt} label="Orçamentos" path="/atendimento/orcamentos" active={isActive('/atendimento/orcamentos')} color="orange" moduleTheme={mt} />
              <NavItem icon={DollarSign} label="Financeiro" path="/atendimento/financeiro" active={pathname === '/atendimento/financeiro'} color="green" moduleTheme={mt} />
              <NavItem icon={FileText} label="NF-e" path="/atendimento/financeiro/nfe" active={isActive('/atendimento/financeiro/nfe')} color="slate" moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Cadastros" moduleTheme={mt}>
              <NavItem icon={BookOpen} label="Cadastros" path="/atendimento/cadastros" active={isActive('/atendimento/cadastros')} color="indigo" moduleTheme={mt} />
            </MenuGroup>

            <MenuGroup title="Sistema" moduleTheme={mt}>
              <NavItem icon={BarChart3} label="Relatórios" path="/atendimento/relatorios" active={isActive('/atendimento/relatorios')} color="indigo" moduleTheme={mt} />
              <NavItem icon={Zap} label="Automações" path="/atendimento/automatizacoes" active={isActive('/atendimento/automatizacoes')} color="indigo" moduleTheme={mt} />
              <NavItem icon={Settings} label="Configurações" path="/atendimento/configuracoes" active={isActive('/atendimento/configuracoes')} color="slate" moduleTheme={mt} />
            </MenuGroup>
          </>
        ) : (
          <>
            {/* Menu da PEDIATRIA — igual à VPS */}
            <MenuGroup title="Operacional" moduleTheme={mt} isFirst>
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
      <div className={`p-3 border-t border-white/[0.06] ${isAtendimento ? 'bg-[#0B1120]' : 'bg-[#110B18]'} transition-colors space-y-1`}>

        {/* Botão de Tema */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center p-2.5 rounded-xl hover:bg-white/[0.06] transition-all duration-200 group cursor-pointer relative"
          style={{ justifyContent: isCollapsed ? 'center' : 'space-between', transition: 'justify-content 0.4s ease' }}
          title={isCollapsed ? (theme === 'light' ? 'Modo Claro' : 'Modo Escuro') : undefined}
        >
          <div className="flex items-center gap-2.5">
            {theme === 'light' ? (
              <Sun className="w-4.5 h-4.5 text-amber-500 shrink-0" />
            ) : (
              <Moon className="w-4.5 h-4.5 text-blue-400 shrink-0" />
            )}
            <span
              className="text-xs font-bold text-white/50 group-hover:text-white/80 whitespace-nowrap overflow-hidden"
              style={{
                opacity: isCollapsed ? 0 : 1,
                maxWidth: isCollapsed ? '0px' : '120px',
                transition: isCollapsed
                  ? 'opacity 0.12s ease, max-width 0.25s cubic-bezier(0.22, 1, 0.36, 1) 0.05s'
                  : 'max-width 0.3s cubic-bezier(0.22, 1, 0.36, 1) 0.1s, opacity 0.25s ease 0.2s',
              }}
            >
              {theme === 'light' ? 'Modo Claro' : 'Modo Escuro'}
            </span>
          </div>
          <div
            className={`h-4 rounded-full p-0.5 ${theme === 'dark' ? 'bg-sky-500' : 'bg-slate-300'}`}
            style={{
              opacity: isCollapsed ? 0 : 1,
              width: isCollapsed ? '0px' : '32px',
              transform: `scale(${isCollapsed ? 0.5 : 1})`,
              transition: isCollapsed
                ? 'opacity 0.12s ease, width 0.2s ease, transform 0.2s ease'
                : 'width 0.3s ease 0.15s, transform 0.3s ease 0.15s, opacity 0.25s ease 0.2s',
              overflow: 'hidden',
            }}
          >
            <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
        </button>

        {/* Botão de Sair */}
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full flex items-center p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all duration-200 group cursor-pointer relative"
          style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', transition: 'justify-content 0.4s ease' }}
          title={isCollapsed ? 'Sair' : undefined}
        >
          <div className="flex items-center gap-2.5">
            <LogOut className="w-4.5 h-4.5 text-white/40 group-hover:text-red-400 shrink-0" />
            <span
              className="text-xs font-bold text-white/50 group-hover:text-red-400 whitespace-nowrap overflow-hidden"
              style={{
                opacity: isCollapsed ? 0 : 1,
                maxWidth: isCollapsed ? '0px' : '60px',
                transition: isCollapsed
                  ? 'opacity 0.12s ease, max-width 0.25s cubic-bezier(0.22, 1, 0.36, 1) 0.05s'
                  : 'max-width 0.3s cubic-bezier(0.22, 1, 0.36, 1) 0.1s, opacity 0.25s ease 0.2s',
              }}
            >
              Sair
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── MenuGroup com Sparkles ───
function MenuGroup({ title, children, moduleTheme, isFirst = false }: { title: string; children: React.ReactNode; moduleTheme: ModuleTheme; isFirst?: boolean }) {
  const { isCollapsed } = useSidebar();

  return (
    <div>
      {/* Título expandido */}
      <p
        className="px-3 text-[10px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1 whitespace-nowrap overflow-hidden"
        style={{
          opacity: isCollapsed ? 0 : 1,
          maxHeight: isCollapsed ? '0px' : '20px',
          marginBottom: isCollapsed ? '0px' : '4px',
          transition: isCollapsed
            ? 'opacity 0.12s ease, max-height 0.2s ease 0.05s, margin-bottom 0.2s ease 0.05s'
            : 'max-height 0.3s ease 0.1s, margin-bottom 0.3s ease 0.1s, opacity 0.25s ease 0.2s',
        }}
      >
        <Sparkles className={`w-3 h-3 ${moduleTheme.sparkleColor} shrink-0`} />
        <span className="overflow-hidden">{title}</span>
      </p>
      {/* Separador colapsado (pontinho sutil entre seções) */}
      {!isFirst && (
        <div
          className="flex justify-center"
          style={{
            opacity: isCollapsed ? 1 : 0,
            maxHeight: isCollapsed ? '12px' : '0px',
            marginBottom: isCollapsed ? '4px' : '0px',
            transition: isCollapsed
              ? 'opacity 0.25s ease 0.15s, max-height 0.3s ease 0.1s, margin-bottom 0.3s ease 0.1s'
              : 'opacity 0.1s ease, max-height 0.2s ease 0.05s, margin-bottom 0.2s ease 0.05s',
            overflow: 'hidden',
          }}
        >
          <div
            className={`rounded-full ${moduleTheme.sparkleColor === 'text-blue-400' ? 'bg-white/10' : 'bg-white/10'}`}
            style={{ width: '20px', height: '2px' }}
          />
        </div>
      )}
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
}

function NavItem({ icon: Icon, label, path, active, badge }: NavItemProps) {
  const { isCollapsed } = useSidebar();
  const hasBadge = badge !== undefined && badge > 0;

  return (
    <Link href={path} className="block group cursor-pointer" title={isCollapsed ? label : undefined}>
      <div
        data-nav-active={active ? 'true' : undefined}
        className={`
          relative flex items-center py-2.5 rounded-xl text-sm font-medium
          ${active
            ? 'text-[#fafafa] z-[1]'
            : 'text-white/50 hover:text-white/90 hover:bg-white/[0.04]'}
        `}
        style={{
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          paddingLeft: isCollapsed ? '0px' : '12px',
          paddingRight: isCollapsed ? '0px' : '12px',
          transition: 'padding 0.4s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s ease, color 0.2s ease',
        }}
      >
        {/* Ícone com badge colapsado como wrapper relativo */}
        <div className="relative shrink-0">
          <Icon
            className={`w-5 h-5 ${active ? 'text-[#fafafa]' : 'text-white/40'}`}
            style={{ transition: 'color 0.2s ease' }}
          />
          {/* Badge posicionado sobre o ícone quando colapsado */}
          {hasBadge && (
            <div
              className="absolute z-10"
              style={{
                top: '-6px',
                right: '-8px',
                opacity: isCollapsed ? 1 : 0,
                transform: `scale(${isCollapsed ? 1 : 0})`,
                transition: isCollapsed
                  ? 'opacity 0.25s ease 0.15s, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s'
                  : 'opacity 0.12s ease, transform 0.12s ease',
                pointerEvents: isCollapsed ? 'auto' : 'none',
              }}
            >
              <span className="relative flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-30" style={{ animationDuration: '2s' }} />
                <span className={`relative flex ${badge > 99 ? 'min-w-[16px] px-0.5' : 'h-[16px] w-[16px]'} items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-[8px] font-bold text-white shadow-[0_2px_8px_rgba(16,185,129,0.4)]`}>
                  {badge > 99 ? '99+' : badge}
                </span>
              </span>
            </div>
          )}
        </div>

        <span
          className="whitespace-nowrap overflow-hidden inline-block"
          style={{
            opacity: isCollapsed ? 0 : 1,
            maxWidth: isCollapsed ? '0px' : '180px',
            marginLeft: isCollapsed ? '0px' : '12px',
            transition: isCollapsed
              ? 'opacity 0.12s ease, max-width 0.25s cubic-bezier(0.22, 1, 0.36, 1) 0.03s, margin-left 0.25s cubic-bezier(0.22, 1, 0.36, 1) 0.03s'
              : 'max-width 0.35s cubic-bezier(0.22, 1, 0.36, 1) 0.08s, margin-left 0.35s cubic-bezier(0.22, 1, 0.36, 1) 0.08s, opacity 0.25s ease 0.18s',
          }}
        >
          {label}
        </span>

        {/* Badge inline quando expandido */}
        {hasBadge && (
          <div
            className="z-10"
            style={{
              opacity: isCollapsed ? 0 : 1,
              maxWidth: isCollapsed ? '0px' : '40px',
              marginLeft: isCollapsed ? '0px' : '8px',
              transition: isCollapsed
                ? 'opacity 0.1s ease, max-width 0.2s ease, margin-left 0.2s ease'
                : 'max-width 0.3s ease 0.15s, margin-left 0.3s ease 0.15s, opacity 0.25s ease 0.2s',
              overflow: 'hidden',
            }}
          >
            <span className="relative flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-30" style={{ animationDuration: '2s' }} />
              <span className={`relative flex ${badge > 99 ? 'min-w-[24px] px-1.5' : 'h-[22px] w-[22px]'} items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(16,185,129,0.4)]`}>
                {badge > 99 ? '99+' : badge}
              </span>
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
