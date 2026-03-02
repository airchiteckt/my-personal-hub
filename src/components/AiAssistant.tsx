import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Send, Trash2, Mic, Volume2, VolumeX, Loader2, Check, Building2, FolderKanban, ListTodo, Calendar, Target, BarChart3, ChevronRight, Radio, ArrowLeft, Maximize2, Phone, PhoneOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

type Msg = { role: 'user' | 'assistant'; content: string };
type GlobalAction = { type: string; data: any; applied?: boolean };
type RadarView = 'home' | 'chat' | 'voice';
type CallState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

const QUICK_PROMPTS = [
  { icon: '📋', label: 'Briefing di oggi', prompt: 'Dammi il briefing completo di oggi: task, appuntamenti e scadenze.' },
  { icon: '🚨', label: 'Alert & urgenze', prompt: 'Quali sono le task più urgenti e le scadenze critiche questa settimana?' },
  { icon: '🎯', label: 'OKR status', prompt: 'Dammi lo status report dei miei OKR e Focus attivi.' },
  { icon: '➕', label: 'Nuova task', prompt: 'Aiutami a creare una nuova task.' },
];

// Radar SVG icon
const RadarIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <line x1="12" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="12" x2="19" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
  </svg>
);

// Shared hook for all Radar logic
function useRadar() {
  const { session } = useAuth();
  const {
    enterprises, projects, tasks, appointments, focusPeriods, objectives, keyResults,
    addEnterprise, addProject, addTask, addFocusPeriod, addObjective, addKeyResult,
    addAppointment, scheduleTask, completeTask,
  } = usePrp();
  const location = useLocation();

  const [view, setView] = useState<RadarView>('home');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pendingActions, setPendingActions] = useState<GlobalAction[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Call state
  const [callState, setCallState] = useState<CallState>('idle');
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<ReturnType<typeof setInterval>>();
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recognitionRef = useRef<any>(null);
  const callActiveRef = useRef(false); // ref to track call state in callbacks
  const pendingSendRef = useRef<string | null>(null); // for auto-sending recognized text

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingActions]);

  useEffect(() => { if (view === 'chat') setTimeout(() => inputRef.current?.focus(), 100); }, [view]);
  useEffect(() => {
    return () => {
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch {}
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, []);

  // Keep ref in sync
  useEffect(() => { callActiveRef.current = callActive; }, [callActive]);

  const stripMarkdown = (t: string) => t.replace(/[*_~`#>[\]()!|]/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim();

  // Start continuous listening (for call mode)
  const startContinuousListening = useCallback(() => {
    if (!callActiveRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Browser non supporta il riconoscimento vocale'); return; }
    
    try { if (recognitionRef.current) recognitionRef.current.abort(); } catch {}
    
    const r = new SR();
    r.lang = 'it-IT';
    r.continuous = true;
    r.interimResults = true;
    
    let finalTranscript = '';
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    
    r.onresult = (e: any) => {
      let interim = '';
      finalTranscript = '';
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInput(finalTranscript + interim);
      
      // When we get a final result, auto-send after a brief pause
      if (finalTranscript.trim()) {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          if (callActiveRef.current && finalTranscript.trim()) {
            pendingSendRef.current = finalTranscript.trim();
            try { r.stop(); } catch {}
          }
        }, 1200); // 1.2s of silence after final result → send
      }
    };
    
    r.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      // If there's pending text to send
      if (pendingSendRef.current) {
        const text = pendingSendRef.current;
        pendingSendRef.current = null;
        setCallState('processing');
        // Trigger send (we'll handle this via an effect)
        handleSendVoice(text);
        return;
      }
      // If call is still active and not processing, restart listening
      if (callActiveRef.current) {
        setTimeout(() => {
          if (callActiveRef.current) startContinuousListening();
        }, 300);
      }
    };
    
    r.onerror = (e: any) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (e.error === 'no-speech' || e.error === 'aborted') {
        // Restart if call still active
        if (callActiveRef.current) {
          setTimeout(() => {
            if (callActiveRef.current) startContinuousListening();
          }, 500);
        }
        return;
      }
      console.error('Speech recognition error:', e.error);
    };
    
    recognitionRef.current = r;
    try {
      r.start();
      setCallState('listening');
    } catch (e) {
      console.error('Failed to start recognition:', e);
      // Retry
      setTimeout(() => {
        if (callActiveRef.current) startContinuousListening();
      }, 1000);
    }
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (!text) return;
    const clean = stripMarkdown(text);
    if (clean.length < 3) return;
    try {
      setCallState(prev => prev !== 'idle' ? 'speaking' : prev);
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
      audio.onended = () => {
        URL.revokeObjectURL(url);
        // After speaking, restart listening if call is active
        if (callActiveRef.current) {
          setInput('');
          setTimeout(() => startContinuousListening(), 400);
        } else {
          setCallState('idle');
        }
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (callActiveRef.current) {
          setInput('');
          setTimeout(() => startContinuousListening(), 400);
        } else {
          setCallState('idle');
        }
      };
      await audio.play();
    } catch {
      if (callActiveRef.current) {
        setInput('');
        setTimeout(() => startContinuousListening(), 400);
      } else {
        setCallState('idle');
      }
    }
  }, [session, startContinuousListening]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (callActiveRef.current) {
      setInput('');
      setTimeout(() => startContinuousListening(), 300);
    } else {
      setCallState('idle');
    }
  }, [startContinuousListening]);

  const buildContext = () => {
    const now = new Date(); const today = now.toISOString().split('T')[0];
    const currentQ = Math.ceil((now.getMonth() + 1) / 3);
    const path = location.pathname;
    let currentSection = 'dashboard'; let currentEnterpriseId: string | null = null;
    if (path.startsWith('/enterprise/')) { currentSection = 'enterprise_detail'; currentEnterpriseId = path.split('/enterprise/')[1]; }
    else if (path === '/enterprises') currentSection = 'enterprises';
    else if (path === '/calendar') currentSection = 'calendar';
    else if (path === '/radar') currentSection = 'radar';
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
        case 'create_enterprise': addEnterprise({ name: action.data.name, status: action.data.status || 'active', color: '#6366f1', strategicImportance: 3, growthPotential: 3, phase: action.data.phase || 'setup', businessCategory: action.data.business_category || 'scale_opportunity', timeHorizon: 'medium', enterpriseType: 'digital_services', priorityUntil: null }); toast.success(`Impresa "${action.data.name}" creata`); break;
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

  // Core send function (used by both text and voice)
  const doSend = async (text: string, isVoiceCall: boolean) => {
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
      if (!assistantContent) {
        setMessages(prev => { const last = prev[prev.length - 1]; return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev; });
        // If voice call, restart listening even without response
        if (isVoiceCall && callActiveRef.current) {
          setTimeout(() => startContinuousListening(), 500);
        }
      } else if (isVoiceCall || voiceEnabled) {
        // Speak the response — speakText will auto-restart listening after
        speakText(assistantContent);
      }
    } catch (e: any) {
      console.error(e); toast.error(e?.message || 'Errore AI');
      setMessages(prev => { const last = prev[prev.length - 1]; return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev; });
      // If voice call, restart listening despite error
      if (isVoiceCall && callActiveRef.current) {
        setTimeout(() => startContinuousListening(), 1000);
      }
    }
    setIsLoading(false);
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text) return;
    if (view === 'home') setView('chat');
    await doSend(text, false);
  };

  const handleSendVoice = async (text: string) => {
    if (!text) return;
    await doSend(text, true);
  };

  // Start a call
  const startCall = useCallback(async () => {
    setCallState('connecting');
    setCallActive(true);
    callActiveRef.current = true;
    setVoiceEnabled(true);
    setView('voice');
    setCallDuration(0);
    setInput('');
    
    // Start call timer
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    
    // Request mic permission and start listening
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setTimeout(() => startContinuousListening(), 800);
    } catch {
      toast.error('Permesso microfono necessario per la chiamata');
      endCall();
    }
  }, [startContinuousListening]);

  // End a call
  const endCall = useCallback(() => {
    callActiveRef.current = false;
    setCallActive(false);
    setCallState('idle');
    setInput('');
    pendingSendRef.current = null;
    
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = undefined; }
    try { if (recognitionRef.current) recognitionRef.current.abort(); } catch {}
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    
    // Go back
    setView(messages.length > 0 ? 'chat' : 'home');
  }, [messages.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; };

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
  const activeFocus = focusPeriods.filter(f => f.status === 'active').length;

  const goBack = () => {
    if (view === 'voice') endCall();
    else if (view === 'chat') setView('home');
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return {
    view, setView, messages, setMessages, pendingActions, setPendingActions,
    input, setInput, isLoading, scrollRef, inputRef, callState, callActive,
    callDuration, voiceEnabled, setVoiceEnabled, startCall, endCall,
    handleSend, handleKeyDown, handleTextareaInput, getActionIcon, getActionLabel,
    goBack, stopSpeaking, tasksDueToday, activeEnterprises, backlogCount, activeFocus,
    formatDuration,
  };
}

// ─── Voice View (shared) ───
function VoiceCallView({ callState, callActive, callDuration, input, isLoading, startCall, endCall, stopSpeaking, formatDuration }: {
  callState: CallState; callActive: boolean; callDuration: number; input: string; isLoading: boolean;
  startCall: () => void; endCall: () => void; stopSpeaking: () => void; formatDuration: (s: number) => string;
}) {
  const stateLabel: Record<CallState, string> = {
    idle: 'CHIAMA RADAR',
    connecting: 'CONNESSIONE...',
    listening: 'TI ASCOLTO',
    processing: 'ELABORO...',
    speaking: 'RADAR PARLA...',
  };

  return (
    <motion.div
      key="voice"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col items-center justify-center p-6 border-t border-border/30 relative"
    >
      {/* Call timer */}
      <AnimatePresence>
        {callActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 left-0 right-0 text-center"
          >
            <span className="text-xs text-muted-foreground tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {formatDuration(callDuration)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Radar rings animation */}
      <div className="relative mb-6">
        {/* Outer pulsing rings - only when listening */}
        {callActive && (
          <>
            <motion.div
              className="absolute rounded-full border-2 border-primary/10"
              style={{ width: 180, height: 180, left: -50, top: -50 }}
              animate={callState === 'listening' ? { scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] } : callState === 'speaking' ? { scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute rounded-full border-2 border-primary/15"
              style={{ width: 140, height: 140, left: -30, top: -30 }}
              animate={callState === 'listening' ? { scale: [1, 1.2, 1], opacity: [0.5, 0.1, 0.5] } : callState === 'speaking' ? { scale: [1, 1.1, 1], opacity: [0.4, 0.15, 0.4] } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            />
          </>
        )}

        {/* Core button */}
        {!callActive ? (
          <motion.button
            onClick={startCall}
            className="relative h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl hover:shadow-2xl"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
          >
            <Phone className="h-7 w-7" />
          </motion.button>
        ) : (
          <motion.div
            className={`relative h-20 w-20 rounded-full flex items-center justify-center ${
              callState === 'speaking'
                ? 'bg-primary shadow-[0_0_25px_hsl(var(--primary)/0.3)]'
                : callState === 'listening'
                ? 'bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.2)]'
                : 'bg-primary/80'
            } text-primary-foreground`}
            animate={callState === 'listening' ? { scale: [1, 1.04, 1] } : callState === 'speaking' ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            {callState === 'processing' || callState === 'connecting' ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : callState === 'speaking' ? (
              <Volume2 className="h-7 w-7" />
            ) : (
              <Mic className="h-7 w-7" />
            )}
          </motion.div>
        )}
      </div>

      {/* State label */}
      <motion.p
        className="text-sm font-medium text-muted-foreground mb-1"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
        animate={callState === 'listening' ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
        transition={callState === 'listening' ? { duration: 2, repeat: Infinity } : {}}
      >
        {stateLabel[callState]}
      </motion.p>

      {/* Speaking audio bars */}
      <AnimatePresence>
        {callState === 'speaking' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center gap-[3px] mt-3"
          >
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <motion.div
                key={i}
                className="w-[3px] rounded-full bg-primary"
                animate={{ height: [4, 14 + Math.random() * 8, 4] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }}
              />
            ))}
            <button onClick={stopSpeaking} className="ml-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors">Skip</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live transcript */}
      <AnimatePresence>
        {callActive && input && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 w-full max-w-xs"
          >
            <div className="bg-muted/30 rounded-xl px-3 py-2 border border-border/30 text-center">
              <p className="text-sm text-foreground/80 italic">"{input}"</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hang up */}
      {callActive && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={endCall}
          className="mt-8 h-12 w-12 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
        >
          <PhoneOff className="h-5 w-5" />
        </motion.button>
      )}

      {/* Switch to text (only when not in a call) */}
      {!callActive && (
        <p className="mt-5 text-xs text-muted-foreground">Tocca per avviare una conversazione vocale con Radar</p>
      )}
    </motion.div>
  );
}

// ─── Main Sheet Component ───
export function AiAssistant() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const r = useRadar();

  // Reset view on close
  useEffect(() => { if (!open) { if (r.callActive) r.endCall(); setTimeout(() => r.setView('home'), 300); } }, [open]);

  const openFullPage = () => { setOpen(false); navigate('/radar'); };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="fixed bottom-5 right-5 z-50 group" aria-label="Apri Radar">
          <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-300" />
          <div className="relative h-13 px-4 rounded-2xl bg-primary text-primary-foreground flex items-center gap-2.5 shadow-xl hover:shadow-2xl hover:scale-[1.03] active:scale-[0.97] transition-all duration-200">
            <RadarIcon size={18} />
            <span className="text-sm font-semibold tracking-tight hidden sm:inline" style={{ fontFamily: "'JetBrains Mono', monospace" }}>RADAR</span>
          </div>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[440px] p-0 flex flex-col bg-background border-l border-border/40">
        {/* Header */}
        <div className="relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-accent/[0.04] pointer-events-none" />
          <div className="relative px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {r.view !== 'home' && (
                  <button onClick={r.goBack} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
                  <RadarIcon size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>RADAR</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${r.callActive ? 'bg-destructive animate-pulse' : 'bg-emerald-500'} shadow-[0_0_4px_rgba(16,185,129,0.6)]`} />
                    <span className="text-[10px] text-muted-foreground font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {r.callActive ? `IN CHIAMATA · ${r.formatDuration(r.callDuration)}` : r.view === 'chat' ? 'CHAT MODE' : 'ONLINE'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={openFullPage} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Pagina dedicata">
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {r.view === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="flex-1 overflow-y-auto p-4 border-t border-border/30">
              <div className="flex items-center gap-3 mb-5">
                {[
                  { value: r.tasksDueToday, label: 'OGGI', alert: r.tasksDueToday > 0 },
                  { value: r.backlogCount, label: 'BACKLOG', alert: false },
                  { value: r.activeEnterprises, label: 'ATTIVE', alert: false },
                  { value: r.activeFocus, label: 'FOCUS', alert: false },
                ].map(gauge => (
                  <div key={gauge.label} className="flex-1 text-center py-2.5 rounded-lg bg-muted/40 border border-border/30">
                    <div className={`text-lg font-bold tabular-nums leading-none ${gauge.alert ? 'text-primary' : 'text-foreground'}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{gauge.value}</div>
                    <div className="text-[8px] text-muted-foreground font-medium tracking-widest mt-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{gauge.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mb-2 px-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>AZIONI RAPIDE</p>
              <div className="space-y-1.5 mb-5">
                {QUICK_PROMPTS.map(q => (
                  <button key={q.label} onClick={() => r.handleSend(q.prompt)} className="w-full flex items-center gap-3 rounded-lg border border-border/50 bg-card/80 hover:bg-muted/60 hover:border-primary/20 transition-all duration-150 px-3 py-2.5 group text-left">
                    <span className="text-base">{q.icon}</span>
                    <span className="text-[13px] text-foreground font-medium flex-1">{q.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
              <button onClick={r.startCall} className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-primary/[0.06] hover:bg-primary/[0.12] border border-primary/15 hover:border-primary/25 transition-all duration-200 py-3.5 group">
                <Phone className="h-4 w-4 text-primary/70 group-hover:text-primary transition-colors" />
                <span className="text-[13px] font-semibold text-primary/80 group-hover:text-primary transition-colors" style={{ fontFamily: "'JetBrains Mono', monospace" }}>CHIAMA RADAR</span>
              </button>
            </motion.div>
          )}

          {r.view === 'voice' && (
            <VoiceCallView callState={r.callState} callActive={r.callActive} callDuration={r.callDuration} input={r.input} isLoading={r.isLoading} startCall={r.startCall} endCall={r.endCall} stopSpeaking={r.stopSpeaking} formatDuration={r.formatDuration} />
          )}

          {r.view === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
              <div ref={r.scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 border-t border-border/30">
                {r.messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <RadarIcon size={32} className="text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Scrivi un messaggio per iniziare</p>
                  </div>
                )}
                {r.messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5"><RadarIcon size={12} className="text-primary" /></div>}
                    <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-lg' : 'bg-muted/50 text-foreground rounded-bl-lg border border-border/40'}`}>
                      {msg.role === 'assistant' ? <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[13px] leading-relaxed"><ReactMarkdown>{msg.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>}
                    </div>
                  </div>
                ))}
                {r.pendingActions.filter(a => a.applied).map((action, i) => (
                  <div key={`a-${i}`} className="flex justify-center py-0.5">
                    <div className="flex items-center gap-2 rounded-md bg-primary/[0.05] border border-primary/10 px-3 py-1.5">
                      <div className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center">{r.getActionIcon(action.type)}</div>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[200px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.getActionLabel(action)}</span>
                      <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                    </div>
                  </div>
                ))}
                {r.isLoading && r.messages[r.messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 mr-2"><RadarIcon size={12} className="text-primary" /></div>
                    <div className="bg-muted/50 rounded-2xl rounded-bl-lg px-3.5 py-2.5 border border-border/40">
                      <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span className="text-[12px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>ELABORO...</span></div>
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-border/40 p-3 shrink-0 bg-muted/10">
                {r.messages.length > 0 && (
                  <button onClick={() => { r.setMessages([]); r.setPendingActions([]); }} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-2 px-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <Trash2 className="h-3 w-3" /> NUOVA SESSIONE
                  </button>
                )}
                <div className="flex items-end gap-1.5 bg-card rounded-xl border border-input px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all duration-200">
                  <textarea ref={r.inputRef} value={r.input} onChange={r.handleTextareaInput} onKeyDown={r.handleKeyDown} placeholder="Scrivi al Radar..." className="flex-1 bg-transparent text-sm resize-none border-0 outline-none placeholder:text-muted-foreground/40 min-h-[32px] max-h-[80px] py-1" rows={1} disabled={r.isLoading} />
                  <button onClick={r.startCall} disabled={r.isLoading} className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-200" title="Chiama Radar">
                    <Phone className="h-4 w-4" />
                  </button>
                  <Button size="icon" onClick={() => r.handleSend()} disabled={!r.input.trim() || r.isLoading} className="shrink-0 h-8 w-8 rounded-lg"><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}

// ─── Full-page Radar ───
export function RadarFullPage() {
  const r = useRadar();

  return (
    <div className="h-[calc(100vh-3.5rem)] max-w-3xl mx-auto">
      <div className="h-full rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-accent/[0.04] pointer-events-none" />
          <div className="relative px-5 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {r.view !== 'home' && (
                  <button onClick={r.goBack} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
                  <RadarIcon size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>RADAR</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${r.callActive ? 'bg-destructive animate-pulse' : 'bg-emerald-500'} shadow-[0_0_4px_rgba(16,185,129,0.6)]`} />
                    <span className="text-[10px] text-muted-foreground font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {r.callActive ? `IN CHIAMATA · ${r.formatDuration(r.callDuration)}` : r.view === 'chat' ? 'CHAT MODE' : 'FULL ACCESS'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {r.view === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto p-5 border-t border-border/30">
              <div className="flex items-center gap-3 mb-5">
                {[
                  { value: r.tasksDueToday, label: 'OGGI', alert: r.tasksDueToday > 0 },
                  { value: r.backlogCount, label: 'BACKLOG', alert: false },
                  { value: r.activeEnterprises, label: 'ATTIVE', alert: false },
                  { value: r.activeFocus, label: 'FOCUS', alert: false },
                ].map(gauge => (
                  <div key={gauge.label} className="flex-1 text-center py-3 rounded-lg bg-muted/40 border border-border/30">
                    <div className={`text-xl font-bold tabular-nums leading-none ${gauge.alert ? 'text-primary' : 'text-foreground'}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{gauge.value}</div>
                    <div className="text-[9px] text-muted-foreground font-medium tracking-widest mt-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{gauge.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mb-2 px-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>AZIONI RAPIDE</p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {QUICK_PROMPTS.map(q => (
                  <button key={q.label} onClick={() => r.handleSend(q.prompt)} className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/60 hover:border-primary/20 transition-all px-3 py-3 group text-left">
                    <span className="text-lg">{q.icon}</span>
                    <span className="text-[13px] text-foreground font-medium">{q.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={r.startCall} className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-primary/[0.06] hover:bg-primary/[0.12] border border-primary/15 hover:border-primary/25 transition-all py-4 group">
                <Phone className="h-5 w-5 text-primary/70 group-hover:text-primary transition-colors" />
                <span className="text-sm font-semibold text-primary/80 group-hover:text-primary transition-colors" style={{ fontFamily: "'JetBrains Mono', monospace" }}>CHIAMA RADAR</span>
              </button>
            </motion.div>
          )}

          {r.view === 'voice' && (
            <VoiceCallView callState={r.callState} callActive={r.callActive} callDuration={r.callDuration} input={r.input} isLoading={r.isLoading} startCall={r.startCall} endCall={r.endCall} stopSpeaking={r.stopSpeaking} formatDuration={r.formatDuration} />
          )}

          {r.view === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
              <div ref={r.scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 border-t border-border/30">
                {r.messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <RadarIcon size={32} className="text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Scrivi un messaggio per iniziare</p>
                  </div>
                )}
                {r.messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5"><RadarIcon size={14} className="text-primary" /></div>}
                    <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-lg' : 'bg-muted/50 text-foreground rounded-bl-lg border border-border/40'}`}>
                      {msg.role === 'assistant' ? <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-sm leading-relaxed"><ReactMarkdown>{msg.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>}
                    </div>
                  </div>
                ))}
                {r.pendingActions.filter(a => a.applied).map((action, i) => (
                  <div key={`a-${i}`} className="flex justify-center py-0.5">
                    <div className="flex items-center gap-2 rounded-md bg-primary/[0.05] border border-primary/10 px-3 py-1.5">
                      <div className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center">{r.getActionIcon(action.type)}</div>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[250px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.getActionLabel(action)}</span>
                      <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                    </div>
                  </div>
                ))}
                {r.isLoading && r.messages[r.messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 mr-2"><RadarIcon size={14} className="text-primary" /></div>
                    <div className="bg-muted/50 rounded-2xl rounded-bl-lg px-4 py-3 border border-border/40">
                      <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span className="text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>ELABORO...</span></div>
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-border/40 p-4 shrink-0 bg-muted/10">
                {r.messages.length > 0 && (
                  <button onClick={() => { r.setMessages([]); r.setPendingActions([]); }} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-2 px-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <Trash2 className="h-3 w-3" /> NUOVA SESSIONE
                  </button>
                )}
                <div className="flex items-end gap-1.5 bg-card rounded-xl border border-input px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all duration-200">
                  <textarea ref={r.inputRef} value={r.input} onChange={r.handleTextareaInput} onKeyDown={r.handleKeyDown} placeholder="Scrivi al Radar..." className="flex-1 bg-transparent text-sm resize-none border-0 outline-none placeholder:text-muted-foreground/40 min-h-[36px] max-h-[120px] py-1.5" rows={1} disabled={r.isLoading} />
                  <button onClick={r.startCall} disabled={r.isLoading} className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-200" title="Chiama Radar">
                    <Phone className="h-4 w-4" />
                  </button>
                  <Button size="icon" onClick={() => r.handleSend()} disabled={!r.input.trim() || r.isLoading} className="shrink-0 h-8 w-8 rounded-lg"><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
