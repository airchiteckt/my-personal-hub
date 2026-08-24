import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Send, Trash2, Mic, Volume2, VolumeX, Loader2, Check, X, Building2, FolderKanban, ListTodo, Calendar, Target, BarChart3, ChevronRight, Radio, ArrowLeft, Maximize2, Phone, PhoneOff, MoreVertical, MicOff } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

type Msg = { role: 'user' | 'assistant'; content: string };
type GlobalAction = { id: string; msgIndex: number; type: string; data: any; applied?: boolean; rejected?: boolean };
type TimelineItem =
  | { kind: 'msg'; key: string; index: number; msg: Msg }
  | { kind: 'action'; key: string; action: GlobalAction };


/** Strip raw <tool_call> XML blocks that the model sometimes leaks into text */
function stripToolCallTags(text: string): string {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').replace(/<\/?tool_call>/g, '').trim();
}
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

// Detect mobile once
const isMobileDevice = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

// Check SpeechRecognition support
const SRConstructor = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

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
  const callActiveRef = useRef(false);
  const pendingSendRef = useRef<string | null>(null);
  const doSendRef = useRef<(text: string, isVoiceCall: boolean) => Promise<void>>();
  const isSpeakingRef = useRef(false);
  const greetingCacheRef = useRef<Blob | null>(null);
  const isStartingRecognitionRef = useRef(false);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingActions]);

  useEffect(() => { if (view === 'chat') setTimeout(() => inputRef.current?.focus(), 100); }, [view]);
  useEffect(() => {
    return () => {
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch {}
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      releaseWakeLock();
    };
  }, []);

  // Keep ref in sync
  useEffect(() => { callActiveRef.current = callActive; }, [callActive]);

  const stripMarkdown = (t: string) => t.replace(/[*_~`#>[\]()!|]/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim();

  // Wake Lock to prevent screen sleep during call
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {}
  };
  const releaseWakeLock = () => {
    try { wakeLockRef.current?.release(); wakeLockRef.current = null; } catch {}
  };

  // Unlock audio on iOS — must be called from a user gesture handler
  const unlockAudio = () => {
    const audio = new Audio();
    // Create a tiny silent audio context to unlock playback
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    audio.volume = 0.01;
    const p = audio.play();
    if (p) p.then(() => audio.pause()).catch(() => {});
    audioRef.current = audio;
  };

  // Start continuous listening
  const startContinuousListening = useCallback(() => {
    if (!callActiveRef.current) return;
    if (isStartingRecognitionRef.current) return;
    if (!SRConstructor) {
      toast.error('Il browser non supporta il riconoscimento vocale');
      return;
    }
    isStartingRecognitionRef.current = true;

    try { if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.onerror = null; recognitionRef.current.abort(); } } catch {}

    const r = new SRConstructor();
    r.lang = 'it-IT';
    // iOS: continuous mode crashes; Android/desktop: use continuous
    r.continuous = !isMobileDevice;
    r.interimResults = true;

    let finalTranscript = '';
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    r.onresult = (e: any) => {
      let interim = '';
      finalTranscript = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      const currentText = finalTranscript + interim;
      setInput(currentText);

      // Interrupt TTS if user speaks
      if (isSpeakingRef.current && currentText.trim().length > 2) {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        isSpeakingRef.current = false;
        setCallState('listening');
      }

      if (finalTranscript.trim()) {
        if (silenceTimer) clearTimeout(silenceTimer);
        const delay = isMobileDevice ? 1200 : 700;
        silenceTimer = setTimeout(() => {
          if (callActiveRef.current && finalTranscript.trim()) {
            pendingSendRef.current = finalTranscript.trim();
            try { r.stop(); } catch {}
          }
        }, delay);
      }
    };

    r.onend = () => {
      isStartingRecognitionRef.current = false;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (pendingSendRef.current) {
        const text = pendingSendRef.current;
        pendingSendRef.current = null;
        setCallState('processing');
        if (doSendRef.current) doSendRef.current(text, true);
        return;
      }
      if (isSpeakingRef.current) return;
      // On mobile, use a longer delay to avoid rapid restarts
      const restartDelay = isMobileDevice ? 500 : 200;
      if (callActiveRef.current) setTimeout(() => { if (callActiveRef.current && !isStartingRecognitionRef.current) startContinuousListening(); }, restartDelay);
    };

    r.onerror = (e: any) => {
      isStartingRecognitionRef.current = false;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (e.error === 'no-speech' || e.error === 'aborted') {
        if (isSpeakingRef.current) return;
        if (callActiveRef.current) setTimeout(() => { if (callActiveRef.current && !isStartingRecognitionRef.current) startContinuousListening(); }, isMobileDevice ? 600 : 300);
        return;
      }
      if (e.error === 'not-allowed') {
        toast.error('Permesso microfono negato. Controlla le impostazioni del browser.');
        return;
      }
      console.error('Speech error:', e.error);
      if (callActiveRef.current) setTimeout(() => { if (callActiveRef.current && !isStartingRecognitionRef.current) startContinuousListening(); }, 800);
    };

    recognitionRef.current = r;
    try {
      r.start();
      if (!isSpeakingRef.current) setCallState('listening');
    } catch (err) {
      console.warn('[Radar] STT start failed, retrying...', err);
      isStartingRecognitionRef.current = false;
      setTimeout(() => { if (callActiveRef.current && !isStartingRecognitionRef.current) startContinuousListening(); }, 800);
    }
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (!text) return;
    const clean = stripMarkdown(text);
    if (clean.length < 3) return;
    try {
      isSpeakingRef.current = true;
      setCallState('speaking');

      // On desktop, listen during TTS for interruption; on mobile skip
      if (!isMobileDevice) startContinuousListening();

      let blob: Blob;
      const isGreeting = clean === 'Pronto.' || clean === 'Pronto';
      if (isGreeting && greetingCacheRef.current) {
        blob = greetingCacheRef.current;
      } else {
        const res = await fetch(TTS_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ text: clean }),
        });
        if (!res.ok) throw new Error('TTS failed');
        if (!isSpeakingRef.current) return;
        blob = await res.blob();
        if (isGreeting) greetingCacheRef.current = blob;
      }

      const url = URL.createObjectURL(blob);
      const audio = audioRef.current || new Audio();
      audio.pause();
      if (audio.src && audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
      audio.src = url;
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        isSpeakingRef.current = false;
        if (callActiveRef.current) { setInput(''); setCallState('listening'); startContinuousListening(); }
        else setCallState('idle');
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        isSpeakingRef.current = false;
        if (callActiveRef.current) { setInput(''); setCallState('listening'); startContinuousListening(); }
        else setCallState('idle');
      };
      await audio.play();
    } catch (err) {
      console.error('[Radar TTS] Error:', err);
      isSpeakingRef.current = false;
      if (callActiveRef.current) { setInput(''); setCallState('listening'); startContinuousListening(); }
      else setCallState('idle');
    }
  }, [session, startContinuousListening]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    isSpeakingRef.current = false;
    if (callActiveRef.current) { setInput(''); setCallState('listening'); startContinuousListening(); }
    else setCallState('idle');
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
      azioniGiaEseguiteInQuestaChat: pendingActions.filter(a => a.applied).map(a => ({ tipo: a.type, dati: a.data })),
      azioniRifiutateInQuestaChat: pendingActions.filter(a => a.rejected).map(a => ({ tipo: a.type, dati: a.data })),
      notaAzioni: 'Le azioni elencate in azioniGiaEseguiteInQuestaChat sono GIÀ state eseguite e confermate: non riproporle mai. Le azioni in azioniRifiutateInQuestaChat sono state annullate dall\'utente: non riproporle a meno di richiesta esplicita.',
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
      setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, applied: true } : a));
    } catch (e) { console.error(e); toast.error("Errore nell'azione"); }
  };

  // Core send function
  const doSend = async (text: string, isVoiceCall: boolean) => {
    doSendRef.current = doSend;
    if (!text) return;
    if (isLoading && !isVoiceCall) return;
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
      const assistantIndex = newMessages.length;
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
            if (p.type === 'actions' && p.actions?.length) {
              const acts: GlobalAction[] = p.actions.map((a: any, k: number) => ({
                ...a,
                id: `${assistantIndex}-${Date.now()}-${k}-${Math.random().toString(36).slice(2, 7)}`,
                msgIndex: assistantIndex,
                applied: false,
                rejected: false,
              }));
              setPendingActions(prev => {
                // dedup: skip actions identical to ones already proposed/applied in this chat
                const sig = (a: GlobalAction) => `${a.type}|${JSON.stringify(a.data ?? {})}`;
                const seen = new Set(prev.map(sig));
                return [...prev, ...acts.filter(a => !seen.has(sig(a)))];
              });
            }

          } catch { buffer = line + '\n' + buffer; break; }
        }
      }
      if (!assistantContent) {
        setMessages(prev => { const last = prev[prev.length - 1]; return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev; });
        if (isVoiceCall && callActiveRef.current) {
          setTimeout(() => startContinuousListening(), 500);
        }
      } else if (isVoiceCall || voiceEnabled) {
        speakText(assistantContent);
      }
    } catch (e: any) {
      console.error(e); toast.error(e?.message || 'Errore AI');
      setMessages(prev => { const last = prev[prev.length - 1]; return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev; });
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

  doSendRef.current = doSend;

  // Start a call
  const startCall = useCallback(async () => {
    // Check SpeechRecognition support before starting
    if (!SRConstructor) {
      toast.error('Il tuo browser non supporta il riconoscimento vocale. Usa Chrome o Safari.');
      return;
    }

    // Unlock audio on iOS (must happen in user gesture context)
    if (isIOS) unlockAudio();

    setCallActive(true);
    callActiveRef.current = true;
    isSpeakingRef.current = false;
    setVoiceEnabled(true);
    setView('voice');
    setCallDuration(0);
    setInput('');
    setCallState('processing');

    // Pre-create audio element
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    audioRef.current.preload = 'auto';

    callTimerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);

    // Request wake lock
    requestWakeLock();

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('Permesso microfono necessario per la chiamata');
      endCall();
      return;
    }

    setMessages(prev => [...prev, { role: 'assistant', content: 'Pronto.' }]);
    speakText('Pronto.');
  }, []);

  // End a call
  const endCall = useCallback(() => {
    callActiveRef.current = false;
    isSpeakingRef.current = false;
    isStartingRecognitionRef.current = false;
    setCallActive(false);
    setCallState('idle');
    setInput('');
    pendingSendRef.current = null;

    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = undefined; }
    try { if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.onerror = null; recognitionRef.current.abort(); } } catch {}
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }

    releaseWakeLock();
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
  const getActionDescription = (a: GlobalAction) => {
    const parts: string[] = [];
    if (a.data?.priority) parts.push(`priorità ${a.data.priority}`);
    if (a.data?.estimated_minutes) parts.push(`${a.data.estimated_minutes} min`);
    if (a.data?.date || a.data?.start_date) parts.push(a.data.date || a.data.start_date);
    if (a.data?.start_time && a.data?.end_time) parts.push(`${a.data.start_time}-${a.data.end_time}`);
    return parts.join(' · ');
  };
  const getActionTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      create_enterprise: 'Nuova impresa', create_project: 'Nuovo progetto', create_task: 'Nuova task',
      create_focus_period: 'Nuovo focus', create_objective: 'Nuovo obiettivo', create_key_result: 'Nuovo KR',
      schedule_task: 'Pianifica task', complete_task: 'Completa task', create_appointment: 'Nuovo appuntamento',
    };
    return map[type] || type.replace(/_/g, ' ');
  };

  const approveAction = async (action: GlobalAction) => {
    await applyAction(action);
    if (callActiveRef.current) speakText('Fatto.');
  };

  const rejectAction = (action: GlobalAction) => {
    action.rejected = true;
    setPendingActions(prev => [...prev]);
    toast('Azione annullata');
    if (callActiveRef.current) speakText('Annullato.');
  };

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
    getActionDescription, getActionTypeLabel, approveAction, rejectAction,
    goBack, stopSpeaking, tasksDueToday, activeEnterprises, backlogCount, activeFocus,
    formatDuration,
  };
}

// ─── Action Confirmation Card ───
function ActionConfirmCard({ action, getActionIcon, getActionLabel, getActionDescription, getActionTypeLabel, onApprove, onReject }: {
  action: GlobalAction;
  getActionIcon: (type: string) => React.ReactNode;
  getActionLabel: (a: GlobalAction) => string;
  getActionDescription: (a: GlobalAction) => string;
  getActionTypeLabel: (type: string) => string;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (action.applied) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-primary/[0.05] border border-primary/10 px-3 py-2">
        <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">{getActionIcon(action.type)}</div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-foreground truncate block">{getActionLabel(action)}</span>
        </div>
        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
      </div>
    );
  }
  if (action.rejected) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border/30 px-3 py-2 opacity-60">
        <div className="h-5 w-5 rounded bg-muted flex items-center justify-center">{getActionIcon(action.type)}</div>
        <div className="flex-1 min-w-0">
          <span className="text-xs text-muted-foreground line-through truncate block">{getActionLabel(action)}</span>
        </div>
        <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 space-y-2.5"
    >
      <div className="flex items-start gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 mt-0.5">{getActionIcon(action.type)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{getActionTypeLabel(action.type)}</p>
          <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{getActionLabel(action)}</p>
          {getActionDescription(action) && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{getActionDescription(action)}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground py-2.5 text-xs font-semibold hover:opacity-90 active:scale-[0.97] transition-all min-h-[44px]"
        >
          <Check className="h-3.5 w-3.5" /> Approva
        </button>
        <button
          onClick={onReject}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-foreground py-2.5 text-xs font-medium hover:bg-muted active:scale-[0.97] transition-all min-h-[44px]"
        >
          <X className="h-3.5 w-3.5" /> Annulla
        </button>
      </div>
    </motion.div>
  );
}

// ─── Voice View (shared) ───
function VoiceCallView({ callState, callActive, callDuration, input, isLoading, startCall, endCall, stopSpeaking, formatDuration, messages, pendingActions, getActionIcon, getActionLabel, getActionDescription, getActionTypeLabel, approveAction, rejectAction }: {
  callState: CallState; callActive: boolean; callDuration: number; input: string; isLoading: boolean;
  startCall: () => void; endCall: () => void; stopSpeaking: () => void; formatDuration: (s: number) => string;
  messages: Msg[];
  pendingActions: GlobalAction[];
  getActionIcon: (type: string) => React.ReactNode;
  getActionLabel: (a: GlobalAction) => string;
  getActionDescription: (a: GlobalAction) => string;
  getActionTypeLabel: (type: string) => string;
  approveAction: (a: GlobalAction) => void;
  rejectAction: (a: GlobalAction) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, pendingActions]);
  
  const stateLabel: Record<CallState, string> = {
    idle: 'CHIAMA RADAR',
    connecting: 'CONNESSIONE...',
    listening: 'TI ASCOLTO',
    processing: 'ELABORO...',
    speaking: 'RADAR PARLA...',
  };

  const stateIcon: Record<CallState, React.ReactNode> = {
    idle: <Phone className="h-5 w-5" />,
    connecting: <Loader2 className="h-5 w-5 animate-spin" />,
    listening: <Mic className="h-5 w-5" />,
    processing: <Loader2 className="h-5 w-5 animate-spin" />,
    speaking: <Volume2 className="h-5 w-5" />,
  };

  return (
    <motion.div
      key="voice"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col border-t border-border/30 relative overflow-hidden"
    >
      {/* Top status bar */}
      <div className="flex items-center justify-center gap-3 py-3 px-4 shrink-0">
        {callActive && (
          <span className="text-xs text-muted-foreground tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {formatDuration(callDuration)}
          </span>
        )}
        <div className="flex items-center gap-2">
          <div className="relative">
            {callActive && callState === 'listening' && (
              <motion.div
                className="absolute rounded-full border-2 border-primary/20 pointer-events-none"
                style={{ width: 44, height: 44, left: -6, top: -6 }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {!callActive ? (
              <motion.button
                onClick={startCall}
                className="relative h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                whileTap={{ scale: 0.93 }}
              >
                <Phone className="h-4 w-4" />
              </motion.button>
            ) : (
              <motion.div
                className={`relative h-8 w-8 rounded-full flex items-center justify-center ${
                  callState === 'speaking' ? 'bg-primary shadow-[0_0_15px_hsl(var(--primary)/0.3)]'
                  : callState === 'listening' ? 'bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.2)]'
                  : 'bg-primary/80'
                } text-primary-foreground`}
                animate={callState === 'listening' ? { scale: [1, 1.06, 1] } : {}}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                {callState === 'processing' || callState === 'connecting' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : callState === 'speaking' ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </motion.div>
            )}
          </div>
          <motion.p
            className="text-[11px] font-medium text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            animate={callState === 'listening' ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
            transition={callState === 'listening' ? { duration: 2, repeat: Infinity } : {}}
          >
            {stateLabel[callState]}
          </motion.p>
        </div>
        {callState === 'speaking' && (
          <button onClick={stopSpeaking} className="text-[10px] text-muted-foreground hover:text-foreground active:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted min-h-[32px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            STOP
          </button>
        )}
      </div>

      {/* Live transcript */}
      <AnimatePresence>
        {callActive && input && callState === 'listening' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-4 mb-2 shrink-0"
          >
            <div className="bg-primary/5 rounded-lg px-3 py-2 border border-primary/10 text-center">
              <p className="text-xs text-foreground/70 italic">🎤 "{input}"</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat transcript - scrollable */}
      {messages.length > 0 && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 px-4 pb-2 min-h-0">
          {messages.map((msg, i) => {
            if (i === 0 && msg.role === 'user' && (msg.content.includes('Salutami brevemente') || msg.content.includes('Rispondi solo'))) return null;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-primary/10 text-foreground border border-primary/15'
                    : 'bg-muted/50 text-foreground border border-border/40'
                }`}>
                  <p className="text-xs leading-relaxed">
                    {msg.role === 'user' && <span className="text-[10px] text-muted-foreground mr-1">🎤</span>}
                    {msg.content}
                  </p>
                </div>
              </motion.div>
            );
          })}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-muted/50 rounded-xl px-3 py-2 border border-border/40">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>ELABORO...</span>
                </div>
              </div>
            </div>
          )}
          {/* Pending action cards */}
          {pendingActions.filter(a => !a.applied && !a.rejected).map((action, i) => (
            <div key={`va-${i}`} className="w-full">
              <ActionConfirmCard action={action} getActionIcon={getActionIcon} getActionLabel={getActionLabel} getActionDescription={getActionDescription} getActionTypeLabel={getActionTypeLabel} onApprove={() => approveAction(action)} onReject={() => rejectAction(action)} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state when no messages and not active */}
      {messages.length === 0 && !callActive && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Tocca per avviare una conversazione vocale</p>
        </div>
      )}

      {/* Bottom controls — fixed at bottom with safe area */}
      {callActive && (
        <div className="shrink-0 flex flex-col items-center gap-2 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={(e) => { e.stopPropagation(); endCall(); }}
            className="h-14 w-14 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          >
            <PhoneOff className="h-6 w-6" />
          </motion.button>
          <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>RIATTACCA</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Sheet Component ───
export function AiAssistant() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const r = useRadar();

  // Switch view to chat when expanding (skip home gauges since dock IS the entry)
  useEffect(() => {
    if (expanded && r.view === 'home') r.setView('chat');
    if (!expanded && r.callActive) r.endCall();
  }, [expanded]);

  // Auto-expand when user starts typing or messages arrive
  useEffect(() => {
    if (r.messages.length > 0 && !expanded) setExpanded(true);
  }, [r.messages.length]);

  // ESC to collapse
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !r.callActive) setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, r.callActive]);

  const openFullPage = () => { setExpanded(false); navigate('/radar'); };

  const hasMessages = r.messages.length > 0;

  return (
    <>
      {/* Backdrop when expanded (light, click to collapse) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => !r.callActive && setExpanded(false)}
            className="fixed inset-0 z-40 bg-background/40 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      <div
        className="fixed z-50 left-0 right-0 bottom-0 md:left-auto md:right-4 md:bottom-4 md:w-[min(440px,calc(100vw-2rem))] pointer-events-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="pointer-events-auto mx-auto md:mx-0 bg-card border border-border/60 shadow-2xl shadow-black/10 rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: expanded ? 'min(70vh, 640px)' : '72px' }}
        >
          {/* Header (only when expanded) */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="shrink-0 border-b border-border/40 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-br from-primary/[0.05] to-transparent">
                  <div className="flex items-center gap-2.5">
                    {r.view !== 'chat' && r.view !== 'home' && (
                      <button onClick={r.goBack} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground">
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                    )}
                    <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
                      <RadarIcon size={16} className="text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-foreground tracking-tight leading-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>RADAR</h2>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={`h-1.5 w-1.5 rounded-full ${r.callActive ? 'bg-destructive animate-pulse' : 'bg-emerald-500'}`} />
                        <span className="text-[9px] text-muted-foreground font-medium tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {r.callActive ? `IN CHIAMATA · ${r.formatDuration(r.callDuration)}` : 'ONLINE'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {hasMessages && !r.callActive && (
                      <button onClick={() => { r.setMessages([]); r.setPendingActions([]); }} className="h-8 px-2 rounded-lg flex items-center gap-1.5 hover:bg-muted text-muted-foreground text-[10px] font-medium tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }} title="Nuova sessione">
                        <Trash2 className="h-3 w-3" /> RESET
                      </button>
                    )}
                    {!r.callActive && (
                      <button onClick={openFullPage} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground" title="Apri a tutto schermo">
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!r.callActive && (
                      <button onClick={() => setExpanded(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground" title="Minimizza">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Body */}
          <AnimatePresence mode="wait" initial={false}>
            {expanded && r.view === 'voice' && (
              <motion.div key="voice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 overflow-hidden">
                <VoiceCallView callState={r.callState} callActive={r.callActive} callDuration={r.callDuration} input={r.input} isLoading={r.isLoading} startCall={r.startCall} endCall={r.endCall} stopSpeaking={r.stopSpeaking} formatDuration={r.formatDuration} messages={r.messages} pendingActions={r.pendingActions} getActionIcon={r.getActionIcon} getActionLabel={r.getActionLabel} getActionDescription={r.getActionDescription} getActionTypeLabel={r.getActionTypeLabel} approveAction={r.approveAction} rejectAction={r.rejectAction} />
              </motion.div>
            )}

            {expanded && r.view !== 'voice' && (
              <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 flex flex-col">
                <div ref={r.scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {!hasMessages && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        {[
                          { value: r.tasksDueToday, label: 'OGGI', alert: r.tasksDueToday > 0 },
                          { value: r.backlogCount, label: 'BACKLOG', alert: false },
                          { value: r.activeEnterprises, label: 'ATTIVE', alert: false },
                          { value: r.activeFocus, label: 'FOCUS', alert: false },
                        ].map(g => (
                          <div key={g.label} className="flex-1 text-center py-2 rounded-lg bg-muted/40 border border-border/30">
                            <div className={`text-base font-bold tabular-nums leading-none ${g.alert ? 'text-primary' : 'text-foreground'}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{g.value}</div>
                            <div className="text-[8px] text-muted-foreground font-medium tracking-widest mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{g.label}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium mb-1.5 px-0.5 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>AZIONI RAPIDE</p>
                        <div className="space-y-1">
                          {QUICK_PROMPTS.map(q => (
                            <button key={q.label} onClick={() => r.handleSend(q.prompt)} className="w-full flex items-center gap-3 rounded-lg border border-border/50 bg-card/80 hover:bg-muted/60 px-3 py-2.5 text-left">
                              <span className="text-sm">{q.icon}</span>
                              <span className="text-[12px] text-foreground font-medium flex-1">{q.label}</span>
                              <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {r.messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5"><RadarIcon size={12} className="text-primary" /></div>}
                      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-lg' : 'bg-muted/50 text-foreground rounded-bl-lg border border-border/40'}`}>
                        {msg.role === 'assistant' ? <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[13px] leading-relaxed"><ReactMarkdown>{stripToolCallTags(msg.content)}</ReactMarkdown></div> : <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>}
                      </div>
                    </div>
                  ))}
                  {r.pendingActions.map((action, i) => (
                    <div key={`a-${i}`} className="py-0.5">
                      <ActionConfirmCard action={action} getActionIcon={r.getActionIcon} getActionLabel={r.getActionLabel} getActionDescription={r.getActionDescription} getActionTypeLabel={r.getActionTypeLabel} onApprove={() => r.approveAction(action)} onReject={() => r.rejectAction(action)} />
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Composer (always visible, unless in voice call) */}
          {r.view !== 'voice' && (
            <div className="shrink-0 p-2.5 border-t border-border/40 bg-card">
              <div className="flex items-end gap-1.5 bg-background rounded-xl border border-input px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all">
                {!expanded && (
                  <div className="h-7 w-7 shrink-0 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
                    <RadarIcon size={14} className="text-primary" />
                  </div>
                )}
                <textarea
                  ref={r.inputRef}
                  value={r.input}
                  onChange={r.handleTextareaInput}
                  onKeyDown={r.handleKeyDown}
                  onFocus={() => setExpanded(true)}
                  placeholder={expanded ? 'Scrivi o dai un ordine a Radar...' : 'Chiedi qualcosa a Radar...'}
                  className="flex-1 bg-transparent text-sm resize-none border-0 outline-none placeholder:text-muted-foreground/50 min-h-[32px] max-h-[120px] py-1.5"
                  rows={1}
                  disabled={r.isLoading}
                />
                {expanded && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground transition-all">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top" className="min-w-[180px]">
                      <DropdownMenuItem onClick={r.startCall} disabled={r.isLoading}>
                        <Phone className="h-4 w-4 mr-2" /> Chiama Radar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button size="icon" onClick={() => { setExpanded(true); r.handleSend(); }} disabled={!r.input.trim() || r.isLoading} className="shrink-0 h-8 w-8 rounded-lg">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}

// ─── Full-page Radar ───
export function RadarFullPage() {
  const r = useRadar();

  return (
    <div className="h-[calc(100dvh-3.5rem)] max-w-3xl mx-auto">
      <div className="h-full rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-accent/[0.04] pointer-events-none" />
          <div className="relative px-5 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {r.view !== 'home' && (
                  <button onClick={r.goBack} className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground">
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
                  <button key={q.label} onClick={() => r.handleSend(q.prompt)} className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/60 active:bg-muted/80 transition-all px-3 py-3 group text-left min-h-[48px]">
                    <span className="text-lg">{q.icon}</span>
                    <span className="text-[13px] text-foreground font-medium">{q.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={r.startCall} className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-primary/[0.06] hover:bg-primary/[0.12] active:bg-primary/[0.18] border border-primary/15 transition-all py-4 group min-h-[52px]">
                <Phone className="h-5 w-5 text-primary/70 group-hover:text-primary transition-colors" />
                <span className="text-sm font-semibold text-primary/80 group-hover:text-primary transition-colors" style={{ fontFamily: "'JetBrains Mono', monospace" }}>CHIAMA RADAR</span>
              </button>

              <div className="mt-4 flex items-end gap-1.5 bg-card rounded-xl border border-input px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all duration-200">
                <textarea ref={r.inputRef} value={r.input} onChange={r.handleTextareaInput} onKeyDown={r.handleKeyDown} placeholder="Scrivi o dai un ordine a Radar..." className="flex-1 bg-transparent text-sm resize-none border-0 outline-none placeholder:text-muted-foreground/40 min-h-[36px] max-h-[120px] py-1.5" rows={1} disabled={r.isLoading} />
                <Button size="icon" onClick={() => r.handleSend()} disabled={!r.input.trim() || r.isLoading} className="shrink-0 h-8 w-8 rounded-lg"><Send className="h-4 w-4" /></Button>
              </div>
            </motion.div>
          )}

          {r.view === 'voice' && (
            <VoiceCallView callState={r.callState} callActive={r.callActive} callDuration={r.callDuration} input={r.input} isLoading={r.isLoading} startCall={r.startCall} endCall={r.endCall} stopSpeaking={r.stopSpeaking} formatDuration={r.formatDuration} messages={r.messages} pendingActions={r.pendingActions} getActionIcon={r.getActionIcon} getActionLabel={r.getActionLabel} getActionDescription={r.getActionDescription} getActionTypeLabel={r.getActionTypeLabel} approveAction={r.approveAction} rejectAction={r.rejectAction} />
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
{msg.role === 'assistant' ? <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-sm leading-relaxed"><ReactMarkdown>{stripToolCallTags(msg.content)}</ReactMarkdown></div> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>}
                    </div>
                  </div>
                ))}
                {r.pendingActions.map((action, i) => (
                  <div key={`a-${i}`} className="py-0.5">
                    <ActionConfirmCard action={action} getActionIcon={r.getActionIcon} getActionLabel={r.getActionLabel} getActionDescription={r.getActionDescription} getActionTypeLabel={r.getActionTypeLabel} onApprove={() => r.approveAction(action)} onReject={() => r.rejectAction(action)} />
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
                  <button onClick={() => { r.setMessages([]); r.setPendingActions([]); }} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-2 px-1 min-h-[32px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <Trash2 className="h-3 w-3" /> NUOVA SESSIONE
                  </button>
                )}
                <div className="flex items-end gap-1.5 bg-card rounded-xl border border-input px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all duration-200">
                  <textarea ref={r.inputRef} value={r.input} onChange={r.handleTextareaInput} onKeyDown={r.handleKeyDown} placeholder="Scrivi al Radar..." className="flex-1 bg-transparent text-sm resize-none border-0 outline-none placeholder:text-muted-foreground/40 min-h-[36px] max-h-[120px] py-1.5" rows={1} disabled={r.isLoading} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="shrink-0 h-10 w-10 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80 text-muted-foreground transition-all duration-200">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top" className="min-w-[160px]">
                      <DropdownMenuItem onClick={r.startCall} disabled={r.isLoading}>
                        <Phone className="h-4 w-4 mr-2" /> Chiama Radar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
