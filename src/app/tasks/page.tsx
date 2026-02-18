'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { 
  CheckSquare, Calendar, ChevronLeft, ChevronRight, 
  DollarSign, Printer, ArrowRight, 
  Plus, StickyNote, Trash2, CheckCircle2, GripHorizontal, Check, Undo2
} from 'lucide-react';

// Modais
import CreateTaskModal from '@/components/CreateTaskModal';
import EditNoteModal from '@/components/EditNoteModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { NotificationToast, useNotifications } from '@/components/NotificationToast';

// CORES ADAPTADAS PARA DARK MODE
const NOTES_COLORS: any = {
  white: 'bg-white border-slate-200 text-slate-800 dark:bg-[#2a2d36] dark:border-gray-600 dark:text-gray-100',
  yellow: 'bg-yellow-100 border-yellow-200 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-700/50 dark:text-yellow-200',
  rose: 'bg-rose-100 border-rose-200 text-rose-900 dark:bg-rose-900/20 dark:border-rose-700/50 dark:text-rose-200',
  blue: 'bg-blue-100 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-700/50 dark:text-blue-200',
  purple: 'bg-purple-100 border-purple-200 text-purple-900 dark:bg-purple-900/20 dark:border-purple-700/50 dark:text-purple-200',
  green: 'bg-emerald-100 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-700/50 dark:text-emerald-200',
};

// Horários da Grade (06:00 até 20:00)
const HOURS = Array.from({ length: 15 }, (_, i) => i + 6);

