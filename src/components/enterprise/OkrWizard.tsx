import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Sparkles, Check, Target, BarChart3, Calendar, X, Loader2, Phone, PhoneOff, Crosshair, Trash2, FolderPlus, ListTodo, Plus, Clock, Square, Pencil } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import type { Enterprise } from '@/types/prp';
import { getThresholds } from '@/components/admin/PlanningThresholds';

// ─── Types ───────────────────────────────────────────────────────────
type Msg = { role: 'user' | 'assistant'; content: string };
type WizardAction = {
  id: string;
  type: 'create_focus_period' | 'create_objective' | 'create_key_result' | 'create_project' | 'create_task';
  data: any;
  applied?: boolean;
  rejected?: boolean;
  afterMessageIndex: number;
};
type WizardView = 'chat' | 'call';
type CallState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking';
type WizardPhase = 'focus' | 'objectives' | 'key_results' | 'projects' | 'tasks';

type ConversationMeta = {
  id: string;
  title: string;
  createdAt: string;
  status: 'active' | 'completed';
  focusPeriodId?: string;
};

type StoredData = {
  conversations: { id: string; title: string; createdAt: string; status: string; focusPeriodId?: string; messages: Msg[] }[];
  activeConversationId: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────
const PLANNING_STAGES: { key: WizardPhase; label: string; shortLabel: string; icon: typeof Crosshair }[] = [
  { key: 'focus', label: 'Focus', shortLabel: 'Focus', icon: Crosshair },
  { key: 'objectives', label: 'Obiettivi', shortLabel: 'Obj', icon: Target },
  { key: 'key_results', label: 'Key Results', shortLabel: 'KR', icon: BarChart3 },
  { key: 'projects', label: 'Progetti', shortLabel: 'Proj', icon: FolderPlus },
  { key: 'tasks', label: 'Task', shortLabel: 'Task', icon: ListTodo },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

const GHOST_CREATION_REGEX = /(?:ho creato|ho collegat[oaei]|ecco (?:le|i|la|il)\s+\d|procediamo con la creazione|task creata|progetto creato|task collegat[aei]|fatto!?\s*(?:ho|le|i)|completato!?\s*(?:ho|le|i)|ufficialmente collegat)/i;

// ─── Sub-components ──────────────────────────────────────────────────
function PlanningProgressBar({ currentPhase, completedPhases }: { currentPhase: WizardPhase; completedPhases: WizardPhase[] }) {
  const completedCount = completedPhases.length;
  const progressPct = Math.round((completedCount / PLANNING_STAGES.length) * 100);

  return (
    <div className="px-3 md:px-4 py-2 border-b border-border/30 bg-muted/10">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground shrink-0">{progressPct}%</span>
      </div>
      <div className="flex items-center">
        {PLANNING_STAGES.map((stage, i) => {
          const isCompleted = completedPhases.includes(stage.key);
          const isCurrent = stage.key === currentPhase;
          const Icon = stage.icon;
          return (
            <div key={stage.key} className="flex items-center flex-1">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                  isCompleted ? 'bg-primary text-primary-foreground' : isCurrent ? 'bg-primary/20 text-primary ring-1.5 ring-primary/30' : 'bg-muted text-muted-foreground'
                }`}>
                  {isCompleted ? <Check className="h-2.5 w-2.5" /> : <Icon className="h-2.5 w-2.5" />}
                </div>
                <span className={`text-[9px] font-medium truncate hidden sm:block ${isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {stage.label}
                </span>
                <span className={`text-[9px] font-medium sm:hidden ${isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {stage.shortLabel}
                </span>
              </div>
              {i < PLANNING_STAGES.length - 1 && (
                <div className={`h-[1.5px] flex-1 mx-1 rounded-full transition-colors duration-300 ${
                  isCompleted ? 'bg-primary' : 'bg-border'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Action card helpers ─────────────────────────────────────────────
const getActionIcon = (type: string) => {
  switch (type) {
    case 'create_focus_period': return <Calendar className="h-3 w-3" />;
    case 'create_objective': return <Target className="h-3 w-3" />;
    case 'create_key_result': return <BarChart3 className="h-3 w-3" />;
    case 'create_project': return <FolderPlus className="h-3 w-3" />;
    case 'create_task': return <ListTodo className="h-3 w-3" />;
    default: return <Check className="h-3 w-3" />;
  }
};

const getActionLabel = (action: WizardAction) => action.data.title || action.data.name || action.type;

const getActionTypeLabel = (type: string) => {
  switch (type) {
    case 'create_focus_period': return 'Focus';
    case 'create_objective': return 'Objective';
    case 'create_key_result': return 'KR';
    case 'create_project': return 'Progetto';
    case 'create_task': return 'Task';
    default: return '';
  }
};

const getEntityLabel = (action: WizardAction) => {
  const name = action.data.title || action.data.name;
  return `${getActionTypeLabel(action.type)} "${name}"`;
};

function ActionCard({ action, onApply, onReject }: { action: WizardAction; onApply: () => void; onReject: () => void }) {
  if (action.applied) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-primary/[0.08] border border-primary/20 px-3 py-1.5 animate-in fade-in duration-200">
        <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center">{getActionIcon(action.type)}</div>
        <span className="text-[11px] font-medium text-foreground">{getActionTypeLabel(action.type)}</span>
        <span className="text-[11px] text-muted-foreground truncate max-w-[160px] md:max-w-[240px]">{getActionLabel(action)}</span>
        <Check className="h-3 w-3 text-primary shrink-0" />
      </div>
    );
  }

  if (action.rejected) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-destructive/[0.06] border border-destructive/15 px-3 py-1.5 opacity-60 animate-in fade-in duration-200">
        <div className="h-4 w-4 rounded-full bg-destructive/10 flex items-center justify-center">{getActionIcon(action.type)}</div>
        <span className="text-[11px] font-medium text-muted-foreground line-through">{getActionTypeLabel(action.type)}</span>
        <span className="text-[11px] text-muted-foreground truncate max-w-[160px] md:max-w-[240px] line-through">{getActionLabel(action)}</span>
        <X className="h-3 w-3 text-destructive/60 shrink-0" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-accent/50 border border-primary/20 px-3 py-2 shadow-sm animate-in slide-in-from-bottom-2 duration-300 max-w-full">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <div className="h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center shrink-0">{getActionIcon(action.type)}</div>
        <span className="text-[11px] font-medium text-foreground shrink-0">{getActionTypeLabel(action.type)}</span>
        <span className="text-[11px] text-muted-foreground truncate min-w-0">{getActionLabel(action)}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={(e) => { e.stopPropagation(); onApply(); }} className="h-7 w-7 md:h-5 md:w-5 rounded-md bg-primary/15 hover:bg-primary/25 active:bg-primary/35 flex items-center justify-center transition-colors" title="Conferma">
          <Check className="h-3.5 w-3.5 md:h-3 md:w-3 text-primary" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onReject(); }} className="h-7 w-7 md:h-5 md:w-5 rounded-md bg-destructive/10 hover:bg-destructive/20 active:bg-destructive/30 flex items-center justify-center transition-colors" title="Rifiuta">
          <X className="h-3.5 w-3.5 md:h-3 md:w-3 text-destructive" />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────
interface Props {
  enterprise: Enterprise;
  activeFocusId?: string;
  onCreated?: () => void;
}

export function OkrWizard({ enterprise, activeFocusId, onCreated }: Props) {
  const { session } = useAuth();
  const {
    addFocusPeriod, addObjective, addKeyResult, addProject, addTask,
    getFocusPeriodsForEnterprise, getObjectivesForFocus,
    getKeyResultsForObjective, getProjectsForEnterprise, getTasksForEnterprise,
  } = usePrp();

  // ─── State ─────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showConvList, setShowConvList] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pendingActions, setPendingActions] = useState<WizardAction[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [createdFocusId, setCreatedFocusId] = useState<string | null>(activeFocusId || null);
  const [createdObjectiveId, setCreatedObjectiveId] = useState<string | null>(null);
  const [view, setView] = useState<WizardView>('chat');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // ─── Refs ──────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isLoadingRef = useRef(false);
  const enterpriseIdRef = useRef(enterprise.id);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const callTimerRef = useRef<ReturnType<typeof setInterval>>();
  const recognitionRef = useRef<any>(null);
  const callActiveRef = useRef(false);
  const pendingSendRef = useRef<string | null>(null);
  const hasInteractedRef = useRef(false);
  const isSpeakingRef = useRef(false);

  // ─── Derived values ────────────────────────────────────────────────
  const now = useMemo(() => new Date(), []);
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();
  const quarterLabel = `Q${currentQ} ${currentYear}`;

  const allFocusPeriods = useMemo(
    () => getFocusPeriodsForEnterprise(enterprise.id),
    [enterprise.id, getFocusPeriodsForEnterprise]
  );

  // Planning thresholds from localStorage (configurable in admin)
  const planningThresholds = useMemo(() => getThresholds(), []);

  // The active conversation's focusPeriodId (scoped to session)
  const sessionFocusId = useMemo(() => {
    const conv = conversations.find(c => c.id === activeConvId);
    return conv?.focusPeriodId || createdFocusId || null;
  }, [conversations, activeConvId, createdFocusId]);

  // Phase detection — 5 granular stages, SCOPED to this session's focus period
  const { currentPhase, completedPhases } = useMemo(() => {
    const sessionFocus = sessionFocusId ? allFocusPeriods.find(f => f.id === sessionFocusId) : null;
    const hasFocus = !!sessionFocus;
    const objectives = sessionFocus ? getObjectivesForFocus(sessionFocus.id) : [];
    const hasEnoughObjectives = objectives.length >= (planningThresholds.minObjectivesPerFocus || 1);
    const keyResults = objectives.flatMap(o => getKeyResultsForObjective(o.id));
    const hasEnoughKRs = objectives.length > 0 && objectives.every(o => {
      const krs = getKeyResultsForObjective(o.id);
      return krs.length >= (planningThresholds.minKRsPerObjective || 2);
    });

    // Only count STRATEGIC projects linked to KRs from this session's focus
    const allProjects = getProjectsForEnterprise(enterprise.id);
    const strategicProjects = allProjects.filter(p => p.type === 'strategic' && p.keyResultId && keyResults.some(kr => kr.id === p.keyResultId));

    const { minProjectsPerKR, minTasksPerProject } = planningThresholds;
    const allKRsCovered = hasEnoughKRs && keyResults.every(kr =>
      strategicProjects.filter(p => p.keyResultId === kr.id).length >= minProjectsPerKR
    );

    const allTasks = getTasksForEnterprise(enterprise.id);
    const strategicTasks = allTasks.filter(t => strategicProjects.some(p => p.id === t.projectId));
    const allProjectsCovered = allKRsCovered && strategicProjects.every(p =>
      strategicTasks.filter(t => t.projectId === p.id).length >= minTasksPerProject
    );

    const completed: WizardPhase[] = [];
    let current: WizardPhase = 'focus';

    if (hasFocus) { completed.push('focus'); current = 'objectives'; }
    if (hasEnoughObjectives) { completed.push('objectives'); current = 'key_results'; }
    if (hasEnoughKRs) { completed.push('key_results'); current = 'projects'; }
    if (allKRsCovered) { completed.push('projects'); current = 'tasks'; }
    if (allProjectsCovered) { completed.push('tasks'); }

    return { currentPhase: current, completedPhases: completed };
  }, [enterprise.id, sessionFocusId, allFocusPeriods, getObjectivesForFocus, getKeyResultsForObjective, getProjectsForEnterprise, getTasksForEnterprise, planningThresholds]);

  const activeConvMeta = useMemo(
    () => conversations.find(c => c.id === activeConvId),
    [conversations, activeConvId]
  );

  // ─── Supabase conversation helpers ─────────────────────────────────
  const fetchStoredData = useCallback(async (eid: string): Promise<StoredData | null> => {
    if (!session?.user?.id) return null;
    const { data } = await supabase
      .from('wizard_conversations')
      .select('messages')
      .eq('user_id', session.user.id)
      .eq('enterprise_id', eid)
      .maybeSingle();
    const raw = data?.messages as any;
    if (raw && !Array.isArray(raw) && raw.conversations) return raw as StoredData;
    return null;
  }, [session?.user?.id]);

  const loadMessagesForConv = useCallback(async (convId: string): Promise<Msg[]> => {
    const stored = await fetchStoredData(enterpriseIdRef.current);
    if (!stored) return [];
    const target = stored.conversations.find(c => c.id === convId);
    return target?.messages || [];
  }, [fetchStoredData]);

  const loadConversation = useCallback(async (eid: string) => {
    if (!session?.user?.id) return;
    setConversationLoaded(false);
    try {
      const { data } = await supabase
        .from('wizard_conversations')
        .select('messages')
        .eq('user_id', session.user.id)
        .eq('enterprise_id', eid)
        .maybeSingle();

      const raw = data?.messages as any;

      // Migrate from old format (plain array) to new format
      if (Array.isArray(raw)) {
        const defaultConv: ConversationMeta = {
          id: 'conv-migrated',
          title: 'Sessione iniziale',
          createdAt: new Date().toISOString(),
          status: 'active',
        };
        setConversations([defaultConv]);
        setActiveConvId(defaultConv.id);
        setMessages(raw as Msg[]);
      } else if (raw && raw.conversations) {
        const stored = raw as StoredData;
        const convMetas: ConversationMeta[] = stored.conversations.map(c => ({
          id: c.id,
          title: c.title,
          createdAt: c.createdAt,
          status: (c.status as 'active' | 'completed') || 'active',
          focusPeriodId: c.focusPeriodId,
        }));
        setConversations(convMetas);
        const activeId = stored.activeConversationId || convMetas[convMetas.length - 1]?.id || null;
        setActiveConvId(activeId);
        const activeConv = stored.conversations.find(c => c.id === activeId);
        setMessages(activeConv?.messages || []);
      } else {
        setConversations([]);
        setActiveConvId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('Error loading wizard conversation:', e);
      setConversations([]);
      setMessages([]);
    }
    setConversationLoaded(true);
  }, [session?.user?.id]);

  const saveConversation = useCallback((eid: string, convs: ConversationMeta[], activeId: string | null, msgs: Msg[]) => {
    if (!session?.user?.id) return;
    if (convs.length === 0 && msgs.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const stored = await fetchStoredData(eid);
        const existingConvs = stored?.conversations || [];

        const allConvs = convs.map(c => {
          if (c.id === activeId) return { ...c, messages: msgs };
          const prev = existingConvs.find(ec => ec.id === c.id);
          return { ...c, messages: prev?.messages || [] };
        });

        await supabase
          .from('wizard_conversations')
          .upsert({
            user_id: session.user.id!,
            enterprise_id: eid,
            messages: { conversations: allConvs, activeConversationId: activeId } as any,
          }, { onConflict: 'user_id,enterprise_id' });
      } catch (e) {
        console.error('Error saving wizard conversation:', e);
      }
    }, 1000);
  }, [session?.user?.id, fetchStoredData]);

  // ─── Session reset helper ──────────────────────────────────────────
  const resetSessionState = useCallback((focusPeriodId?: string | null) => {
    setPendingActions([]);
    setEditingTitle(false);
    setCreatedFocusId(focusPeriodId || null);
    setCreatedObjectiveId(null);
    setShowConvList(false);
  }, []);

  // ─── Lifecycle effects ─────────────────────────────────────────────
  // Persist messages whenever they change
  useEffect(() => {
    if (conversationLoaded && (messages.length > 0 || conversations.length > 0)) {
      saveConversation(enterpriseIdRef.current, conversations, activeConvId, messages);
    }
  }, [messages, conversationLoaded, saveConversation, conversations, activeConvId]);

  // Load on mount and when enterprise changes
  useEffect(() => {
    enterpriseIdRef.current = enterprise.id;
    setInput('');
    resetSessionState(activeFocusId);
    loadConversation(enterprise.id);
  }, [enterprise.id, loadConversation, activeFocusId, resetSessionState]);

  // Sync createdFocusId and createdObjectiveId from session's focus period
  useEffect(() => {
    if (sessionFocusId) {
      if (!createdFocusId || createdFocusId !== sessionFocusId) setCreatedFocusId(sessionFocusId);
      const objs = getObjectivesForFocus(sessionFocusId);
      if (objs.length > 0) setCreatedObjectiveId(objs[objs.length - 1].id);
    }
  }, [sessionFocusId, getObjectivesForFocus]);

  useEffect(() => { callActiveRef.current = callActive; }, [callActive]);

  useEffect(() => {
    if (hasInteractedRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
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

  // ─── Conversation management ───────────────────────────────────────
  const switchConversation = useCallback(async (convId: string) => {
    if (convId === activeConvId) { setShowConvList(false); return; }
    // Save current first
    if (activeConvId && conversationLoaded) {
      saveConversation(enterpriseIdRef.current, conversations, activeConvId, messages);
    }
    const loadedMsgs = await loadMessagesForConv(convId);
    setMessages(loadedMsgs);
    setActiveConvId(convId);
    const targetConv = conversations.find(c => c.id === convId);
    resetSessionState(targetConv?.focusPeriodId);
  }, [activeConvId, conversationLoaded, conversations, messages, saveConversation, loadMessagesForConv, resetSessionState]);

  const deleteConversation = useCallback(async (convId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = conversations.filter(c => c.id !== convId);
    setConversations(updated);

    if (convId === activeConvId) {
      if (updated.length > 0) {
        const lastConv = updated[updated.length - 1];
        setActiveConvId(lastConv.id);
        resetSessionState(lastConv.focusPeriodId);
        const loadedMsgs = await loadMessagesForConv(lastConv.id);
        setMessages(loadedMsgs);
      } else {
        setActiveConvId(null);
        setMessages([]);
        resetSessionState();
        if (session?.user?.id) {
          await supabase.from('wizard_conversations').delete()
            .eq('user_id', session.user.id)
            .eq('enterprise_id', enterpriseIdRef.current);
        }
      }
    }

    // Persist updated list
    if (updated.length > 0 && session?.user?.id) {
      const stored = await fetchStoredData(enterpriseIdRef.current);
      const existingConvs = stored?.conversations || [];
      const newStored: StoredData = {
        conversations: existingConvs.filter(c => c.id !== convId),
        activeConversationId: convId === activeConvId ? updated[updated.length - 1].id : activeConvId,
      };
      await supabase.from('wizard_conversations').upsert({
        user_id: session.user.id,
        enterprise_id: enterpriseIdRef.current,
        messages: newStored as any,
      }, { onConflict: 'user_id,enterprise_id' });
    }

    toast.success('Sessione eliminata');
  }, [activeConvId, conversations, session?.user?.id, loadMessagesForConv, resetSessionState, fetchStoredData]);

  const renameConversation = useCallback((convId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const updated = conversations.map(c => c.id === convId ? { ...c, title: trimmed } : c);
    setConversations(updated);
    setEditingTitle(false);
    saveConversation(enterpriseIdRef.current, updated, activeConvId, messages);
    toast.success('Titolo aggiornato');
  }, [conversations, activeConvId, messages, saveConversation]);

  const createNewConversation = useCallback(() => {
    const newId = `conv-${Date.now()}`;
    const nowDate = new Date();
    const q = Math.ceil((nowDate.getMonth() + 1) / 3);
    const title = `Sessione Q${q} ${nowDate.getFullYear()} — ${nowDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
    const newConv: ConversationMeta = {
      id: newId,
      title,
      createdAt: nowDate.toISOString(),
      status: 'active',
    };
    if (activeConvId && messages.length > 0) {
      saveConversation(enterpriseIdRef.current, conversations, activeConvId, messages);
    }
    setConversations(prev => [...prev, newConv]);
    setActiveConvId(newId);
    setMessages([]);
    resetSessionState();
  }, [activeConvId, conversations, messages, saveConversation, resetSessionState]);

  // ─── Voice / Call ──────────────────────────────────────────────────
  const stripMarkdown = (text: string) =>
    text.replace(/[*_~`#>[\]()!|]/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim();

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
      const currentText = finalTranscript + interim;
      setInput(currentText);

      if (isSpeakingRef.current && currentText.trim().length > 2) {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        isSpeakingRef.current = false;
        setCallState('listening');
      }

      if (finalTranscript.trim()) {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          if (callActiveRef.current && finalTranscript.trim()) {
            pendingSendRef.current = finalTranscript.trim();
            try { r.stop(); } catch {}
          }
        }, 700);
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
      if (callActiveRef.current) setTimeout(() => { if (callActiveRef.current) startContinuousListening(); }, 200);
    };

    r.onerror = (e: any) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (e.error === 'no-speech' || e.error === 'aborted') {
        if (callActiveRef.current) setTimeout(() => { if (callActiveRef.current) startContinuousListening(); }, 300);
        return;
      }
      console.error('Speech error:', e.error);
      if (callActiveRef.current) setTimeout(() => { if (callActiveRef.current) startContinuousListening(); }, 500);
    };

    recognitionRef.current = r;
    try { r.start(); if (!isSpeakingRef.current) setCallState('listening'); } catch {
      setTimeout(() => { if (callActiveRef.current) startContinuousListening(); }, 500);
    }
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (!text) return;
    const clean = stripMarkdown(text);
    if (clean.length < 3) return;
    try {
      isSpeakingRef.current = true;
      setCallState('speaking');
      startContinuousListening();

      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) throw new Error('TTS failed');
      if (!isSpeakingRef.current) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      const audio = new Audio(url);
      audioRef.current = audio;

      const onFinish = () => {
        URL.revokeObjectURL(url);
        isSpeakingRef.current = false;
        if (callActiveRef.current) { setInput(''); setCallState('listening'); }
        else setCallState('idle');
      };
      audio.onended = onFinish;
      audio.onerror = onFinish;
      await audio.play();
    } catch (err) {
      console.error('[Voice TTS] Error:', err);
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

  const startCall = useCallback(async () => {
    setCallState('connecting');
    setCallActive(true);
    callActiveRef.current = true;
    isSpeakingRef.current = false;
    setView('call');
    setCallDuration(0);
    setInput('');
    callTimerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setTimeout(() => startContinuousListening(), 500);
    } catch {
      toast.error('Permesso microfono necessario per la chiamata');
      endCall();
    }
  }, [startContinuousListening]);

  const endCall = useCallback(() => {
    callActiveRef.current = false;
    isSpeakingRef.current = false;
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

  // ─── Context builder ───────────────────────────────────────────────
  const buildContext = () => {
    const projects = getProjectsForEnterprise(enterprise.id);
    const tasks = getTasksForEnterprise(enterprise.id);
    const sessionFocus = sessionFocusId ? allFocusPeriods.find(f => f.id === sessionFocusId) : allFocusPeriods.find(f => f.status === 'active');
    const objectives = sessionFocus ? getObjectivesForFocus(sessionFocus.id) : [];
    const qStart = new Date(currentYear, (currentQ - 1) * 3, 1);
    const qEnd = new Date(currentYear, currentQ * 3, 0);

    return {
      enterprise: {
        name: enterprise.name, description: enterprise.description, status: enterprise.status,
        businessCategory: enterprise.businessCategory, phase: enterprise.phase, timeHorizon: enterprise.timeHorizon,
        strategicImportance: enterprise.strategicImportance, growthPotential: enterprise.growthPotential, enterpriseType: enterprise.enterpriseType,
      },
      currentDate: new Date().toISOString().split('T')[0],
      currentQuarter: quarterLabel,
      quarterStartDate: qStart.toISOString().split('T')[0],
      quarterEndDate: qEnd.toISOString().split('T')[0],
      focusPeriods: allFocusPeriods.map(f => ({ name: f.name, status: f.status, startDate: f.startDate, endDate: f.endDate })),
      activeFocus: sessionFocus ? { name: sessionFocus.name, id: sessionFocus.id, startDate: sessionFocus.startDate, endDate: sessionFocus.endDate } : null,
      objectives: objectives.map(o => ({
        id: o.id, title: o.title, status: o.status, description: o.description, weight: o.weight,
        keyResults: getKeyResultsForObjective(o.id).map(kr => ({
          id: kr.id, title: kr.title, targetValue: kr.targetValue, currentValue: kr.currentValue,
          metricType: kr.metricType, status: kr.status, deadline: kr.deadline,
          progress: kr.targetValue > 0 ? Math.round((kr.currentValue / kr.targetValue) * 100) : 0,
        })),
      })),
      projects: projects.map(p => {
        const projectTasks = tasks.filter(t => t.projectId === p.id);
        return {
          id: p.id, name: p.name, type: p.type, isStrategicLever: p.isStrategicLever,
          keyResultId: p.keyResultId,
          tasksCount: projectTasks.length,
          tasksDone: projectTasks.filter(t => t.status === 'done').length,
          tasksScheduled: projectTasks.filter(t => t.status === 'scheduled').length,
          existingTaskTitles: projectTasks.map(t => t.title),
        };
      }),
      totalTasks: tasks.length,
      tasksByStatus: {
        backlog: tasks.filter(t => t.status === 'backlog').length,
        scheduled: tasks.filter(t => t.status === 'scheduled').length,
        done: tasks.filter(t => t.status === 'done').length,
      },
      hasFocusPeriodCreated: !!createdFocusId,
      hasObjectiveCreated: !!createdObjectiveId,
      futureFocusPeriods: allFocusPeriods.filter(f => f.status === 'future').map(f => ({ name: f.name, startDate: f.startDate, endDate: f.endDate })),
      currentWizardPhase: currentPhase,
      completedWizardPhases: completedPhases,
      planningLimits: {
        maxFocusPerEnterprise: planningThresholds.maxFocusPerEnterprise,
        minObjectivesPerFocus: planningThresholds.minObjectivesPerFocus,
        maxObjectivesPerFocus: planningThresholds.maxObjectivesPerFocus,
        minKRsPerObjective: planningThresholds.minKRsPerObjective,
        maxKRsPerObjective: planningThresholds.maxKRsPerObjective,
        minProjectsPerKR: planningThresholds.minProjectsPerKR,
        maxProjectsPerKR: planningThresholds.maxProjectsPerKR,
        minTasksPerProject: planningThresholds.minTasksPerProject,
        maxTasksPerProject: planningThresholds.maxTasksPerProject,
        maxTasksPerDay: planningThresholds.maxTasksPerDay,
        warnProjectsPerFocus: planningThresholds.warnProjectsPerFocus,
        warnTasksPerFocus: planningThresholds.warnTasksPerFocus,
      },
    };
  };

  // ─── Batch completion logic (shared) ───────────────────────────────
  const checkBatchCompletion = useCallback((updatedActions: WizardAction[], targetMessageIndex: number) => {
    const siblings = updatedActions.filter(a => a.afterMessageIndex === targetMessageIndex);
    const allResolved = siblings.every(a => a.applied || a.rejected);
    if (!allResolved) return;

    const approvedLabels = siblings.filter(a => a.applied).map(a => getEntityLabel(a));
    const rejectedLabels = siblings.filter(a => a.rejected).map(a => a.data.title || a.data.name || a.type);

    // Build phase-aware continuation message
    let continuationMsg = '';
    if (approvedLabels.length > 0) continuationMsg += `[Confermati: ${approvedLabels.join(', ')}.]`;
    if (rejectedLabels.length > 0) continuationMsg += ` [Rifiutati: ${rejectedLabels.join(', ')}.]`;

    // Add explicit phase status so AI knows exactly what's done
    const phaseLabels: Record<WizardPhase, string> = {
      focus: 'Focus Period',
      objectives: 'Obiettivi',
      key_results: 'Key Results',
      projects: 'Progetti',
      tasks: 'Task',
    };
    const donePhases = completedPhases.map(p => phaseLabels[p]).join(', ');
    const nextPhase = phaseLabels[currentPhase];
    continuationMsg += ` [FASI GIÀ COMPLETATE: ${donePhases || 'nessuna'}. FASE CORRENTE DA COMPLETARE: ${nextPhase}. NON riproporre entità per fasi già completate — proponi SOLO entità per la fase corrente "${nextPhase}" o successive.]`;

    const waitAndSend = () => {
      const checkInterval = setInterval(() => {
        if (!isLoadingRef.current) {
          clearInterval(checkInterval);
          doSend(continuationMsg.trim(), false);
        }
      }, 300);
      setTimeout(() => clearInterval(checkInterval), 10000);
    };
    waitAndSend();
  }, [completedPhases, currentPhase]);

  // ─── KR resolution helper ─────────────────────────────────────────
  const resolveKeyResultId = useCallback((rawId: string | undefined): string | undefined => {
    if (!rawId) return undefined;
    const targetFocuses = sessionFocusId
      ? allFocusPeriods.filter(f => f.id === sessionFocusId)
      : allFocusPeriods;
    const allObjectives = targetFocuses.flatMap(f => getObjectivesForFocus(f.id));
    const allKRs = allObjectives.flatMap(o => getKeyResultsForObjective(o.id));

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(rawId);
    if (!isUUID) {
      const match = allKRs.find(kr => kr.title.toLowerCase().includes(rawId.toLowerCase()));
      return match?.id || allKRs[allKRs.length - 1]?.id;
    }
    if (!allKRs.find(kr => kr.id === rawId)) {
      return allKRs[allKRs.length - 1]?.id;
    }
    return rawId;
  }, [sessionFocusId, allFocusPeriods, getObjectivesForFocus, getKeyResultsForObjective]);

  // ─── Core send ─────────────────────────────────────────────────────
  const doSend = async (text: string, isVoiceCall: boolean) => {
    if (!text || isLoading) return;
    hasInteractedRef.current = true;
    const userMsg: Msg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    isLoadingRef.current = true;
    if (inputRef.current) inputRef.current.style.height = 'auto';
    let assistantContent = '';

    try {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ type: 'okr_wizard', messages: newMessages, context: buildContext() }),
        signal: abortController.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Errore ${resp.status}`);
      }
      if (!resp.body) throw new Error('No body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;
      let streamReceivedActions = false;
      const msgIdx = newMessages.length; // assistant message index

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const processLine = (line: string) => {
        if (!line.startsWith('data: ')) return false;
        const json = line.slice(6).trim();
        if (json === '[DONE]') return true;
        try {
          const p = JSON.parse(json);
          if (p.type === 'delta' && p.content) {
            assistantContent += p.content;
            const snap = assistantContent;
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === 'assistant' ? { ...m, content: snap } : m));
          }
          if (p.type === 'actions' && p.actions?.length) {
            streamReceivedActions = true;
            const acts: WizardAction[] = p.actions.map((a: any, ai: number) => ({
              ...a, id: `${Date.now()}-${ai}`, applied: false, rejected: false, afterMessageIndex: msgIdx,
            }));
            setPendingActions(pa => [...pa, ...acts]);
          }
        } catch {
          return false; // incomplete JSON, put back in buffer
        }
        return false;
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (processLine(line)) { streamDone = true; break; }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          processLine(raw);
        }
      }

      if (!assistantContent) {
        if (streamReceivedActions) {
          setMessages(prev => prev.map((m, i) =>
            i === prev.length - 1 && m.role === 'assistant' && !m.content
              ? { ...m, content: '📋 Ecco le proposte:' }
              : m
          ));
        } else {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev;
          });
        }
        if (isVoiceCall && callActiveRef.current) setTimeout(() => startContinuousListening(), 500);
      } else {
        const mentionsCreation = GHOST_CREATION_REGEX.test(assistantContent);
        if (mentionsCreation && !streamReceivedActions && !isVoiceCall) {
          console.warn('[Wizard] AI described creation without tool calls — auto-retrying');
          setTimeout(() => {
            if (!isLoadingRef.current) {
              doSend('[ERRORE SISTEMA] Hai descritto la creazione di entità nel testo ma NON hai emesso i tool call. Il testo da solo NON crea nulla. DEVI emettere i tool call (create_project, create_task, etc.) per ogni entità. Riprova ORA emettendo SOLO i tool call corretti, senza riscrivere le descrizioni nel testo.', false);
            }
          }, 500);
        } else if (isVoiceCall) {
          speakText(assistantContent);
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('[Wizard] Response aborted by user');
      } else {
        console.error(e);
        toast.error(e?.message || 'Errore AI');
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev;
        });
      }
      if (isVoiceCall && callActiveRef.current) setTimeout(() => startContinuousListening(), 1000);
    }
    abortControllerRef.current = null;
    setIsLoading(false);
    isLoadingRef.current = false;
  };

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    await doSend(text, false);
  };

  const handleSendVoice = async (text: string) => {
    if (!text) return;
    await doSend(text, true);
  };

  // ─── Action apply / reject ─────────────────────────────────────────
  const applyAction = async (action: WizardAction) => {
    setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, applied: true } : a));

    try {
      if (action.type === 'create_focus_period') {
        addFocusPeriod({ enterpriseId: enterprise.id, name: action.data.name, startDate: action.data.start_date, endDate: action.data.end_date, status: action.data.status || 'active' });
        toast.success(`Focus Period "${action.data.name}" creato`);
        setTimeout(() => {
          const fps = getFocusPeriodsForEnterprise(enterprise.id);
          const newFocus = fps.find(f => f.name === action.data.name && f.enterpriseId === enterprise.id);
          if (newFocus && activeConvId) {
            setCreatedFocusId(newFocus.id);
            setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, focusPeriodId: newFocus.id } : c));
          }
        }, 1500);
      } else if (action.type === 'create_objective') {
        let targetFocusId = action.data.focus_period_id || sessionFocusId || createdFocusId;
        if (targetFocusId && !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(targetFocusId)) {
          targetFocusId = sessionFocusId || createdFocusId;
        }
        if (!targetFocusId) {
          toast.error('Crea prima un Focus Period attivo');
          setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, applied: false } : a));
          return;
        }
        addObjective({ focusPeriodId: targetFocusId, enterpriseId: enterprise.id, title: action.data.title, description: action.data.description, weight: 1, status: 'active' });
        toast.success(`Objective "${action.data.title}" creato`);
      } else if (action.type === 'create_key_result') {
        let targetObjId = action.data.objective_id;
        if (targetObjId && !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(targetObjId)) targetObjId = undefined;
        if (!targetObjId) {
          const sessionFocus = sessionFocusId ? allFocusPeriods.find(f => f.id === sessionFocusId) : null;
          const objectives = sessionFocus ? getObjectivesForFocus(sessionFocus.id) : [];
          targetObjId = createdObjectiveId || objectives[objectives.length - 1]?.id;
        }
        if (!targetObjId) {
          toast.error('Crea prima un Objective');
          setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, applied: false } : a));
          return;
        }
        addKeyResult({ objectiveId: targetObjId, enterpriseId: enterprise.id, title: action.data.title, targetValue: action.data.target_value, currentValue: 0, metricType: action.data.metric_type || 'percentage', deadline: action.data.deadline, status: 'active' });
        toast.success(`Key Result "${action.data.title}" creato`);
      } else if (action.type === 'create_project') {
        let keyResultId = resolveKeyResultId(action.data.key_result_id);
        const projectType = action.data.type || 'strategic';
        // Auto-assign latest KR for strategic projects without one
        if (projectType === 'strategic' && !keyResultId) {
          keyResultId = resolveKeyResultId('__fallback__');
          // If still nothing, try without filter
          if (!keyResultId) {
            const targetFocuses = sessionFocusId
              ? allFocusPeriods.filter(f => f.id === sessionFocusId)
              : allFocusPeriods.filter(f => f.status === 'active');
            const allKRs = targetFocuses.flatMap(f => getObjectivesForFocus(f.id)).flatMap(o => getKeyResultsForObjective(o.id));
            keyResultId = allKRs[allKRs.length - 1]?.id;
          }
        }
        try {
          addProject({ enterpriseId: enterprise.id, name: action.data.name, type: projectType, keyResultId, isStrategicLever: projectType === 'strategic' && !!keyResultId });
          toast.success(`Progetto "${action.data.name}" creato`);
        } catch (projErr) {
          console.error('[Wizard] Project creation error:', projErr);
          toast.error(`Errore creazione progetto: ${projErr}`);
          setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, applied: false } : a));
          return;
        }
      } else if (action.type === 'create_task') {
        const projects = getProjectsForEnterprise(enterprise.id);
        let targetProjectId = action.data.project_id;
        if (targetProjectId) {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(targetProjectId);
          if (!isUUID) {
            const match = projects.find(p => p.name.toLowerCase().includes(targetProjectId.toLowerCase()));
            targetProjectId = match?.id;
          } else if (!projects.find(p => p.id === targetProjectId)) {
            targetProjectId = undefined;
          }
        }
        if (!targetProjectId) {
          if (sessionFocusId) {
            const sessionKRIds = getObjectivesForFocus(sessionFocusId).flatMap(o => getKeyResultsForObjective(o.id)).map(kr => kr.id);
            const strategicProject = projects.filter(p => p.type === 'strategic' && p.keyResultId && sessionKRIds.includes(p.keyResultId)).pop();
            targetProjectId = strategicProject?.id;
          }
          if (!targetProjectId) targetProjectId = projects[projects.length - 1]?.id;
        }
        if (!targetProjectId) {
          toast.error('Crea prima un Progetto');
          setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, applied: false } : a));
          return;
        }
        try {
          addTask({
            enterpriseId: enterprise.id, projectId: targetProjectId, title: action.data.title,
            description: action.data.description, estimatedMinutes: action.data.estimated_minutes || 30,
            priority: action.data.priority || 'medium',
            impact: action.data.impact, effort: action.data.effort, isRecurring: false,
          });
          toast.success(`Task "${action.data.title}" creata`);
        } catch (taskErr) {
          console.error('[Wizard] Task creation error:', taskErr);
          toast.error(`Errore creazione task: ${taskErr}`);
          setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, applied: false } : a));
          return;
        }
      }
      onCreated?.();

      // Check batch completion
      setPendingActions(prev => {
        const updated = prev.map(a => a.id === action.id ? { ...a, applied: true } : a);
        checkBatchCompletion(updated, action.afterMessageIndex);
        return updated;
      });
    } catch (e) {
      console.error('Error applying action:', e);
      toast.error("Errore nell'applicare l'azione");
      setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, applied: false } : a));
    }
  };

  const rejectAction = (action: WizardAction) => {
    setPendingActions(prev => {
      const updated = prev.map(a => a.id === action.id ? { ...a, rejected: true } : a);
      checkBatchCompletion(updated, action.afterMessageIndex);
      return updated;
    });
  };

  // ─── Input handlers ────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
  };

  // ─── Opening message ───────────────────────────────────────────────
  const getOpeningMessage = (): string => {
    const stageLabel = PLANNING_STAGES.find(p => p.key === currentPhase)?.label || 'Focus';
    if (currentPhase === 'projects' || currentPhase === 'tasks') {
      return `🚀 **Fase: ${stageLabel}** — Focus e strategia definiti per **${enterprise.name}**.\n\nOra creiamo i progetti e le task concrete per muovere i KR. Da quale Objective vuoi partire?`;
    }
    if (currentPhase === 'objectives' || currentPhase === 'key_results') {
      const focus = sessionFocusId ? allFocusPeriods.find(f => f.id === sessionFocusId) : null;
      if (!focus) return `🎯 **Fase: Focus** — Iniziamo la pianificazione strategica di **${enterprise.name}**.\n\n📅 Il trimestre corrente è **${quarterLabel}**. Lavoriamo su questo o preferisci pianificare il prossimo?`;
      const objs = getObjectivesForFocus(focus.id);
      if (objs.length === 0) return `🧭 **Fase: Obiettivi** — Focus attivo: **${focus.name}**.\n\nDefiniamo gli Objective. Qual è la cosa **più importante** che ${enterprise.name} deve raggiungere questo trimestre?`;
      const lastObj = objs[objs.length - 1];
      const krs = getKeyResultsForObjective(lastObj.id);
      if (krs.length < 2) return `📊 **Fase: Key Results** — Objective: **"${lastObj.title}"**.\n\nDefiniamo i Key Results. Qual è il **numero chiave** che ti dice se hai raggiunto questo obiettivo?`;
      return `📊 **Fase: ${stageLabel}** — ${objs.length} Objective con ${krs.length} KR definiti.\n\nVuoi aggiungere altro o passare ai Progetti?`;
    }
    return `🎯 **Fase: Focus** — Iniziamo la pianificazione strategica di **${enterprise.name}**.\n\n📅 Il trimestre corrente è **${quarterLabel}**. Lavoriamo su questo o preferisci pianificare il prossimo?`;
  };

  // ─── Closed state ──────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          if (conversations.length === 0) {
            const newId = `conv-${Date.now()}`;
            const newConv: ConversationMeta = {
              id: newId,
              title: `Sessione Q${currentQ} ${currentYear}`,
              createdAt: new Date().toISOString(),
              status: 'active',
            };
            setConversations([newConv]);
            setActiveConvId(newId);
          }
          if (messages.length === 0) setMessages([{ role: 'assistant', content: getOpeningMessage() }]);
        }}
        className="w-full group flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.04] to-primary/[0.08] hover:from-primary/[0.08] hover:to-primary/[0.14] transition-all duration-200 px-4 py-3"
      >
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Radar Strategy</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {conversations.length > 0 ? `${conversations.length} sessioni · ` : ''}Pianifica Focus, OKR e strategia
          </p>
        </div>
        <Send className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </button>
    );
  }

  // ─── Call view ─────────────────────────────────────────────────────
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

          <div className="text-xs font-mono text-muted-foreground mb-4 z-10">{formatDuration(callDuration)}</div>

          <motion.div
            className={`h-20 w-20 rounded-full flex items-center justify-center z-10 mb-4 ${
              callState === 'listening' ? 'bg-primary/20' : callState === 'speaking' ? 'bg-accent' : 'bg-muted'
            }`}
            animate={callState === 'listening' ? { scale: [1, 1.08, 1] } : callState === 'speaking' ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Sparkles className={`h-8 w-8 ${callState === 'listening' ? 'text-primary' : 'text-muted-foreground'}`} />
          </motion.div>

          <motion.p
            className="text-sm font-medium text-foreground mb-1 z-10"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {callStateLabel}
          </motion.p>

          {input && (
            <p className="text-xs text-muted-foreground text-center max-w-[200px] truncate z-10 mb-2">"{input}"</p>
          )}

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
          <div className="flex items-center gap-1.5 z-10 mb-4 flex-wrap justify-center">
            {PLANNING_STAGES.map((stage) => {
              const isCompleted = completedPhases.includes(stage.key);
              const isCurrent = stage.key === currentPhase;
              return (
                <div key={stage.key} className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
                  isCompleted ? 'bg-primary/20 text-primary' : isCurrent ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'bg-muted/50 text-muted-foreground'
                }`}>
                  {isCompleted ? '✓ ' : ''}{stage.shortLabel}
                </div>
              );
            })}
          </div>

          <button
            onClick={endCall}
            className="h-12 w-12 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors z-10"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </motion.div>

        {/* Pending actions in call view */}
        {pendingActions.filter(a => !a.applied && !a.rejected).length > 0 && (
          <div className="border-t border-border/50 p-3 space-y-2">
            {pendingActions.filter(a => !a.applied && !a.rejected).map((action) => (
              <div key={action.id} className="flex justify-center">
                <ActionCard action={action} onApply={() => applyAction(action)} onReject={() => rejectAction(action)} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Chat view ─────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-primary/20 overflow-hidden bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2.5 bg-gradient-to-r from-primary/[0.06] to-primary/[0.03] border-b border-primary/10">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground">Radar Strategy</span>
              {conversations.length > 1 && (
                <button
                  onClick={() => setShowConvList(!showConvList)}
                  className="text-[9px] text-muted-foreground bg-muted/60 hover:bg-muted px-1.5 py-0.5 rounded-md transition-colors flex items-center gap-0.5"
                >
                  <Clock className="h-2.5 w-2.5" />
                  {conversations.length}
                </button>
              )}
            </div>
            {activeConvMeta && (
              editingTitle ? (
                <form onSubmit={(e) => { e.preventDefault(); renameConversation(activeConvMeta.id, editTitleValue); }} className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editTitleValue}
                    onChange={e => setEditTitleValue(e.target.value)}
                    onBlur={() => renameConversation(activeConvMeta.id, editTitleValue)}
                    onKeyDown={e => e.key === 'Escape' && setEditingTitle(false)}
                    className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 outline-none ring-1 ring-primary/30 w-full max-w-[180px]"
                  />
                </form>
              ) : (
                <button
                  onClick={() => { setEditTitleValue(activeConvMeta.title); setEditingTitle(true); }}
                  className="text-[10px] text-muted-foreground truncate hover:text-foreground transition-colors flex items-center gap-1 group"
                  title="Clicca per modificare il titolo"
                >
                  {activeConvMeta.title}
                  <Pencil className="h-2 w-2 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
              )
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={createNewConversation}
            className="h-6 w-6 rounded-md hover:bg-primary/10 flex items-center justify-center transition-colors text-muted-foreground hover:text-primary"
            title="Nuova sessione strategica"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => activeConvId && deleteConversation(activeConvId)}
              className="h-6 w-6 rounded-md hover:bg-destructive/10 flex items-center justify-center transition-colors text-muted-foreground hover:text-destructive"
              title="Elimina sessione"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
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

      {/* Conversation list dropdown */}
      <AnimatePresence>
        {showConvList && conversations.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border/30 overflow-hidden"
          >
            <div className="p-2 space-y-1 bg-muted/20 max-h-40 overflow-y-auto">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors text-xs ${
                    conv.id === activeConvId
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/60 text-foreground'
                  }`}
                >
                  <button
                    onClick={() => switchConversation(conv.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{conv.title}</span>
                      <span className="text-[9px] text-muted-foreground shrink-0 ml-2">
                        {new Date(conv.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newTitle = prompt('Nuovo titolo:', conv.title);
                      if (newTitle?.trim()) renameConversation(conv.id, newTitle);
                    }}
                    className="h-5 w-5 rounded flex items-center justify-center shrink-0 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    title="Rinomina sessione"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="h-5 w-5 rounded flex items-center justify-center shrink-0 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Elimina sessione"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Planning Progress Bar */}
      <PlanningProgressBar currentPhase={currentPhase} completedPhases={completedPhases} />

      {/* Messages area with inline actions */}
      <div ref={scrollRef} className="max-h-[60vh] md:max-h-[28rem] overflow-y-auto p-3 md:p-4 space-y-3 overscroll-contain">
        {messages.map((msg, i) => {
          const actionsAfterThis = pendingActions.filter(a => a.afterMessageIndex === i);
          return (
            <div key={i}>
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] md:max-w-[75%] rounded-2xl px-3.5 py-2.5 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted/70 text-foreground rounded-bl-md'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[13px] leading-relaxed">
                      <ReactMarkdown>{msg.content.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').replace(/<\/?tool_call>/g, '').trim()}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>
                  )}
                </div>
              </div>

              {actionsAfterThis.map((action) => (
                <div key={action.id} className="flex justify-center py-1.5">
                  <ActionCard action={action} onApply={() => applyAction(action)} onReject={() => rejectAction(action)} />
                </div>
              ))}
            </div>
          );
        })}

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
          <button
            onClick={startCall}
            disabled={isLoading}
            className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-all hover:bg-primary/10 text-muted-foreground hover:text-primary"
            title="Chiama Radar"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
          {isLoading ? (
            <Button size="icon" onClick={handleStop} variant="destructive" className="shrink-0 h-7 w-7 rounded-lg" title="Ferma risposta">
              <Square className="h-3 w-3" />
            </Button>
          ) : (
            <Button size="icon" onClick={handleSend} disabled={!input.trim()} className="shrink-0 h-7 w-7 rounded-lg">
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
