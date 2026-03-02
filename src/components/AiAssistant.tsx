import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Send, Trash2, Mic, MicOff, Volume2, VolumeX, Loader2, Check, Building2, FolderKanban, ListTodo, Calendar, Target, BarChart3, ChevronRight, Radio } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';

type Msg = { role: 'user' | 'assistant'; content: string };
type GlobalAction = { type: string; data: any; applied?: boolean };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

const QUICK_PROMPTS = [
  { icon: '📋', label: 'Briefing di oggi', prompt: 'Dammi il briefing completo di oggi: task, appuntamenti e scadenze.' },
  { icon: '🚨', label: 'Alert & urgenze', prompt: 'Quali sono le task più urgenti e le scadenze critiche questa settimana?' },
  { icon: '🎯', label: 'Flight plan OKR', prompt: 'Dammi lo status report dei miei OKR e Focus attivi.' },
  { icon: '➕', label: 'Nuovo ordine', prompt: 'Aiutami a creare una nuova task.' },
];

export function AiAssistant() {
  const { session } = useAuth();
  const {
    enterprises, projects, tasks, appointments, focusPeriods, objectives, keyResults,
    addEnterprise, addProject, addTask, addFocusPeriod, addObjective, addKeyResult,
    addAppointment, scheduleTask, completeTask,
  } = usePrp();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pendingActions, setPendingActions] = useState<GlobalAction[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingActions]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
    };
  }, []);

  const stripMarkdown = (t: string) => t.replace(/[*_~`#>[\]()!|]/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim();

  const speakText = useCallback(async (text: string) => {
    if (!voiceEnabled || !text) return;
    const clean = stripMarkdown(text);
    if (clean.length < 3) return;
    try {
      setIsSpeaking(true);
      const res = await fetch(TTS_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      await audio.play();
    } catch { setIsSpeaking(false); }
  }, [voiceEnabled, session]);

  const stopSpeaking = useCallback(() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; setIsSpeaking(false); } }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Browser non supporta il riconoscimento vocale'); return; }
    const r = new SR(); r.lang = 'it-IT'; r.continuous = false; r.interimResults = true;
    r.onresult = (e: any) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setInput(t); };
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    recognitionRef.current = r; r.start(); setIsListening(true);
    if (!voiceEnabled) setVoiceEnabled(true);
  }, [voiceEnabled]);

  const stopListening = useCallback(() => { if (recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); } }, []);

  const buildContext = () => {
    const now = new Date(); const today = now.toISOString().split('T')[0];
    const currentQ = Math.ceil((now.getMonth() + 1) / 3);
    const path = location.pathname;
    let currentSection = 'dashboard'; let currentEnterpriseId: string | null = null;
    if (path.startsWith('/enterprise/')) { currentSection = 'enterprise_detail'; currentEnterpriseId = path.split('/enterprise/')[1]; }
    else if (path === '/enterprises') currentSection = 'enterprises';
    else if (path === '/calendar') currentSection = 'calendar';
    return {
      currentSection, currentEnterpriseId, currentDate: today, currentQuarter: `Q${currentQ} ${now.getFullYear()}`,
      enterprises: enterprises.map(e => ({ id: e.id, name: e.name, status: e.status, phase: e.phase, businessCategory: e.businessCategory, color: e.color })),
      projects: projects.map(p => ({ id: p.id, name: p.name, type: p.type, enterpriseId: p.enterpriseId, isStrategicLever: p.isStrategicLever, keyResultId: p.keyResultId })),
      tasks: tasks.filter(t => t.status !== 'done').map(t => ({ id: t.id, title: t.title, priority: t.priority, status: t.status, estimatedMinutes: t.estimatedMinutes, deadline: t.deadline, scheduledDate: t.scheduledDate, scheduledTime: t.scheduledTime, projectId: t.projectId, enterpriseId: t.enterpriseId })),
      todayTasks: tasks.filter(t => t.scheduledDate === today && t.status !== 'done').map(t => ({ id: t.id, title: t.title, priority: t.priority, scheduledTime: t.scheduledTime })),
      upcomingDeadlines: tasks.filter(t => t.deadline && t.status !== 'done' && t.deadline <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]).map(t => ({ id: t.id, title: t.title, deadline: t.deadline, priority: t.priority })),
      focusPeriods: focusPeriods.map(f => ({ id: f.id, name: f.name, status: f.status, startDate: f.startDate, endDate: f.endDate, enterpriseId: f.enterpriseId })),
      objectives: objectives.map(o => ({ id: o.id, title: o.title, status: o.status, focusPeriodId: o.focusPeriodId, enterpriseId: o.enterpriseId })),
      keyResults: keyResults.map(kr => ({ id: kr.id, title: kr.title, targetValue: kr.targetValue, currentValue: kr.currentValue, metricType: kr.metricType, objectiveId: kr.objectiveId, enterpriseId: kr.enterpriseId })),
      appointmentsToday: appointments.filter(a => a.date === today).map(a => ({ title: a.title, startTime: a.startTime, endTime: a.endTime })),
      backlogCount: tasks.filter(t => t.status === 'backlog').length,
      doneTodayCount: tasks.filter(t => t.status === 'done' && t.completedAt?.startsWith(today)).length,
    };
  };

  const applyAction = async (action: GlobalAction) => {
    try {
      switch (action.type) {
        case 'create_enterprise': addEnterprise({ name: action.data.name, status: action.data.status || 'active', color: '#6366f1', strategicImportance: 3, growthPotential: 3, phase: action.data.phase || 'setup', businessCategory: action.data.business_category || 'scale_opportunity', timeHorizon: 'medium', priorityUntil: null }); toast.success(`Impresa "${action.data.name}" creata`); break;
        case 'create_project': addProject({ name: action.data.name, enterpriseId: action.data.enterprise_id, type: action.data.type || 'operational', isStrategicLever: action.data.type === 'strategic', keyResultId: null }); toast.success(`Progetto "${action.data.name}" creato`); break;
        case 'create_task': addTask({ title: action.data.title, projectId: action.data.project_id, enterpriseId: action.data.enterprise_id, priority: action.data.priority || 'medium', estimatedMinutes: action.data.estimated_minutes || 30, deadline: action.data.deadline || null, scheduledDate: null, scheduledTime: null, isRecurring: false, recurringFrequency: null, impact: null, effort: null, completedAt: null }); toast.success(`Task "${action.data.title}" creata`); break;
        case 'create_focus_period': addFocusPeriod({ enterpriseId: action.data.enterprise_id, name: action.data.name, startDate: action.data.start_date, endDate: action.data.end_date, status: action.data.status || 'active' }); toast.success(`Focus "${action.data.name}" creato`); break;
        case 'create_objective': addObjective({ focusPeriodId: action.data.focus_period_id, enterpriseId: action.data.enterprise_id, title: action.data.title, description: action.data.description || '', weight: 1, status: 'active' }); toast.success(`Objective "${action.data.title}" creato`); break;
        case 'create_key_result': addKeyResult({ objectiveId: action.data.objective_id, enterpriseId: action.data.enterprise_id, title: action.data.title, targetValue: action.data.target_value, currentValue: 0, metricType: action.data.metric_type || 'number', deadline: action.data.deadline || null, status: 'active' }); toast.success(`KR "${action.data.title}" creato`); break;
        case 'schedule_task': scheduleTask(action.data.task_id, action.data.date, action.data.time); toast.success('Task pianificata'); break;
        case 'complete_task': completeTask(action.data.task_id); toast.success('Task completata'); break;
        case 'create_appointment': addAppointment({ title: action.data.title, date: action.data.date, startTime: action.data.start_time, endTime: action.data.end_time, description: action.data.description || null, color: null, enterpriseId: action.data.enterprise_id || null }); toast.success(`Appuntamento "${action.data.title}" creato`); break;
      }
      action.applied = true; setPendingActions(prev => [...prev]);
    } catch (e) { console.error(e); toast.error("Errore nell'azione"); }
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages); setInput(''); setIsLoading(true);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    let assistantContent = '';
    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ type: 'global_assistant', messages: newMessages, context: buildContext() }),
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || `Errore ${resp.status}`); }
      if (!resp.body) throw new Error('No body');
      const reader = resp.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { streamDone = true; break; }
          try {
            const p = JSON.parse(json);
            if (p.type === 'delta' && p.content) { assistantContent += p.content; const snap = assistantContent; setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === 'assistant' ? { ...m, content: snap } : m)); }
            if (p.type === 'actions' && p.actions?.length) { const acts: GlobalAction[] = p.actions.map((a: any) => ({ ...a, applied: false })); setPendingActions(prev => [...prev, ...acts]); for (const a of acts) await applyAction(a); }
          } catch { buffer = line + '\n' + buffer; break; }
        }
      }
      if (!assistantContent) { setMessages(prev => { const last = prev[prev.length - 1]; return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev; }); }
      else { speakText(assistantContent); }
    } catch (e: any) {
      console.error(e); toast.error(e?.message || 'Errore AI');
      setMessages(prev => { const last = prev[prev.length - 1]; return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev; });
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'; };

  const getActionIcon = (type: string) => {
    const map: Record<string, React.ReactNode> = {
      create_enterprise: <Building2 className="h-3 w-3" />, create_project: <FolderKanban className="h-3 w-3" />,
      create_task: <ListTodo className="h-3 w-3" />, create_focus_period: <Calendar className="h-3 w-3" />,
      create_objective: <Target className="h-3 w-3" />, create_key_result: <BarChart3 className="h-3 w-3" />,
      schedule_task: <Calendar className="h-3 w-3" />, complete_task: <Check className="h-3 w-3" />,
      create_appointment: <Calendar className="h-3 w-3" />,
    };
    return map[type] || <Radio className="h-3 w-3" />;
  };

  const getActionLabel = (a: GlobalAction) => a.data?.name || a.data?.title || a.type.replace(/_/g, ' ');

  const tasksDueToday = tasks.filter(t => t.scheduledDate === new Date().toISOString().split('T')[0] && t.status !== 'done').length;
  const activeEnterprises = enterprises.filter(e => e.status === 'active').length;
  const backlogCount = tasks.filter(t => t.status === 'backlog').length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="fixed bottom-5 right-5 z-50 group" aria-label="Apri Copilot">
          {/* Glow */}
          <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-300" />
          {/* Button */}
          <div className="relative h-13 px-4 rounded-2xl bg-primary text-primary-foreground flex items-center gap-2.5 shadow-xl hover:shadow-2xl hover:scale-[1.03] active:scale-[0.97] transition-all duration-200">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 4.3 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
            <span className="text-sm font-semibold tracking-tight hidden sm:inline" style={{ fontFamily: "'JetBrains Mono', monospace" }}>COPILOT</span>
          </div>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[440px] p-0 flex flex-col bg-background border-l border-border/40">
        {/* Header — Cockpit style */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-primary/[0.03] pointer-events-none" />
          <div className="relative px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 4.3 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>COPILOT</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
                    <span className="text-[10px] text-muted-foreground font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>SYS READY · ALL ACCESS</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { if (voiceEnabled) { stopSpeaking(); setVoiceEnabled(false); } else setVoiceEnabled(true); }}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 border ${
                  voiceEnabled ? 'bg-primary/10 text-primary border-primary/20' : 'hover:bg-muted text-muted-foreground border-transparent'
                }`}
                title={voiceEnabled ? 'Disattiva voce' : 'Attiva voce'}
              >
                {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
            </div>

            {/* Instrument strip */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
              {[
                { value: tasksDueToday, label: 'TODAY', alert: tasksDueToday > 0 },
                { value: backlogCount, label: 'QUEUE', alert: false },
                { value: activeEnterprises, label: 'ACTIVE', alert: false },
                { value: focusPeriods.filter(f => f.status === 'active').length, label: 'FOCUS', alert: false },
              ].map(gauge => (
                <div key={gauge.label} className="flex-1 text-center">
                  <div className={`text-base font-bold tabular-nums leading-none ${gauge.alert ? 'text-primary' : 'text-foreground'}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {gauge.value}
                  </div>
                  <div className="text-[8px] text-muted-foreground font-medium tracking-widest mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {gauge.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 border-t border-border/30">
          {messages.length === 0 && (
            <div className="pt-2 space-y-4">
              <p className="text-xs text-muted-foreground px-1">Comandi rapidi:</p>
              <div className="space-y-1.5">
                {QUICK_PROMPTS.map(q => (
                  <button
                    key={q.label}
                    onClick={() => handleSend(q.prompt)}
                    className="w-full flex items-center gap-3 rounded-lg border border-border/50 bg-card/80 hover:bg-muted/60 hover:border-primary/20 transition-all duration-150 px-3 py-2.5 group text-left"
                  >
                    <span className="text-base">{q.icon}</span>
                    <span className="text-[13px] text-foreground font-medium flex-1">{q.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 4.3 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
                </div>
              )}
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-lg'
                  : 'bg-muted/50 text-foreground rounded-bl-lg border border-border/40'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[13px] leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Applied actions */}
          {pendingActions.filter(a => a.applied).map((action, i) => (
            <div key={`a-${i}`} className="flex justify-center py-0.5">
              <div className="flex items-center gap-2 rounded-md bg-primary/[0.05] border border-primary/10 px-3 py-1.5">
                <div className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center">{getActionIcon(action.type)}</div>
                <span className="text-[11px] text-muted-foreground truncate max-w-[200px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{getActionLabel(action)}</span>
                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 mr-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 4.3 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
              </div>
              <div className="bg-muted/50 rounded-2xl rounded-bl-lg px-3.5 py-2.5 border border-border/40">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-[12px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>PROCESSING...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input — Control panel */}
        <div className="border-t border-border/40 p-3 shrink-0 bg-muted/10">
          {(isSpeaking || isListening) && (
            <div className="flex items-center gap-2.5 mb-2.5 px-1">
              {isSpeaking ? (
                <>
                  <div className="flex items-center gap-[3px]">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className="w-[3px] rounded-full bg-primary animate-pulse" style={{ height: `${6 + Math.random() * 10}px`, animationDelay: `${i * 80}ms` }} />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>VOICE OUT</span>
                  <button onClick={stopSpeaking} className="text-[10px] text-primary hover:underline ml-auto font-medium">CUT</button>
                </>
              ) : (
                <>
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse shadow-[0_0_6px_hsl(var(--destructive)/0.5)]" />
                  <span className="text-[10px] text-muted-foreground font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>REC · LISTENING</span>
                  <button onClick={stopListening} className="text-[10px] text-primary hover:underline ml-auto font-medium">STOP</button>
                </>
              )}
            </div>
          )}

          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setPendingActions([]); }} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-2 px-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <Trash2 className="h-3 w-3" /> NEW SESSION
            </button>
          )}

          <div className="flex items-end gap-1.5 bg-card rounded-xl border border-input px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all duration-200">
            <textarea
              ref={inputRef} value={input} onChange={handleTextareaInput} onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Parla ora...' : 'Istruzioni al copilot...'}
              className="flex-1 bg-transparent text-sm resize-none border-0 outline-none placeholder:text-muted-foreground/40 min-h-[32px] max-h-[80px] py-1"
              rows={1} disabled={isLoading}
            />
            <button
              onClick={isListening ? stopListening : startListening} disabled={isLoading}
              className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                isListening ? 'bg-destructive text-destructive-foreground shadow-[0_0_8px_hsl(var(--destructive)/0.4)]' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <Button size="icon" onClick={() => handleSend()} disabled={!input.trim() || isLoading} className="shrink-0 h-8 w-8 rounded-lg">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
