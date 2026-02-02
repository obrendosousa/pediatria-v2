'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  MessageSquare, CalendarDays, Settings, LogOut, LucideIcon, 
  LayoutDashboard, Trello, Stethoscope, CheckSquare, Bot, 
  Store, PieChart, Heart, Sparkles, Users, Moon, Sun,
  ChevronLeft, ChevronRight, Zap
} from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';
import { useUnreadChatsCount } from '@/hooks/useUnreadChatsCount';

export default function Navigation() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { unreadCount, totalChats } = useUnreadChatsCount();
  const isActive = (path: string) => path === '/' ? pathname === '/' : pathname.startsWith(path);

  // --- LÓGICA DO TEMA (CORRIGIDA) ---
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // 1. Verifica se há preferência salva
    const savedTheme = localStorage.getItem('theme');
    
    // 2. Decide qual tema usar
    // Se tiver salvo 'dark' OU (não tiver salvo nada E o sistema for dark)
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme === 'dark' || (!savedTheme && systemIsDark) ? 'dark' : 'light';

    // 3. Aplica o estado e a classe
    setTheme(initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
    // Força a atualização da classe no HTML
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Salva a preferência
    localStorage.setItem('theme', newTheme);
  };

  return (
    <div 
      className="flex flex-col bg-white dark:bg-[#1e2028] border-r border-pink-100 dark:border-gray-800 shadow-[4px_0_24px_rgba(249,168,212,0.1)] dark:shadow-none relative z-50 h-screen overflow-hidden sidebar-transition"
      style={{ 
        width: isCollapsed ? '80px' : '256px',
        minWidth: isCollapsed ? '80px' : '256px',
        maxWidth: isCollapsed ? '80px' : '256px',
      }}
    >
      
      {/* --- FUNDO DISCRETO --- */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30 dark:opacity-10">
        <div className="absolute top-[-10%] left-[-20%] w-48 h-48 bg-pink-100 dark:bg-pink-500 rounded-full blur-[60px]"></div>
      </div>

      {/* --- LOGO COMPACTA --- */}
      <div className="relative z-10 flex flex-col items-center pt-14 pb-4 px-4 border-b border-pink-50 dark:border-gray-800 overflow-hidden">
        
        {/* Botão Toggle Minimizar - Dentro do Menu */}
        <button
          onClick={toggleSidebar}
          className={`absolute ${isCollapsed ? 'top-3 right-2' : 'top-3 right-3'} z-50 w-7 h-7 rounded-full bg-white dark:bg-[#1e2028] border-2 border-pink-200 dark:border-gray-700 shadow-lg flex items-center justify-center hover:bg-pink-50 dark:hover:bg-gray-800 transition-all duration-300 hover:scale-110 active:scale-95 group`}
          aria-label={isCollapsed ? 'Expandir menu' : 'Minimizar menu'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-pink-600 dark:text-pink-400 transition-all duration-300 group-hover:translate-x-0.5" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-pink-600 dark:text-pink-400 transition-all duration-300 group-hover:-translate-x-0.5" />
          )}
        </button>
        <div className="flex items-center gap-3 w-full mb-2 transition-all duration-300">
            <div className="relative w-10 h-10 flex items-center justify-center bg-white dark:bg-[#2a2d36] rounded-xl shadow-sm border border-pink-100 dark:border-gray-700 p-1 transition-colors shrink-0">
                <img 
                  src="https://i.imgur.com/W5fMxRM.png" 
                  alt="Logo" 
                  className="w-full h-full object-contain" 
                />
            </div>
            <div 
              className={`text-left sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}
              style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
            >
                <h2 className="text-sm font-bold text-slate-700 dark:text-gray-100 leading-tight">Centro Médico<br/>Aliança</h2>
            </div>
        </div>
        <span 
          className={`text-[10px] font-bold text-pink-400 dark:text-pink-300 bg-pink-50 dark:bg-pink-900/20 px-2 py-0.5 rounded-md uppercase tracking-wider w-full text-center sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 h-0 mt-0' : 'opacity-100 h-auto mt-2'}`}
          style={{ transitionDelay: isCollapsed ? '0ms' : '250ms' }}
        >
            Pediatria Integrada
        </span>
      </div>

      {/* --- NAVEGAÇÃO COMPACTA --- */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-6 py-4">
        
        <MenuGroup title="Operacional">
            <NavItem icon={LayoutDashboard} label="Dashboard" path="/dashboard" active={isActive('/dashboard')} color="blue" />
            <NavItem 
              icon={MessageSquare} 
              label="Atendimento" 
              path="/" 
              active={isActive('/')} 
              color="pink" 
              badge={unreadCount > 0 ? unreadCount : undefined}
            />
            <NavItem icon={Trello} label="Recepção & CRM" path="/crm" active={isActive('/crm')} color="purple" />
            <NavItem icon={CheckSquare} label="Tarefas" path="/tasks" active={isActive('/tasks')} color="orange" />
        </MenuGroup>
        
        <MenuGroup title="Clínico">
            <NavItem icon={Stethoscope} label="Painel Médico" path="/doctor" active={isActive('/doctor')} color="teal" />
            <NavItem icon={CalendarDays} label="Agenda" path="/agenda" active={isActive('/agenda')} color="blue" />
        </MenuGroup>
        
        <MenuGroup title="Gestão">
            <NavItem icon={Users} label="Clientes & Prontuário" path="/clients" active={isActive('/clients')} color="blue" />
            <NavItem icon={Store} label="Loja & Estoque" path="/loja" active={isActive('/loja')} color="rose" />
            <NavItem icon={PieChart} label="Financeiro" path="/financeiro" active={isActive('/financeiro')} color="green" />
        </MenuGroup>

        <MenuGroup title="Sistema">
            <NavItem icon={Zap} label="Automações" path="/automatizacoes" active={isActive('/automatizacoes')} color="indigo" />
            <NavItem icon={Settings} label="Configurações" path="/configuracoes" active={isActive('/configuracoes')} color="slate" />
        </MenuGroup>

      </nav>

      {/* --- FOOTER COM TOGGLE DE TEMA --- */}
      <div className="p-3 border-t border-pink-50 dark:border-gray-800 bg-white dark:bg-[#1e2028] transition-colors space-y-2">
        
        {/* Botão de Tema */}
        <button 
            onClick={toggleTheme}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-gray-700 relative`}
            title={isCollapsed ? (theme === 'light' ? 'Modo Claro' : 'Modo Escuro') : undefined}
        >
            <div className="flex items-center gap-2">
                {theme === 'light' ? (
                    <Sun className="w-4 h-4 text-orange-400 shrink-0" />
                ) : (
                    <Moon className="w-4 h-4 text-blue-300 shrink-0" />
                )}
                <span 
                  className={`text-xs font-bold text-slate-500 dark:text-gray-400 group-hover:text-slate-800 dark:group-hover:text-gray-200 sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}
                  style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
                >
                    {theme === 'light' ? 'Modo Claro' : 'Modo Escuro'}
                </span>
            </div>
            <div 
              className={`w-8 h-4 rounded-full p-0.5 sidebar-content-transition ${theme === 'dark' ? 'bg-blue-500' : 'bg-gray-300'} ${isCollapsed ? 'opacity-0 scale-0 w-0' : 'opacity-100 scale-100 w-8'}`}
              style={{ transitionDelay: isCollapsed ? '0ms' : '250ms' }}
            >
                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            
            {/* Tooltip quando minimizado */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
                {theme === 'light' ? 'Modo Claro' : 'Modo Escuro'}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-800"></div>
              </div>
            )}
        </button>

        {/* Botão de Logout */}
        <div 
          className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group cursor-pointer relative`}
          title={isCollapsed ? 'Sistema Online' : undefined}
        >
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0"></div>
                <span 
                  className={`text-xs font-bold text-slate-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}
                  style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
                >
                  Sistema Online
                </span>
            </div>
            <LogOut 
              className={`w-4 h-4 text-slate-300 dark:text-gray-600 group-hover:text-red-400 sidebar-content-transition shrink-0 ${isCollapsed ? 'opacity-0 scale-0 w-0' : 'opacity-100 scale-100 w-4'}`}
              style={{ transitionDelay: isCollapsed ? '0ms' : '250ms' }}
            />
            
            {/* Tooltip quando minimizado */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
                Sistema Online
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-800"></div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function MenuGroup({ title, children }: { title: string, children: React.ReactNode }) {
    const { isCollapsed } = useSidebar();
    
    return (
        <div>
            <p 
              className={`px-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1 sidebar-content-transition whitespace-nowrap overflow-hidden ${isCollapsed ? 'opacity-0 h-0 mb-0' : 'opacity-100 h-auto mb-1'}`}
              style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
            >
                <Sparkles className="w-3 h-3 text-pink-300 dark:text-pink-700 shrink-0" /> 
                <span className="overflow-hidden">{title}</span>
            </p>
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
  color: string;
  badge?: number; // Contador de notificações
}

function NavItem({ icon: Icon, label, path, active, color, badge }: NavItemProps) {
  const { isCollapsed } = useSidebar();
  
  const colorMap: any = {
      pink: 'text-pink-500 dark:text-pink-300', 
      purple: 'text-purple-500 dark:text-purple-300', 
      orange: 'text-orange-500 dark:text-orange-300',
      teal: 'text-teal-500 dark:text-teal-300', 
      blue: 'text-sky-500 dark:text-sky-300', 
      rose: 'text-rose-500 dark:text-rose-300',
      green: 'text-emerald-500 dark:text-emerald-300', 
      indigo: 'text-indigo-500 dark:text-indigo-300', 
      slate: 'text-slate-500 dark:text-slate-400',
  };

  return (
    <Link href={path} className="block group relative" title={isCollapsed ? label : undefined}>
      <div className={`
        relative flex items-center px-3 py-2 rounded-xl transition-all duration-200 text-sm font-medium overflow-hidden
        ${active 
          ? 'bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-md shadow-pink-200 dark:shadow-none' 
          : 'text-slate-600 dark:text-gray-400 hover:bg-pink-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-gray-100'}
      `}>
        <Icon 
          className={`w-5 h-5 transition-colors shrink-0 ${active ? 'text-white' : colorMap[color]}`}
        />
        <span 
          className={`sidebar-content-transition whitespace-nowrap overflow-hidden inline-block ${isCollapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-auto ml-3'}`}
          style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}
        >
          {label}
        </span>
        
        {/* Badge de notificação (só aparece quando há mensagens não lidas) */}
        {badge !== undefined && badge > 0 && (
          <div 
            className={`absolute ${isCollapsed ? 'right-1 top-1' : 'right-2 top-1.5'} transition-all duration-500 ease-in-out z-10`}
          >
            <span className={`flex ${badge > 99 ? 'min-w-[28px] px-1.5' : 'h-5 w-5'} items-center justify-center rounded-full bg-[#25d366] text-[10px] font-bold text-white shadow-lg ring-2 ring-white dark:ring-[#1e2028]`}>
              {badge > 99 ? '99+' : badge}
            </span>
          </div>
        )}
        
        {/* Coração (só aparece quando está ativo E não há badge) */}
        {active && (!badge || badge === 0) && (
            <div 
              className={`absolute right-3 transition-all duration-500 ease-in-out ${isCollapsed ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}
              style={{ transitionDelay: isCollapsed ? '0ms' : '250ms' }}
            >
                <Heart className="w-3 h-3 fill-white text-white" />
            </div>
        )}
        
        {/* Tooltip quando minimizado */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
            {label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-800"></div>
            </div>
        )}
      </div>
    </Link>
  );
}