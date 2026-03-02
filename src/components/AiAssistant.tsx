import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Sparkles, Trash2, Mic, MicOff, Volume2, VolumeX, Loader2, Check, Building2, FolderKanban, ListTodo, Calendar, Target, BarChart3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';

type Msg = { role: 'user' | 'assistant'; content: string };
type GlobalAction = {
  type: string;
  data: any;
  applied?: boolean;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

export function AiAssistant() {
  const { session } = useAuth();
  const {
    enterprises, projects, tasks, appointments, focusPeriods, objectives, keyResults,
    addEnterprise, addProject, addTask, addFocusPeriod, addObjective, addKeyResult,
    addAppointment, scheduleTask, completeTask,
    getProjectsForEnterprise, getTasksForEnterprise, getFocusPeriodsForEnterprise,
    getObjectivesForFocus, getKeyResultsForObjective,
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

  // Voice
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingActions]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  const stripMarkdown = (text: string) =>
    text.replace(/[*_~`#>[\]()!|]/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim();

  const speakText = useCallback(async (text: string) => {
    if (!voiceEnabled || !text) return;
    const cleanText = stripMarkdown(text);
    if (cleanText.length < 3) return;
    try {
      setIsSpeaking(true);
      const response = await fetch(TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text: cleanText }),
      });
      if (!response.ok) throw new Error('TTS failed');
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); };
      await audio.play();
    } catch (e) { console.error('TTS error:', e); setIsSpeaking(false); }
  }, [voiceEnabled, session]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; setIsSpeaking(false); }
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Browser non supporta riconoscimento vocale'); return; }
    const recognition = new SR();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => { console.error('STT error:', event.error); setIsListening(false); };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    if (!voiceEnabled) setVoiceEnabled(true);
  }, [voiceEnabled]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); }
  }, []);

  // Build full context for AI
  const buildContext = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentQ = Math.ceil((now.getMonth() + 1) / 3);

    // Detect current section from route
    const path = location.pathname;
    let currentSection = 'dashboard';
    let currentEnterpriseId: string | null = null;
    if (path.startsWith('/enterprise/')) {
      currentSection = 'enterprise_detail';
      currentEnterpriseId = path.split('/enterprise/')[1];
    } else if (path === '/enterprises') currentSection = 'enterprises';
    else if (path === '/calendar') currentSection = 'calendar';
    else if (path === '/settings') currentSection = 'settings';

    return {
      currentSection,
      currentEnterpriseId,
      currentDate: today,
      currentQuarter: `Q${currentQ} ${now.getFullYear()}`,
      enterprises: enterprises.map(e => ({
        id: e.id, name: e.name, status: e.status, phase: e.phase,
        businessCategory: e.businessCategory, color: e.color,
      })),
      projects: projects.map(p => ({
        id: p.id, name: p.name, type: p.type, enterpriseId: p.enterpriseId,
        isStrategicLever: p.isStrategicLever, keyResultId: p.keyResultId,
      })),
      tasks: tasks.filter(t => t.status !== 'done').map(t => ({
        id: t.id, title: t.title, priority: t.priority, status: t.status,
        estimatedMinutes: t.estimatedMinutes, deadline: t.deadline,
        scheduledDate: t.scheduledDate, scheduledTime: t.scheduledTime,
        projectId: t.projectId, enterpriseId: t.enterpriseId,
      })),
      todayTasks: tasks.filter(t => t.scheduledDate === today && t.status !== 'done').map(t => ({
        id: t.id, title: t.title, priority: t.priority, scheduledTime: t.scheduledTime,
      })),
      upcomingDeadlines: tasks.filter(t => t.deadline && t.status !== 'done' && t.deadline <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]).map(t => ({
        id: t.id, title: t.title, deadline: t.deadline, priority: t.priority,
      })),
      focusPeriods: focusPeriods.map(f => ({
        id: f.id, name: f.name, status: f.status, startDate: f.startDate,
        endDate: f.endDate, enterpriseId: f.enterpriseId,
      })),
      objectives: objectives.map(o => ({
        id: o.id, title: o.title, status: o.status,
        focusPeriodId: o.focusPeriodId, enterpriseId: o.enterpriseId,
      })),
      keyResults: keyResults.map(kr => ({
        id: kr.id, title: kr.title, targetValue: kr.targetValue,
        currentValue: kr.currentValue, metricType: kr.metricType,
        objectiveId: kr.objectiveId, enterpriseId: kr.enterpriseId,
      })),
      appointmentsToday: appointments.filter(a => a.date === today).map(a => ({
        title: a.title, startTime: a.startTime, endTime: a.endTime,
      })),
      backlogCount: tasks.filter(t => t.status === 'backlog').length,
      doneTodayCount: tasks.filter(t => t.status === 'done' && t.completedAt?.startsWith(today)).length,
    };
  };

  // Apply actions from AI
  const applyAction = async (action: GlobalAction) => {
    try {
      switch (action.type) {
        case 'create_enterprise':
          addEnterprise({
            name: action.data.name,
            status: action.data.status || 'active',
            color: '#6366f1',
            strategicImportance: 3, growthPotential: 3,
            phase: action.data.phase || 'setup',
            businessCategory: action.data.business_category || 'scale_opportunity',
            timeHorizon: 'medium', priorityUntil: null,
          });
          toast.success(`Impresa "${action.data.name}" creata`);
          break;
        case 'create_project':
          addProject({
            name: action.data.name,
            enterpriseId: action.data.enterprise_id,
            type: action.data.type || 'operational',
            isStrategicLever: action.data.type === 'strategic',
            keyResultId: null,
          });
          toast.success(`Progetto "${action.data.name}" creato`);
          break;
        case 'create_task':
          addTask({
            title: action.data.title,
            projectId: action.data.project_id,
            enterpriseId: action.data.enterprise_id,
            priority: action.data.priority || 'medium',
            estimatedMinutes: action.data.estimated_minutes || 30,
            deadline: action.data.deadline || null,
            scheduledDate: null, scheduledTime: null,
            isRecurring: false, recurringFrequency: null,
            impact: null, effort: null, completedAt: null,
          });
          toast.success(`Task "${action.data.title}" creata`);
          break;
        case 'create_focus_period':
          addFocusPeriod({
            enterpriseId: action.data.enterprise_id,
            name: action.data.name,
            startDate: action.data.start_date,
            endDate: action.data.end_date,
            status: action.data.status || 'active',
          });
          toast.success(`Focus Period "${action.data.name}" creato`);
          break;
        case 'create_objective':
          addObjective({
            focusPeriodId: action.data.focus_period_id,
            enterpriseId: action.data.enterprise_id,
            title: action.data.title,
            description: action.data.description || '',
            weight: 1, status: 'active',
          });
          toast.success(`Objective "${action.data.title}" creato`);
          break;
        case 'create_key_result':
          addKeyResult({
            objectiveId: action.data.objective_id,
            enterpriseId: action.data.enterprise_id,
            title: action.data.title,
            targetValue: action.data.target_value,
            currentValue: 0,
            metricType: action.data.metric_type || 'number',
            deadline: action.data.deadline || null,
            status: 'active',
          });
          toast.success(`Key Result "${action.data.title}" creato`);
          break;
        case 'schedule_task':
          scheduleTask(action.data.task_id, action.data.date, action.data.time);
          toast.success('Task pianificata');
          break;
        case 'complete_task':
          completeTask(action.data.task_id);
          toast.success('Task completata');
          break;
        case 'create_appointment':
          addAppointment({
            title: action.data.title,
            date: action.data.date,
            startTime: action.data.start_time,
            endTime: action.data.end_time,
            description: action.data.description || null,
            color: null,
            enterpriseId: action.data.enterprise_id || null,
          });
          toast.success(`Appuntamento "${action.data.title}" creato`);
          break;
        default:
          console.warn('Unknown action type:', action.type);
      }
      action.applied = true;
      setPendingActions(prev => [...prev]);
    } catch (e) {
      console.error('Error applying action:', e);
      toast.error("Errore nell'applicare l'azione");
    }
  };

  const handleSend = async () => {
    const text = input.trim();
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          type: 'global_assistant',
          messages: newMessages,
          context: buildContext(),
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Errore ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === 'delta' && parsed.content) {
              assistantContent += parsed.content;
              const snapshot = assistantContent;
              setMessages(prev =>
                prev.map((m, i) => i === prev.length - 1 && m.role === 'assistant' ? { ...m, content: snapshot } : m)
              );
            }
            if (parsed.type === 'actions' && parsed.actions?.length) {
              const actions: GlobalAction[] = parsed.actions.map((a: any) => ({ ...a, applied: false }));
              setPendingActions(prev => [...prev, ...actions]);
              for (const action of actions) await applyAction(action);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      if (!assistantContent) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1);
          return prev;
        });
      } else {
        speakText(assistantContent);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Errore AI');
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1);
        return prev;
      });
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
  };

  const getActionIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      create_enterprise: <Building2 className="h-3 w-3" />,
      create_project: <FolderKanban className="h-3 w-3" />,
      create_task: <ListTodo className="h-3 w-3" />,
      create_focus_period: <Calendar className="h-3 w-3" />,
      create_objective: <Target className="h-3 w-3" />,
      create_key_result: <BarChart3 className="h-3 w-3" />,
      schedule_task: <Calendar className="h-3 w-3" />,
      complete_task: <Check className="h-3 w-3" />,
      create_appointment: <Calendar className="h-3 w-3" />,
    };
    return icons[type] || <Sparkles className="h-3 w-3" />;
  };

  const getActionLabel = (action: GlobalAction) =>
    action.data?.name || action.data?.title || action.type.replace(/_/g, ' ');

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-5 right-5 h-12 w-12 rounded-full shadow-lg z-50"
        >
          <Bot className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Assistente AI
            </SheetTitle>
            <button
              onClick={() => {
                if (voiceEnabled) { stopSpeaking(); setVoiceEnabled(false); }
                else setVoiceEnabled(true);
              }}
              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                voiceEnabled ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
              }`}
              title={voiceEnabled ? 'Disattiva voce' : 'Attiva voce'}
            >
              {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Chiedi qualsiasi cosa · Legge e scrive ovunque</p>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-10 space-y-2">
              <Bot className="h-8 w-8 mx-auto opacity-30 mb-2" />
              <p className="font-medium">Ciao! Sono il tuo assistente PRP.</p>
              <p>Posso leggere e scrivere in tutte le sezioni.</p>
              <div className="flex flex-wrap gap-1.5 justify-center pt-3">
                {['Cosa devo fare oggi?', 'Crea una task', 'Stato dei miei OKR'].map(q => (
                  <Badge
                    key={q}
                    variant="secondary"
                    className="cursor-pointer text-[10px] hover:bg-primary/10 transition-colors"
                    onClick={() => { setInput(q); setTimeout(() => handleSend(), 50); }}
                  >
                    {q}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted/70 text-foreground rounded-bl-md'
                }`}
              >
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
            <div key={`action-${i}`} className="flex justify-center py-1">
              <div className="flex items-center gap-1.5 rounded-full bg-primary/[0.08] border border-primary/15 px-3 py-1">
                <div className="h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center">
                  {getActionIcon(action.type)}
                </div>
                <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{getActionLabel(action)}</span>
                <Check className="h-3 w-3 text-primary shrink-0" />
              </div>
            </div>
          ))}

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
        <div className="border-t border-border/50 p-2.5 md:p-3 shrink-0 bg-muted/20">
          {isSpeaking && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
              </div>
              <span className="text-[11px] text-muted-foreground">Sta parlando...</span>
              <button onClick={stopSpeaking} className="text-[11px] text-primary hover:underline ml-auto">Stop</button>
            </div>
          )}
          {isListening && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-[11px] text-muted-foreground">Ti sto ascoltando...</span>
              <button onClick={stopListening} className="text-[11px] text-primary hover:underline ml-auto">Stop</button>
            </div>
          )}
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground w-full mb-2"
              onClick={() => { setMessages([]); setPendingActions([]); }}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Pulisci chat
            </Button>
          )}
          <div className="flex items-end gap-2 bg-card rounded-xl border border-input px-3 py-1.5 focus-within:ring-1 focus-within:ring-ring transition-shadow">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Parla ora...' : 'Scrivi o usa il microfono...'}
              className="flex-1 bg-transparent text-sm resize-none border-0 outline-none placeholder:text-muted-foreground/60 min-h-[32px] max-h-[80px] py-1"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-destructive text-destructive-foreground animate-pulse'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
              title={isListening ? 'Smetti di ascoltare' : 'Parla'}
            >
              {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="shrink-0 h-7 w-7 rounded-lg"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
