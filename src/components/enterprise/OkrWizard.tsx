import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Sparkles, Check, Target, BarChart3, Calendar, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import type { Enterprise } from '@/types/prp';

type Msg = { role: 'user' | 'assistant'; content: string };
type WizardAction = {
  type: 'create_focus_period' | 'create_objective' | 'create_key_result';
  data: any;
  applied?: boolean;
};

interface Props {
  enterprise: Enterprise;
  activeFocusId?: string;
  onCreated?: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

export function OkrWizard({ enterprise, activeFocusId, onCreated }: Props) {
  const { session } = useAuth();
  const {
    addFocusPeriod, addObjective, addKeyResult,
    getFocusPeriodsForEnterprise, getObjectivesForFocus,
    getKeyResultsForObjective, getProjectsForEnterprise, getTasksForEnterprise,
  } = usePrp();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pendingActions, setPendingActions] = useState<WizardAction[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [createdFocusId, setCreatedFocusId] = useState<string | null>(activeFocusId || null);
  const [createdObjectiveId, setCreatedObjectiveId] = useState<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingActions]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

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
    };
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
          type: 'okr_wizard',
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
      let streamDone = false;

      // Create assistant message placeholder
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
              const contentSnapshot = assistantContent;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: contentSnapshot } : m);
                }
                return [...prev, { role: 'assistant', content: contentSnapshot }];
              });
            }

            if (parsed.type === 'actions' && parsed.actions?.length) {
              const actions: WizardAction[] = parsed.actions.map((a: any) => ({ ...a, applied: false }));
              setPendingActions(prev => [...prev, ...actions]);
              for (const action of actions) {
                await applyAction(action);
              }
            }
          } catch {
            // Partial JSON, put back
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === 'delta' && parsed.content) {
              assistantContent += parsed.content;
              const contentSnapshot = assistantContent;
              setMessages(prev =>
                prev.map((m, i) => i === prev.length - 1 && m.role === 'assistant' ? { ...m, content: contentSnapshot } : m)
              );
            }
            if (parsed.type === 'actions' && parsed.actions?.length) {
              const actions: WizardAction[] = parsed.actions.map((a: any) => ({ ...a, applied: false }));
              setPendingActions(prev => [...prev, ...actions]);
              for (const action of actions) {
                await applyAction(action);
              }
            }
          } catch { /* ignore */ }
        }
      }

      // Remove empty assistant message if no content came
      if (!assistantContent) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1);
          return prev;
        });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Errore AI');
      // Remove empty assistant message on error
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1);
        return prev;
      });
    }
    setIsLoading(false);
  };

  const applyAction = async (action: WizardAction) => {
    try {
      if (action.type === 'create_focus_period') {
        addFocusPeriod({
          enterpriseId: enterprise.id,
          name: action.data.name,
          startDate: action.data.start_date,
          endDate: action.data.end_date,
          status: action.data.status || 'active',
        });
        toast.success(`Focus Period "${action.data.name}" creato`);
        action.applied = true;
      } else if (action.type === 'create_objective') {
        const focusPeriods = getFocusPeriodsForEnterprise(enterprise.id);
        const targetFocusId = createdFocusId || focusPeriods.find(f => f.status === 'active')?.id;
        if (!targetFocusId) { toast.error('Crea prima un Focus Period attivo'); return; }
        addObjective({
          focusPeriodId: targetFocusId,
          enterpriseId: enterprise.id,
          title: action.data.title,
          description: action.data.description,
          weight: 1,
          status: 'active',
        });
        toast.success(`Objective "${action.data.title}" creato`);
        action.applied = true;
      } else if (action.type === 'create_key_result') {
        const focusPeriods = getFocusPeriodsForEnterprise(enterprise.id);
        const activeFocus = focusPeriods.find(f => f.status === 'active');
        const objectives = activeFocus ? getObjectivesForFocus(activeFocus.id) : [];
        const targetObjId = createdObjectiveId || objectives[objectives.length - 1]?.id;
        if (!targetObjId) { toast.error('Crea prima un Objective'); return; }
        addKeyResult({
          objectiveId: targetObjId,
          enterpriseId: enterprise.id,
          title: action.data.title,
          targetValue: action.data.target_value,
          currentValue: 0,
          metricType: action.data.metric_type || 'percentage',
          deadline: action.data.deadline,
          status: 'active',
        });
        toast.success(`Key Result "${action.data.title}" creato`);
        action.applied = true;
      }
      setPendingActions(prev => [...prev]);
      onCreated?.();
    } catch (e) {
      console.error('Error applying action:', e);
      toast.error('Errore nell\'applicare l\'azione');
    }
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
  };

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
    if (hasActiveFocus) {
      const focus = allFocusPeriods.find(f => f.status === 'active')!;
      const objs = getObjectivesForFocus(focus.id);
      if (objs.length === 0) {
        return `🎯 Hai già un Focus attivo: **${focus.name}**.\n\nPassiamo alla parte strategica. Qual è la cosa **più importante** che ${enterprise.name} deve raggiungere in questo trimestre?`;
      }
      const lastObj = objs[objs.length - 1];
      const krs = getKeyResultsForObjective(lastObj.id);
      if (krs.length < 2) {
        return `📊 Hai l'Objective **"${lastObj.title}"**. Definiamo come misurare il successo.\n\nQual è il **numero chiave** che ti dice se hai raggiunto questo obiettivo?`;
      }
      const futureLabel = futureFocusPeriods.length > 0 ? ` Hai anche ${futureFocusPeriods.length} trimestri futuri pianificati.` : '';
      return `✅ Hai già ${objs.length} Objective con ${krs.length} KR definiti per **${focus.name}**.${futureLabel}\n\nVuoi aggiungere un altro Objective, o pianificare il prossimo trimestre?`;
    }
    return `🎯 Iniziamo la pianificazione strategica di **${enterprise.name}**.\n\n📅 Il trimestre corrente è **${quarterLabel}**. Lavoriamo su questo o preferisci pianificare il prossimo?`;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          if (messages.length === 0) {
            setMessages([{ role: 'assistant', content: getOpeningMessage() }]);
          }
        }}
        className="w-full group flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.04] to-primary/[0.08] hover:from-primary/[0.08] hover:to-primary/[0.14] transition-all duration-200 px-4 py-3"
      >
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Wizard AI</p>
          <p className="text-[11px] text-muted-foreground truncate">Pianifica la strategia con l'assistente</p>
        </div>
        <Send className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 overflow-hidden bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2.5 bg-gradient-to-r from-primary/[0.06] to-primary/[0.03] border-b border-primary/10">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <span className="text-xs font-semibold text-foreground">Wizard AI</span>
            <span className="text-[10px] text-muted-foreground ml-1.5 hidden sm:inline">· {enterprise.name}</span>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="max-h-[50vh] md:max-h-80 overflow-y-auto p-3 md:p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] md:max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
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
              <span className="text-[11px] font-medium text-foreground">{getActionTypeLabel(action.type)}</span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[160px] md:max-w-[240px]">{getActionLabel(action)}</span>
              <Check className="h-3 w-3 text-primary shrink-0" />
            </div>
          </div>
        ))}

        {/* Loading indicator (only when no content streaming yet) */}
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
            placeholder="Scrivi qui..."
            className="flex-1 bg-transparent text-sm resize-none border-0 outline-none placeholder:text-muted-foreground/60 min-h-[32px] max-h-[80px] py-1"
            rows={1}
            disabled={isLoading}
          />
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
    </div>
  );
}