export default function TasksPage() {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'day'>('day');
  const [notesFilter, setNotesFilter] = useState<'active' | 'done'>('active');
  
  // Relógio em Tempo Real
  const [now, setNow] = useState(new Date());

  // Estados de Dados
  const [myTasks, setMyTasks] = useState<any[]>([]);       
  const [stickyNotes, setStickyNotes] = useState<any[]>([]); 

  // Modais e Estados de UI
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'general' | 'sticky_note'>('general');
  
  // Estados de Edição/Ação
  const [editingNote, setEditingNote] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{id: number, table: 'tasks'} | null>(null);
  
  // Estados de Animação
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notificações
  const { notifications, dismissNotification } = useNotifications();

  // Drag & Drop (Mural)
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNote, setDraggedNote] = useState<any>(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // --- EFEITOS ---
  useEffect(() => {
    fetchTasks();
    
    const taskChannel = supabase.channel('tasks_reception_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => { fetchTasks(); })
        .subscribe();
    
    const timer = setInterval(() => setNow(new Date()), 60000);

    return () => { 
        supabase.removeChannel(taskChannel);
        clearInterval(timer);
    };
  }, [currentDate]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    } else {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragPosition]);

  async function fetchTasks() {
    // 1. Tarefas pendentes (financeiras e ordens médicas)
    const { data: tasks } = await supabase
        .from('tasks')
        .select('*, chats(phone, contact_name)')
        .eq('status', 'pending')
        .in('type', ['financial', 'medical_order']) 
        .order('created_at', { ascending: false });
    
    // 2. Agenda
    const { data: general } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'general')
        .neq('status', 'deleted')
        .order('due_time', { ascending: true });
    
    if (general) setMyTasks(general);

    // 3. Mural
    const { data: notes } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'sticky_note')
        .neq('status', 'deleted')
        .order('position', { ascending: true });
        
    if (notes) setStickyNotes(notes);
    
    setLoading(false);
  }

  // --- ACTIONS ---

  const handleToggleStatus = async (id: number, currentStatus: string, shouldVanish: boolean, isNote: boolean) => {
      const newStatus = currentStatus === 'done' ? 'pending' : 'done';
      if (newStatus === 'done' && shouldVanish) {
          setCompletingId(id); 
          setTimeout(async () => {
              if (isNote) setStickyNotes(prev => prev.map(n => n.id === id ? { ...n, status: 'done' } : n));
              else setMyTasks(prev => prev.map(n => n.id === id ? { ...n, status: 'done' } : n));
              await supabase.from('tasks').update({ status: newStatus }).eq('id', id); setCompletingId(null); fetchTasks();
          }, 800);
      } else {
          await supabase.from('tasks').update({ status: newStatus }).eq('id', id); fetchTasks();
      }
  };

  const requestDelete = (id: number) => setItemToDelete({ id, table: 'tasks' });
  
  const handleConfirmDelete = async () => {
      if (!itemToDelete) return;
      const { id, table } = itemToDelete;
      
      setIsDeleting(true);
      setDeletingId(id);

      try {
          // Atualização otimista da UI
          setStickyNotes(prev => prev.filter(n => n.id !== id));
          setMyTasks(prev => prev.filter(n => n.id !== id));

          await supabase.from('tasks').update({ status: 'deleted' }).eq('id', id);

          setItemToDelete(null);
          setDeletingId(null);
          fetchTasks();
      } catch (error) {
          console.error('Erro ao deletar item:', error);
          // Reverter atualização otimista em caso de erro
          fetchTasks();
      } finally {
          setIsDeleting(false);
      }
  };
  
  const toggleChecklistItem = async (noteId: number, itemIndex: number, isNote: boolean) => {
      const list = isNote ? stickyNotes : myTasks;
      const item = list.find(n => n.id === noteId); if(!item) return;
      const newChecklist = [...(item.metadata?.checklist || [])]; 
      if (newChecklist[itemIndex]) {
          newChecklist[itemIndex].done = !newChecklist[itemIndex].done;
          const setList = isNote ? setStickyNotes : setMyTasks;
          setList(list.map(n => n.id === noteId ? { ...n, metadata: { ...n.metadata, checklist: newChecklist } } : n));
          await supabase.from('tasks').update({ metadata: { ...item.metadata, checklist: newChecklist } }).eq('id', noteId);
      }
  };

  const handleMouseDown = (e: React.MouseEvent, note: any, index: number) => { 
    if (e.button !== 0) return; 
    if ((e.target as HTMLElement).closest('button')) return; 
    setIsDragging(true); 
    setDraggedNote(note); 
    setDragPosition({ x: e.clientX, y: e.clientY }); 
    setDropIndex(index); 
    document.body.style.userSelect = 'none'; 
  };

  const handleGlobalMouseMove = (e: MouseEvent) => { 
    setDragPosition({ x: e.clientX, y: e.clientY }); 
    if (listRef.current) { 
        const listRect = listRef.current.getBoundingClientRect(); 
        if (e.clientX < listRect.left || e.clientX > listRect.right) return; 
        let newDropIndex = stickyNotes.length; 
        for (let i = 0; i < stickyNotes.length; i++) { 
            const itemEl = itemRefs.current[i]; 
            if (itemEl) { 
                const rect = itemEl.getBoundingClientRect(); 
                const middleY = rect.top + (rect.height / 2); 
                if (e.clientY < middleY) { newDropIndex = i; break; } 
            } 
        } 
        setDropIndex(newDropIndex); 
    } 
  };

  const handleGlobalMouseUp = async () => { 
    setIsDragging(false); 
    document.body.style.userSelect = 'auto'; 
    if (draggedNote && dropIndex !== null) { 
        const oldIndex = stickyNotes.findIndex(n => n.id === draggedNote.id); 
        if (oldIndex !== dropIndex && oldIndex !== dropIndex - 1) { 
            const newList = [...stickyNotes]; 
            const [movedItem] = newList.splice(oldIndex, 1); 
            const finalIndex = dropIndex > oldIndex ? dropIndex - 1 : dropIndex; 
            newList.splice(finalIndex, 0, movedItem); 
            setStickyNotes(newList); 
            const updates = newList.map((n, i) => ({ id: n.id, position: i })); 
            for (const u of updates) await supabase.from('tasks').update({ position: u.position }).eq('id', u.id); 
        } 
    } 
    setDraggedNote(null); 
    setDropIndex(null); 
  };

  const tasksForToday = useMemo(() => { 
      const dayStr = currentDate.toISOString().split('T')[0]; 
      return myTasks.filter(t => t.due_date === dayStr); 
  }, [myTasks, currentDate]);

  const tasksByHour = useMemo(() => { 
      const groups: Record<string, any[]> = {}; 
      tasksForToday.forEach(task => { 
          if (task.due_time) { 
              const hour = parseInt(task.due_time.split(':')[0]); 
              if (!groups[hour]) groups[hour] = []; 
              groups[hour].push(task); 
          } else { 
              if (!groups['none']) groups['none'] = []; 
              groups['none'].push(task); 
          } 
      }); 
      return groups; 
  }, [tasksForToday]);

  const isCurrentHour = (h: number) => currentDate.toDateString() === now.toDateString() && now.getHours() === h;
  const getCurrentLinePosition = () => `${(now.getMinutes() / 60) * 100}%`;
  
  const getDaysInMonth = (date: Date) => { 
      const year = date.getFullYear(); 
      const month = date.getMonth(); 
      const days = new Date(year, month + 1, 0).getDate(); 
      const first = new Date(year, month, 1).getDay(); 
      const arr = []; 
      for(let i=0; i<first; i++) arr.push(null); 
      for(let i=1; i<=days; i++) arr.push(new Date(year, month, i)); 
      return arr; 
  };

  const changeDate = (n: number) => { 
      const d = new Date(currentDate); 
      if(viewMode==='month') d.setMonth(d.getMonth()+n); 
      else d.setDate(d.getDate()+n); 
      setCurrentDate(d); 
  };
  
  const visibleNotes = stickyNotes.filter(n => notesFilter === 'active' ? n.status !== 'done' : n.status === 'done');
  
  const getStylesForNote = (note: any) => { 
      const colorId = note.metadata?.color || (note.type === 'general' ? 'white' : 'yellow'); 
      return NOTES_COLORS[colorId] || NOTES_COLORS.white; 
  };

  function renderTaskCard(task: any) {
      const colorClass = getStylesForNote(task);
      const checklist = task.metadata?.checklist || [];
      const total = checklist.length;
      const done = checklist.filter((i:any)=>i.done).length;
      const progress = total > 0 ? (done/total)*100 : 0;
      const isCompleting = completingId === task.id;
      const isTaskDeleting = deletingId === task.id;

      return (
          <div 
              key={task.id} 
              onClick={() => setEditingNote(task)}
              className={`
                  flex items-start p-3 rounded-xl border shadow-sm cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md
                  ${colorClass}
                  ${task.status === 'done' ? 'opacity-60 grayscale' : ''}
                  ${isCompleting ? 'victory-pulse' : ''} ${isTaskDeleting ? 'shatter-anim' : ''}
                  relative overflow-hidden
              `}
          >
              <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-black/60 dark:text-gray-200">
                          {task.due_time ? task.due_time.slice(0,5) : '--:--'}
                      </span>
                      <h4 className={`text-sm font-bold ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>{task.title}</h4>
                  </div>
                  {task.description && <p className="text-xs opacity-80 line-clamp-1 mb-1">{task.description}</p>}
                  {total > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden max-w-[100px]">
                              <div className="h-full bg-black/40 dark:bg-white/40" style={{ width: `${progress}%` }}></div>
                          </div>
                          <span className="text-[9px] font-bold opacity-50">{done}/{total}</span>
                      </div>
                  )}
              </div>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleToggleStatus(task.id, task.status, false, false)} className={`p-1.5 rounded-lg hover:bg-black/10 transition-colors ${task.status === 'done' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-gray-400'}`}>
                      {task.status === 'done' ? <Undo2 className="w-4 h-4"/> : <Check className="w-4 h-4" />}
                  </button>
                  <button onClick={() => requestDelete(task.id)} className="p-1.5 text-slate-300 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4"/>
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-[#0b141a] overflow-hidden transition-colors duration-300">
      
      {/* CSS ANIMAÇÕES */}
      <style jsx global>{`
        @keyframes shatter { 0% { transform: scale(1) rotate(0deg); opacity: 1; } 100% { transform: scale(0) rotate(10deg); opacity: 0; } }
        @keyframes victory-card { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(0) translateY(-50px); opacity: 0; } }
        @keyframes check-pop { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }
        @keyframes victory-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); background-color: #ecfdf5; border-color: #34d399; } 100% { transform: scale(1); } }
        .shatter-anim { animation: shatter 0.5s ease-in-out forwards; pointer-events: none; }
        .victory-anim { animation: victory-card 0.75s ease-in-out forwards; pointer-events: none; z-index: 50; }
        .check-pop-anim { animation: check-pop 0.4s ease-out forwards; }
        .victory-pulse { animation: victory-pulse 0.4s ease-in-out forwards; }
      `}</style>

      {isDragging && draggedNote && (
        <div className="fixed pointer-events-none z-[100] w-72 p-4 rounded-xl border shadow-2xl scale-105 rotate-3 transition-none" style={{ left: dragPosition.x, top: dragPosition.y, transform: 'translate(-50%, -50%) rotate(3deg)', ...getStylesForNote(draggedNote) }}>
            <h4 className="font-bold text-sm mb-1">{draggedNote.title}</h4>
        </div>
      )}

      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-[#1e2028] border-b border-slate-100 dark:border-gray-800 shadow-sm z-20 transition-colors">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 rounded-lg"><CheckSquare className="w-5 h-5" /></div>
            <div>
                <h1 className="text-base font-bold text-slate-800 dark:text-gray-100 leading-none">Mesa da Secretária</h1>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Organize seu dia e as ordens da clínica</p>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col sm:flex-row gap-4 sm:gap-6 p-3 sm:p-6 overflow-hidden">
        
        {/* COLUNA 1: AGENDA (TIMELINE GRADE) */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#1e2028] rounded-xl sm:rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden relative transition-colors">
            <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
                    <button onClick={() => changeDate(-1)} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-500 dark:text-gray-400 transition-colors"><ChevronLeft className="w-4 h-4"/></button>
                    <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-gray-100 capitalize min-w-[120px] sm:min-w-[140px] text-center">{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => changeDate(1)} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-500 dark:text-gray-400 transition-colors"><ChevronRight className="w-4 h-4"/></button>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                    <div className="flex bg-slate-100 dark:bg-[#2a2d36] p-1 rounded-lg">
                        <button onClick={() => setViewMode('day')} className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-white dark:bg-gray-600 shadow text-black dark:text-white' : 'text-slate-400 dark:text-gray-500'}`}>Dia</button>
                        <button onClick={() => setViewMode('month')} className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-white dark:bg-gray-600 shadow text-black dark:text-white' : 'text-slate-400 dark:text-gray-500'}`}>Mês</button>
                    </div>
                    <button onClick={() => { setModalType('general'); setModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold shadow-md flex items-center gap-1 transition-colors"><Plus className="w-3 h-3"/> <span className="hidden sm:inline">Tarefa</span></button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-[#111b21] relative transition-colors">
                {viewMode === 'month' && (
                    <div className="p-3 sm:p-4 h-full flex flex-col">
                        {/* Cabeçalho dos dias da semana */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                                <div 
                                    key={`day-header-${index}`} 
                                    className="text-center text-[10px] sm:text-xs font-bold text-slate-500 dark:text-gray-400 py-2 px-1"
                                >
                                    {day}
                                </div>
                            ))}
                        </div>
                        
                        {/* Grid do calendário */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1 auto-rows-fr">
                            {getDaysInMonth(currentDate).map((d, i) => {
                                if (!d) {
                                    return (
                                        <div 
                                            key={`empty-${i}`} 
                                            className="aspect-square border border-transparent rounded-lg"
                                        />
                                    );
                                }
                                
                                const isToday = d.toDateString() === new Date().toDateString();
                                const dayTasks = myTasks.filter(t => t.due_date === d.toISOString().split('T')[0]);
                                const taskCount = dayTasks.length;
                                
                                return (
                                    <div 
                                        key={`day-${d.getTime()}`} 
                                        onClick={() => { setCurrentDate(d); setViewMode('day'); }} 
                                        className={`
                                            aspect-square min-h-[60px] sm:min-h-[80px] 
                                            p-1.5 sm:p-2 border rounded-lg 
                                            flex flex-col gap-1 cursor-pointer 
                                            transition-all hover:scale-[1.02] hover:shadow-md
                                            ${isToday 
                                                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-600 shadow-sm' 
                                                : 'border-slate-200 dark:border-gray-700 dark:bg-[#2a2d36] hover:border-indigo-300 dark:hover:border-indigo-600 bg-white'
                                            }
                                        `}
                                    >
                                        {/* Número do dia */}
                                        <div className="flex items-center justify-between">
                                            <span className={`
                                                text-xs sm:text-sm font-bold leading-none
                                                ${isToday 
                                                    ? 'text-indigo-600 dark:text-indigo-300' 
                                                    : 'text-slate-700 dark:text-gray-300'
                                                }
                                            `}>
                                                {d.getDate()}
                                            </span>
                                            {taskCount > 0 && (
                                                <span className={`
                                                    text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                                    ${isToday 
                                                        ? 'bg-indigo-600 text-white dark:bg-indigo-500' 
                                                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                                                    }
                                                `}>
                                                    {taskCount}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Indicadores de tarefas */}
                                        {taskCount > 0 && (
                                            <div className="flex gap-0.5 flex-wrap mt-auto">
                                                {dayTasks.slice(0, 3).map(t => (
                                                    <div 
                                                        key={t.id} 
                                                        className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-400 dark:bg-indigo-500" 
                                                        title={t.title}
                                                    />
                                                ))}
                                                {taskCount > 3 && (
                                                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-300 dark:bg-indigo-700 opacity-50" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {viewMode === 'day' && (
                    <div className="pb-10 min-h-full">
                        {tasksByHour['none'] && tasksByHour['none'].length > 0 && (
                            <div className="p-4 border-b border-slate-100 dark:border-gray-700 bg-white/50 dark:bg-[#202c33]/50 mb-2">
                                <h4 className="text-[10px] font-bold uppercase text-slate-400 dark:text-gray-500 mb-2">Sem Horário Definido</h4>
                                <div className="space-y-2">
                                    {tasksByHour['none'].map(task => renderTaskCard(task))}
                                </div>
                            </div>
                        )}
                        {HOURS.map(hour => {
                            const tasksInThisHour = tasksByHour[hour] || [];
                            const isNow = isCurrentHour(hour);
                            return (
                                <div key={hour} className="flex min-h-[100px] border-b border-slate-100 dark:border-gray-800 relative group">
                                    {isNow && (
                                        <div className="absolute left-0 right-0 border-t-2 border-red-500 z-10 pointer-events-none flex items-center" style={{ top: getCurrentLinePosition() }}>
                                            <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5"></div>
                                        </div>
                                    )}
                                    <div className="w-16 border-r border-slate-100 dark:border-gray-800 py-2 text-right pr-3 text-xs font-bold text-slate-400 dark:text-gray-500 bg-white/50 dark:bg-[#1e2028]">
                                        {hour}:00
                                    </div>
                                    <div className="flex-1 p-2 bg-white/20 dark:bg-[#111b21] hover:bg-white/60 dark:hover:bg-[#202c33] transition-colors relative">
                                        <div className="space-y-2 relative z-0">
                                            {tasksInThisHour.map(task => renderTaskCard(task))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>

        {/* COLUNA 2: MURAL (Drag & Drop) */}
        <div className="w-full sm:w-80 bg-slate-50 dark:bg-[#1e2028] rounded-xl sm:rounded-2xl border border-slate-200 dark:border-gray-700 flex flex-col overflow-hidden transition-colors">
            <div className="p-4 border-b border-slate-200 dark:border-gray-700 bg-white/50 dark:bg-[#202c33] flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2"><StickyNote className="w-4 h-4" /> Mural</h3>
                    <div className="flex bg-slate-200 dark:bg-[#111b21] p-0.5 rounded-lg">
                        <button onClick={() => setNotesFilter('active')} className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${notesFilter === 'active' ? 'bg-white dark:bg-gray-600 shadow text-black dark:text-white' : 'text-slate-500 dark:text-gray-500'}`}>Ativos</button>
                        <button onClick={() => setNotesFilter('done')} className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${notesFilter === 'done' ? 'bg-white dark:bg-gray-600 shadow text-black dark:text-white' : 'text-slate-500 dark:text-gray-500'}`}>Feitos</button>
                    </div>
                </div>
                <button onClick={() => { setModalType('sticky_note'); setModalOpen(true); }} className="w-full bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-600 hover:border-rose-300 dark:hover:border-rose-500/50 text-rose-500 px-3 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all"><Plus className="w-3 h-3"/> Criar Nota Rápida</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar relative" ref={listRef}>
                {visibleNotes.map((note, index) => {
                    const colorClass = getStylesForNote(note);
                    const checklist = note.metadata?.checklist || [];
                    const total = checklist.length;
                    const done = checklist.filter((i:any)=>i.done).length;
                    const progress = total > 0 ? (done/total)*100 : 0;
                    const isDraggingNote = isDragging && draggedNote?.id === note.id;
                    const isCompleting = completingId === note.id;
                    const isNoteDeleting = deletingId === note.id;

                    return (
                        <div key={note.id} className={`${isCompleting ? 'victory-anim' : ''} ${isNoteDeleting ? 'shatter-anim' : ''}`}>
                            {isDragging && dropIndex === index && <div className="h-1 bg-indigo-500 rounded-full my-2 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>}
                            <div 
                                ref={(el) => { itemRefs.current[index] = el }}
                                onMouseDown={(e) => notesFilter === 'active' && handleMouseDown(e, note, index)}
                                onClick={() => setEditingNote(note)}
                                className={`p-4 rounded-xl border shadow-sm relative group cursor-grab active:cursor-grabbing transition-all ${colorClass} ${note.status === 'done' ? 'opacity-60 grayscale' : ''} ${isDraggingNote ? 'opacity-0 h-0 p-0 m-0 overflow-hidden border-0' : 'opacity-100'} ${isCompleting ? 'z-50' : ''}`}
                            >
                                {isCompleting && <div className="absolute inset-0 bg-emerald-500 rounded-xl z-20 flex items-center justify-center shadow-lg"><CheckCircle2 className="w-14 h-14 text-white check-pop-anim" /></div>}
                                <div className="flex justify-between items-start mb-2"><GripHorizontal className="w-4 h-4 opacity-20 cursor-grab" /><div className="flex gap-1 relative z-10">{notesFilter === 'active' ? <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(note.id, 'pending', true, true); }} className="p-1 rounded hover:bg-black/10 text-black/40 dark:text-white/40"><Check className="w-3 h-3"/></button> : <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(note.id, 'done', true, true); }} className="p-1 rounded hover:bg-black/10 text-black/40 dark:text-white/40"><Undo2 className="w-3 h-3"/></button>}<button onClick={(e) => { e.stopPropagation(); requestDelete(note.id); }} className="p-1 rounded hover:bg-black/10 text-black/40 dark:text-white/40"><Trash2 className="w-3 h-3"/></button></div></div>
                                <h4 className="font-bold text-sm mb-1">{note.title}</h4>
                                <p className="text-xs opacity-90 leading-relaxed whitespace-pre-wrap mb-3">{note.description}</p>
                                {total > 0 && <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5"><div className="flex items-center gap-2 mb-2"><div className="flex-1 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-black/40 dark:bg-white/40 transition-all duration-500" style={{ width: `${progress}%` }}></div></div><span className="text-[9px] font-bold opacity-60">{Math.round(progress)}%</span></div><div className="space-y-1">{checklist.slice(0, 3).map((item:any, i:number) => (<button key={i} onClick={(e) => { e.stopPropagation(); toggleChecklistItem(note.id, i, true); }} className="flex items-start gap-2 text-left w-full group/item"><div className={`mt-0.5 w-3 h-3 rounded border border-black/30 dark:border-white/30 flex items-center justify-center ${item.done ? 'bg-black/40 dark:bg-white/40 border-transparent' : ''}`}>{item.done && <Check className="w-2 h-2 text-white" />}</div><span className={`text-[10px] leading-tight ${item.done ? 'line-through opacity-50' : 'opacity-90'}`}>{item.text}</span></button>))}{total > 3 && <span className="text-[9px] opacity-50 italic">+{total - 3} itens...</span>}</div></div>}
                            </div>
                        </div>
                    );
                })}
                {isDragging && dropIndex === visibleNotes.length && <div className="h-1 bg-indigo-500 rounded-full my-2 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>}
            </div>
        </div>

      </div>

      {/* --- MODAIS --- */}
      <CreateTaskModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSuccess={fetchTasks} initialDate={currentDate} initialType={modalType} />
      <EditNoteModal isOpen={!!editingNote} note={editingNote} onClose={() => setEditingNote(null)} onUpdate={fetchTasks} />
      
      {/* Notificações */}
      <NotificationToast 
        notifications={notifications} 
        onDismiss={dismissNotification} 
      />
      
      <ConfirmModal 
        isOpen={!!itemToDelete} 
        onClose={() => {
          if (!isDeleting) {
            setItemToDelete(null);
          }
        }} 
        onConfirm={handleConfirmDelete} 
        title="Excluir Item?" 
        message="Essa ação é permanente e não pode ser desfeita."
        type="danger"
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        isLoading={isDeleting}
      />
    </div>
  );
}