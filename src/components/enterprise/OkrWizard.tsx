import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Sparkles, Check, Target, BarChart3, Calendar, X, Loader2, Phone, PhoneOff, Crosshair, Compass, Rocket } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import type { Enterprise } from '@/types/prp';

type Msg = { role: 'user' | 'assistant'; content: string };
type WizardAction = {
  type: 'create_focus_period' | 'create_objective' | 'create_key_result';
  data: any;
  applied?: boolean;
  rejected?: boolean;
};
type WizardView = 'chat' | 'call';
type CallState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking';
type WizardPhase = 'focus' | 'strategy' | 'execution';

const PHASES: { key: WizardPhase; label: string; icon: typeof Crosshair; description: string }[] = [
  { key: 'focus', label: 'Focus', icon: Crosshair, description: 'Focus Period 90gg' },
  { key: 'strategy', label: 'Strategy', icon: Compass, description: 'Objective & KR' },
  { key: 'execution', label: 'Execution', icon: Rocket, description: 'Progetti & Task' },
];

function PhaseStepper({ currentPhase, completedPhases }: { currentPhase: WizardPhase; completedPhases: WizardPhase[] }) {
  const currentIdx = PHASES.findIndex(p => p.key === currentPhase);
  return (
    <div className="px-3 md:px-4 py-2.5 border-b border-border/30 bg-muted/10">
      <div className="flex items-center gap-1">
        {PHASES.map((phase, i) => {
          const isCompleted = completedPhases.includes(phase.key);
          const isCurrent = phase.key === currentPhase;
          const Icon = phase.icon;
          return (
            <div key={phase.key} className="flex items-center flex-1">
              <div className="flex items-center gap-1.5 flex-1">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                  isCompleted ? 'bg-primary text-primary-foreground' : isCurrent ? 'bg-primary/20 text-primary ring-2 ring-primary/30' : 'bg-muted text-muted-foreground'
                }`}>
                  {isCompleted ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <p className={`text-[10px] font-semibold leading-tight ${isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {phase.label}
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-tight truncate">{phase.description}</p>
                </div>
                {/* Mobile: just label */}
                <span className={`text-[10px] font-medium sm:hidden ${isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {phase.label}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <div className={`h-[2px] flex-1 mx-1.5 rounded-full transition-colors duration-300 ${
                  i < currentIdx || completedPhases.includes(PHASES[i + 1].key) ? 'bg-primary' : 'bg-border'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  enterprise: Enterprise;
  activeFocusId?: string;
  onCreated?: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

export function OkrWizard({ enterprise, activeFocusId, onCreated }: Props) {
  const { session } = useAuth();
  const {
    addFocusPeriod, addObjective, addKeyResult,
    getFocusPeriodsForEnterprise, getObjectivesForFocus,
    getKeyResultsForObjective, getProjectsForEnterprise, getTasksForEnterprise,
  } = usePrp();
  // --- Per-enterprise persistent memory ---
  const storageKey = `radar_strategy_${enterprise.id}`;
  const loadPersistedMessages = (): Msg[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const [messages, setMessages] = useState<Msg[]>(() => loadPersistedMessages());
  const [pendingActions, setPendingActions] = useState<WizardAction[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [createdFocusId, setCreatedFocusId] = useState<string | null>(activeFocusId || null);
  const [createdObjectiveId, setCreatedObjectiveId] = useState<string | null>(null);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, storageKey]);

  // Reset state when enterprise changes
  const prevEnterpriseId = useRef(enterprise.id);
  useEffect(() => {
    if (prevEnterpriseId.current !== enterprise.id) {
      prevEnterpriseId.current = enterprise.id;
      setMessages(loadPersistedMessages());
      setPendingActions([]);
      setInput('');
      setCreatedFocusId(activeFocusId || null);
      setCreatedObjectiveId(null);
    }
  }, [enterprise.id]);

  // Phase detection
  const { currentPhase, completedPhases } = useMemo(() => {
    const focusPeriods = getFocusPeriodsForEnterprise(enterprise.id);
    const activeFocus = focusPeriods.find(f => f.status === 'active');
    const hasFocus = !!activeFocus;
    const objectives = activeFocus ? getObjectivesForFocus(activeFocus.id) : [];
    const hasObjectives = objectives.length > 0;
    const keyResults = objectives.flatMap(o => getKeyResultsForObjective(o.id));
    const hasKRs = keyResults.length > 0;
    const projects = getProjectsForEnterprise(enterprise.id);
    const hasProjects = projects.length > 0;

    const completed: WizardPhase[] = [];
    let current: WizardPhase = 'focus';

    if (hasFocus) {
      completed.push('focus');
      current = 'strategy';
    }
    if (hasObjectives && hasKRs) {
      completed.push('strategy');
      current = 'execution';
    }
    if (hasProjects) {
      completed.push('execution');
    }

    return { currentPhase: current, completedPhases: completed };
  }, [enterprise.id, getFocusPeriodsForEnterprise, getObjectivesForFocus, getKeyResultsForObjective, getProjectsForEnterprise, pendingActions]);

  // View & Call state
  const [view, setView] = useState<WizardView>('chat');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<ReturnType<typeof setInterval>>();
  const recognitionRef = useRef<any>(null);
  const callActiveRef = useRef(false);
  const pendingSendRef = useRef<string | null>(null);

  const stripMarkdown = (text: string) =>
    text.replace(/[*_~`#>[\]()!|]/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim();

  useEffect(() => { callActiveRef.current = callActive; }, [callActive]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingActions]);

  useEffect(() => {
    if (isOpen && view === 'chat') setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, view]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch {}
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, []);

  // --- Continuous listening for call mode ---
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
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setInput(finalTranscript + interim);
      if (finalTranscript.trim()) {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          if (callActiveRef.current && finalTranscript.trim()) {
            pendingSendRef.current = finalTranscript.trim();
            try { r.stop(); } catch {}
          }
        }, 1200);
      }
    };

    r.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (pendingSendRef.current) {
        const text = pendingSendRef.current;
        pendingSendRef.current = null;
        setCallState('processing');
        handleSendVoice(text);
        return;
      }
      if (callActiveRef.current) setTimeout(() => { if (callActiveRef.current) startContinuousListening(); }, 300);
    };

    r.onerror = (e: any) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (e.error === 'no-speech' || e.error === 'aborted') {
        if (callActiveRef.current) setTimeout(() => { if (callActiveRef.current) startContinuousListening(); }, 500);
        return;
      }
      console.error('Speech error:', e.error);
    };

    recognitionRef.current = r;
    try { r.start(); setCallState('listening'); } catch {
      setTimeout(() => { if (callActiveRef.current) startContinuousListening(); }, 1000);
    }
  }, []);

  // --- TTS ---
  const speakText = useCallback(async (text: string) => {
    if (!text) return;
    const clean = stripMarkdown(text);
    if (clean.length < 3) return;
    try {
      setCallState(prev => prev !== 'idle' ? 'speaking' : prev);
      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      const audio = new Audio(url);
      audioRef.current = audio;
      const onFinish = () => {
        URL.revokeObjectURL(url);
        if (callActiveRef.current) { setInput(''); setTimeout(() => startContinuousListening(), 400); }
        else setCallState('idle');
      };
      audio.onended = onFinish;
      audio.onerror = onFinish;
      await audio.play();
    } catch {
      if (callActiveRef.current) { setInput(''); setTimeout(() => startContinuousListening(), 400); }
      else setCallState('idle');
    }
  }, [session, startContinuousListening]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if (callActiveRef.current) { setInput(''); setTimeout(() => startContinuousListening(), 300); }
    else setCallState('idle');
  }, [startContinuousListening]);

  // --- Call controls ---
  const startCall = useCallback(async () => {
    setCallState('connecting');
    setCallActive(true);
    callActiveRef.current = true;
    setView('call');
    setCallDuration(0);
    setInput('');
    callTimerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setTimeout(() => startContinuousListening(), 800);
    } catch {
      toast.error('Permesso microfono necessario per la chiamata');
      endCall();
    }
  }, [startContinuousListening]);

  const endCall = useCallback(() => {
    callActiveRef.current = false;
    setCallActive(false);
    setCallState('idle');
    setInput('');
    pendingSendRef.current = null;
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = undefined; }
    try { if (recognitionRef.current) recognitionRef.current.abort(); } catch {}
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setView('chat');
  }, []);

  const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // --- Context builder ---
  const buildContext = () => {
    const focusPeriods = getFocusPeriodsForEnterprise(enterprise.id);
    const projects = getProjectsForEnterprise(enterprise.id);
    const tasks = getTasksForEnterprise(enterprise.id);
    const activeFocus = focusPeriods.find(f => f.status === 'active');
    const objectives = activeFocus ? getObjectivesForFocus(activeFocus.id) : [];
    const keyResults = objectives.flatMap(o => getKeyResultsForObjective(o.id));
    const now = new Date();
    const currentQ = Math.ceil((now.getMonth() + 1) / 3);
    const currentYear = now.getFullYear();
    const qStart = new Date(currentYear, (currentQ - 1) * 3, 1);
    const qEnd = new Date(currentYear, currentQ * 3, 0);
    return {
      enterprise: { name: enterprise.name, status: enterprise.status, businessCategory: enterprise.businessCategory, phase: enterprise.phase, timeHorizon: enterprise.timeHorizon },
      currentDate: now.toISOString().split('T')[0],
      currentQuarter: `Q${currentQ} ${currentYear}`,
      quarterStartDate: qStart.toISOString().split('T')[0],
      quarterEndDate: qEnd.toISOString().split('T')[0],
      focusPeriods: focusPeriods.map(f => ({ name: f.name, status: f.status, startDate: f.startDate, endDate: f.endDate })),
      activeFocus: activeFocus ? { name: activeFocus.name, id: activeFocus.id } : null,
      objectives: objectives.map(o => ({ title: o.title, status: o.status })),
      keyResults: keyResults.map(kr => ({ title: kr.title, targetValue: kr.targetValue, currentValue: kr.currentValue, metricType: kr.metricType })),
      projects: projects.map(p => ({ name: p.name, type: p.type })),
      tasksCount: tasks.length,
      hasFocusPeriodCreated: !!createdFocusId,
      hasObjectiveCreated: !!createdObjectiveId,
      futureFocusPeriods: focusPeriods.filter(f => f.status === 'future').map(f => ({ name: f.name, startDate: f.startDate, endDate: f.endDate })),
      currentWizardPhase: currentPhase,
      completedWizardPhases: completedPhases,
    };
  };

  // --- Core send (works for both text and voice) ---
  const doSend = async (text: string, isVoiceCall: boolean) => {
    if (!text || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    let assistantContent = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ type: 'okr_wizard', messages: newMessages, context: buildContext() }),
      });

      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || `Errore ${resp.status}`); }
      if (!resp.body) throw new Error('No body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
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
            if (p.type === 'delta' && p.content) {
              assistantContent += p.content;
              const snap = assistantContent;
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === 'assistant' ? { ...m, content: snap } : m));
            }
            if (p.type === 'actions' && p.actions?.length) {
              const acts: WizardAction[] = p.actions.map((a: any) => ({ ...a, applied: false }));
              setPendingActions(prev => [...prev, ...acts]);
              // Don't auto-apply — wait for user confirmation
            }
          } catch { buffer = line + '\n' + buffer; break; }
        }
      }

      // Flush remaining
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const p = JSON.parse(jsonStr);
            if (p.type === 'delta' && p.content) {
              assistantContent += p.content;
              const snap = assistantContent;
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === 'assistant' ? { ...m, content: snap } : m));
            }
            if (p.type === 'actions' && p.actions?.length) {
              const acts: WizardAction[] = p.actions.map((a: any) => ({ ...a, applied: false }));
              setPendingActions(prev => [...prev, ...acts]);
            }
          } catch { /* ignore */ }
        }
      }

      if (!assistantContent) {
        setMessages(prev => { const last = prev[prev.length - 1]; return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev; });
        if (isVoiceCall && callActiveRef.current) setTimeout(() => startContinuousListening(), 500);
      } else if (isVoiceCall) {
        speakText(assistantContent);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Errore AI');
      setMessages(prev => { const last = prev[prev.length - 1]; return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev; });
      if (isVoiceCall && callActiveRef.current) setTimeout(() => startContinuousListening(), 1000);
    }
    setIsLoading(false);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    await doSend(text, false);
  };

  const handleSendVoice = async (text: string) => {
    if (!text) return;
    await doSend(text, true);
  };

  // --- Action apply ---
  const applyAction = async (action: WizardAction) => {
    try {
      let appliedLabel = '';
      if (action.type === 'create_focus_period') {
        addFocusPeriod({ enterpriseId: enterprise.id, name: action.data.name, startDate: action.data.start_date, endDate: action.data.end_date, status: action.data.status || 'active' });
        toast.success(`Focus Period "${action.data.name}" creato`);
        action.applied = true;
        appliedLabel = `Focus Period "${action.data.name}"`;
      } else if (action.type === 'create_objective') {
        const focusPeriods = getFocusPeriodsForEnterprise(enterprise.id);
        const targetFocusId = createdFocusId || focusPeriods.find(f => f.status === 'active')?.id;
        if (!targetFocusId) { toast.error('Crea prima un Focus Period attivo'); return; }
        addObjective({ focusPeriodId: targetFocusId, enterpriseId: enterprise.id, title: action.data.title, description: action.data.description, weight: 1, status: 'active' });
        toast.success(`Objective "${action.data.title}" creato`);
        action.applied = true;
        appliedLabel = `Objective "${action.data.title}"`;
      } else if (action.type === 'create_key_result') {
        const focusPeriods = getFocusPeriodsForEnterprise(enterprise.id);
        const activeFocus = focusPeriods.find(f => f.status === 'active');
        const objectives = activeFocus ? getObjectivesForFocus(activeFocus.id) : [];
        const targetObjId = createdObjectiveId || objectives[objectives.length - 1]?.id;
        if (!targetObjId) { toast.error('Crea prima un Objective'); return; }
        addKeyResult({ objectiveId: targetObjId, enterpriseId: enterprise.id, title: action.data.title, targetValue: action.data.target_value, currentValue: 0, metricType: action.data.metric_type || 'percentage', deadline: action.data.deadline, status: 'active' });
        toast.success(`Key Result "${action.data.title}" creato`);
        action.applied = true;
        appliedLabel = `Key Result "${action.data.title}"`;
      }
      setPendingActions(prev => [...prev]);
      onCreated?.();

      // Auto-continue: send a follow-up message to AI so it proceeds to next step
      if (action.applied && appliedLabel) {
        // Small delay to let state update
        setTimeout(() => {
          const continuationMsg = `[Confermato: ${appliedLabel}. Procedi con il prossimo passo del wizard.]`;
          doSend(continuationMsg, false);
        }, 600);
      }
    } catch (e) {
      console.error('Error applying action:', e);
      toast.error("Errore nell'applicare l'azione");
    }
  };

  // --- Action reject ---
  const rejectAction = (action: WizardAction) => {
    action.rejected = true;
    setPendingActions(prev => [...prev]);
    // Tell AI to try again or move on
    setTimeout(() => {
      const label = action.data?.name || action.data?.title || action.type;
      doSend(`[Rifiutato: ${label}. Proponi un'alternativa o procedi al prossimo passo.]`, false);
    }, 400);
  };

  useEffect(() => {
    const focusPeriods = getFocusPeriodsForEnterprise(enterprise.id);
    const active = focusPeriods.find(f => f.status === 'active');
    if (active && !createdFocusId) setCreatedFocusId(active.id);
    if (active) {
      const objs = getObjectivesForFocus(active.id);
      if (objs.length > 0) setCreatedObjectiveId(objs[objs.length - 1].id);
    }
  });

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'; };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create_focus_period': return <Calendar className="h-3 w-3" />;
      case 'create_objective': return <Target className="h-3 w-3" />;
      case 'create_key_result': return <BarChart3 className="h-3 w-3" />;
      default: return <Check className="h-3 w-3" />;
    }
  };
  const getActionLabel = (action: WizardAction) => {
    switch (action.type) {
      case 'create_focus_period': return action.data.name;
      case 'create_objective': return action.data.title;
      case 'create_key_result': return action.data.title;
      default: return action.type;
    }
  };
  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'create_focus_period': return 'Focus';
      case 'create_objective': return 'Objective';
      case 'create_key_result': return 'KR';
      default: return '';
    }
  };

  const now = new Date();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();
  const quarterLabel = `Q${currentQ} ${currentYear}`;
  const hasActiveFocus = !!getFocusPeriodsForEnterprise(enterprise.id).find(f => f.status === 'active');
  const allFocusPeriods = getFocusPeriodsForEnterprise(enterprise.id);
  const futureFocusPeriods = allFocusPeriods.filter(f => f.status === 'future');

  const getOpeningMessage = (): string => {
    const phaseLabel = PHASES.find(p => p.key === currentPhase)?.label || 'Focus';
    if (currentPhase === 'execution') {
      return `🚀 **Fase: Execution** — Focus e strategia definiti per **${enterprise.name}**.\n\nOra creiamo i progetti e le task concrete per muovere i KR. Da quale Objective vuoi partire?`;
    }
    if (currentPhase === 'strategy') {
      const focus = allFocusPeriods.find(f => f.status === 'active')!;
      const objs = getObjectivesForFocus(focus.id);
      if (objs.length === 0) return `🧭 **Fase: Strategy** — Focus attivo: **${focus.name}**.\n\nDefiniamo gli Objective. Qual è la cosa **più importante** che ${enterprise.name} deve raggiungere questo trimestre?`;
      const lastObj = objs[objs.length - 1];
      const krs = getKeyResultsForObjective(lastObj.id);
      if (krs.length < 2) return `📊 **Fase: Strategy** — Objective: **"${lastObj.title}"**.\n\nDefiniamo i Key Results. Qual è il **numero chiave** che ti dice se hai raggiunto questo obiettivo?`;
      return `📊 **Fase: Strategy** — ${objs.length} Objective con ${krs.length} KR definiti.\n\nVuoi aggiungere altro o passare all'Execution?`;
    }
    return `🎯 **Fase: Focus** — Iniziamo la pianificazione strategica di **${enterprise.name}**.\n\n📅 Il trimestre corrente è **${quarterLabel}**. Lavoriamo su questo o preferisci pianificare il prossimo?`;
  };

  // --- Closed state ---
  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          if (messages.length === 0) setMessages([{ role: 'assistant', content: getOpeningMessage() }]);
        }}
        className="w-full group flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.04] to-primary/[0.08] hover:from-primary/[0.08] hover:to-primary/[0.14] transition-all duration-200 px-4 py-3"
      >
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Radar Strategy</p>
          <p className="text-[11px] text-muted-foreground truncate">Pianifica Focus, OKR e strategia</p>
        </div>
        <Send className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </button>
    );
  }

  // --- Call view ---
  if (view === 'call') {
    const callStateLabel = { idle: '', connecting: 'Connessione...', listening: 'Ti ascolto...', processing: 'Elaboro...', speaking: 'Parlo...' }[callState];
    return (
      <div className="rounded-xl border border-primary/20 overflow-hidden bg-card shadow-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-10 px-6 bg-gradient-to-b from-primary/[0.04] to-background relative overflow-hidden"
        >
          {/* Radar circles */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {[1, 2, 3].map(i => (
              <motion.div
                key={i}
                className="absolute rounded-full border border-primary/10"
                style={{ width: 80 + i * 60, height: 80 + i * 60 }}
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}
          </div>

          {/* Timer */}
          <div className="text-xs font-mono text-muted-foreground mb-4 z-10">{formatDuration(callDuration)}</div>

          {/* Center icon */}
          <motion.div
            className={`h-20 w-20 rounded-full flex items-center justify-center z-10 mb-4 ${
              callState === 'listening' ? 'bg-primary/20' : callState === 'speaking' ? 'bg-accent' : 'bg-muted'
            }`}
            animate={callState === 'listening' ? { scale: [1, 1.08, 1] } : callState === 'speaking' ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Sparkles className={`h-8 w-8 ${callState === 'listening' ? 'text-primary' : 'text-muted-foreground'}`} />
          </motion.div>

          {/* State label */}
          <motion.p
            className="text-sm font-medium text-foreground mb-1 z-10"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {callStateLabel}
          </motion.p>

          {/* Live transcript */}
          {input && (
            <p className="text-xs text-muted-foreground text-center max-w-[200px] truncate z-10 mb-2">"{input}"</p>
          )}

          {/* Audio bars for speaking */}
          <AnimatePresence>
            {callState === 'speaking' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 mb-2 z-10">
                {[1, 2, 3, 4, 5].map(i => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full bg-primary"
                    animate={{ height: [8, 16 + Math.random() * 12, 8] }}
                    transition={{ duration: 0.4 + i * 0.1, repeat: Infinity }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-[10px] text-muted-foreground z-10 mb-2">{enterprise.name} · Radar Strategy</p>
          {/* Phase indicator in call */}
          <div className="flex items-center gap-2 z-10 mb-4">
            {PHASES.map((phase) => {
              const isCompleted = completedPhases.includes(phase.key);
              const isCurrent = phase.key === currentPhase;
              return (
                <div key={phase.key} className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
                  isCompleted ? 'bg-primary/20 text-primary' : isCurrent ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'bg-muted/50 text-muted-foreground'
                }`}>
                  {isCompleted ? '✓ ' : ''}{phase.label}
                </div>
              );
            })}
          </div>

          {/* End call */}
          <button
            onClick={endCall}
            className="h-12 w-12 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors z-10"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </motion.div>

        {/* Show pending actions even in call view */}
        {pendingActions.filter(a => !a.applied && !a.rejected).length > 0 && (
          <div className="border-t border-border/50 p-3 space-y-2">
            {pendingActions.filter(a => !a.applied && !a.rejected).map((action, i) => (
              <div key={`cpend-${i}`} className="flex items-center justify-center gap-1.5 rounded-xl bg-accent/50 border border-primary/20 px-3 py-2">
                <div className="h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center">{getActionIcon(action.type)}</div>
                <span className="text-[11px] font-medium text-foreground">{getActionTypeLabel(action.type)}</span>
                <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{getActionLabel(action)}</span>
                <button onClick={() => applyAction(action)} className="ml-1 h-5 w-5 rounded-md bg-primary/15 hover:bg-primary/25 flex items-center justify-center transition-colors" title="Conferma">
                  <Check className="h-3 w-3 text-primary" />
                </button>
                <button onClick={() => rejectAction(action)} className="h-5 w-5 rounded-md bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors" title="Rifiuta">
                  <X className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Chat view ---
  return (
    <div className="rounded-xl border border-primary/20 overflow-hidden bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2.5 bg-gradient-to-r from-primary/[0.06] to-primary/[0.03] border-b border-primary/10">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <span className="text-xs font-semibold text-foreground">Radar Strategy</span>
            <span className="text-[10px] text-muted-foreground ml-1.5 hidden sm:inline">· {enterprise.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Call button */}
          <button
            onClick={startCall}
            className="h-6 w-6 rounded-md hover:bg-primary/10 flex items-center justify-center transition-colors text-muted-foreground hover:text-primary"
            title="Chiama Radar"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Phase Stepper */}
      <PhaseStepper currentPhase={currentPhase} completedPhases={completedPhases} />

      {/* Messages area */}
      <div ref={scrollRef} className="max-h-[50vh] md:max-h-80 overflow-y-auto p-3 md:p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] md:max-w-[75%] rounded-2xl px-3.5 py-2.5 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted/70 text-foreground rounded-bl-md'}`}>
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

        {/* Pending actions awaiting confirmation */}
        {pendingActions.filter(a => !a.applied && !a.rejected).map((action, i) => (
          <div key={`pending-${i}`} className="flex justify-center py-1">
            <div className="flex items-center gap-1.5 rounded-xl bg-accent/50 border border-primary/20 px-3 py-2 shadow-sm">
              <div className="h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center">{getActionIcon(action.type)}</div>
              <span className="text-[11px] font-medium text-foreground">{getActionTypeLabel(action.type)}</span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[120px] md:max-w-[180px]">{getActionLabel(action)}</span>
              <button onClick={() => applyAction(action)} className="ml-1 h-5 w-5 rounded-md bg-primary/15 hover:bg-primary/25 flex items-center justify-center transition-colors" title="Conferma">
                <Check className="h-3 w-3 text-primary" />
              </button>
              <button onClick={() => rejectAction(action)} className="h-5 w-5 rounded-md bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors" title="Rifiuta">
                <X className="h-3 w-3 text-destructive" />
              </button>
            </div>
          </div>
        ))}

        {/* Applied actions */}
        {pendingActions.filter(a => a.applied).map((action, i) => (
          <div key={`action-${i}`} className="flex justify-center py-1">
            <div className="flex items-center gap-1.5 rounded-full bg-primary/[0.08] border border-primary/15 px-3 py-1">
              <div className="h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center">{getActionIcon(action.type)}</div>
              <span className="text-[11px] font-medium text-foreground">{getActionTypeLabel(action.type)}</span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[160px] md:max-w-[240px]">{getActionLabel(action)}</span>
              <Check className="h-3 w-3 text-primary shrink-0" />
            </div>
          </div>
        ))}

        {/* Loading */}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <div className="bg-muted/70 rounded-2xl rounded-bl-md px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-[13px]">Sto pensando...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 p-2.5 md:p-3 bg-muted/20">
        <div className="flex items-end gap-2 bg-card rounded-xl border border-input px-3 py-1.5 focus-within:ring-1 focus-within:ring-ring transition-shadow">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi o chiama Radar..."
            className="flex-1 bg-transparent text-sm resize-none border-0 outline-none placeholder:text-muted-foreground/60 min-h-[32px] max-h-[80px] py-1"
            rows={1}
            disabled={isLoading}
          />
          {/* Call button in input */}
          <button
            onClick={startCall}
            disabled={isLoading}
            className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-all hover:bg-primary/10 text-muted-foreground hover:text-primary"
            title="Chiama Radar"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading} className="shrink-0 h-7 w-7 rounded-lg">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
