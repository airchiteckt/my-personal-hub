import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Sparkles, Check, Target, BarChart3, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import type { Enterprise, FocusPeriod, Objective } from '@/types/prp';

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

  // Track created IDs to link entities
  const [createdFocusId, setCreatedFocusId] = useState<string | null>(activeFocusId || null);
  const [createdObjectiveId, setCreatedObjectiveId] = useState<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingActions]);

  const buildContext = () => {
    const focusPeriods = getFocusPeriodsForEnterprise(enterprise.id);
    const projects = getProjectsForEnterprise(enterprise.id);
    const tasks = getTasksForEnterprise(enterprise.id);
    const activeFocus = focusPeriods.find(f => f.status === 'active');
    const objectives = activeFocus ? getObjectivesForFocus(activeFocus.id) : [];
    const keyResults = objectives.flatMap(o => getKeyResultsForObjective(o.id));

    // Quarter info
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

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          type: 'okr_wizard',
          messages: newMessages,
          context: buildContext(),
        },
      });
      if (error) throw error;

      const aiMessage = data?.message || '';
      const actions: WizardAction[] = (data?.actions || []).map((a: any) => ({ ...a, applied: false }));

      if (aiMessage) {
        setMessages(prev => [...prev, { role: 'assistant', content: aiMessage }]);
      }

      if (actions.length > 0) {
        setPendingActions(prev => [...prev, ...actions]);
        // Auto-apply actions
        for (const action of actions) {
          await applyAction(action);
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Errore AI');
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
        // We'll get the ID from context after re-render
        toast.success(`✅ Focus Period "${action.data.name}" creato!`);
        action.applied = true;
      } else if (action.type === 'create_objective') {
        const focusPeriods = getFocusPeriodsForEnterprise(enterprise.id);
        const targetFocusId = createdFocusId || focusPeriods.find(f => f.status === 'active')?.id;
        if (!targetFocusId) {
          toast.error('Crea prima un Focus Period attivo');
          return;
        }
        addObjective({
          focusPeriodId: targetFocusId,
          enterpriseId: enterprise.id,
          title: action.data.title,
          description: action.data.description,
          weight: 1,
          status: 'active',
        });
        toast.success(`✅ Objective "${action.data.title}" creato!`);
        action.applied = true;
      } else if (action.type === 'create_key_result') {
        const focusPeriods = getFocusPeriodsForEnterprise(enterprise.id);
        const activeFocus = focusPeriods.find(f => f.status === 'active');
        const objectives = activeFocus ? getObjectivesForFocus(activeFocus.id) : [];
        const targetObjId = createdObjectiveId || objectives[objectives.length - 1]?.id;
        if (!targetObjId) {
          toast.error('Crea prima un Objective');
          return;
        }
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
        toast.success(`✅ Key Result "${action.data.title}" creato!`);
        action.applied = true;
      }
      setPendingActions(prev => [...prev]);
      onCreated?.();
    } catch (e) {
      console.error('Error applying action:', e);
      toast.error('Errore nell\'applicare l\'azione');
    }
  };

  // Update created IDs when focus periods/objectives change
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
      case 'create_focus_period': return `Focus: ${action.data.name}`;
      case 'create_objective': return `Objective: ${action.data.title}`;
      case 'create_key_result': return `KR: ${action.data.title}`;
      default: return action.type;
    }
  };

  // Quarter helpers
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setIsOpen(true);
          if (messages.length === 0) {
            setMessages([{ role: 'assistant', content: getOpeningMessage() }]);
          }
        }}
        className="gap-1.5"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Wizard AI
      </Button>
    );
  }

  return (
    <Card className="border-primary/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">OKR Wizard AI</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsOpen(false)}>
          Chiudi
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-72 overflow-y-auto p-3 space-y-2.5">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-xs max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-xs">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Applied actions */}
        {pendingActions.filter(a => a.applied).map((action, i) => (
          <div key={`action-${i}`} className="flex justify-center">
            <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5 border-primary/20">
              {getActionIcon(action.type)}
              <Check className="h-2.5 w-2.5 text-primary" />
              {getActionLabel(action)}
            </Badge>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-3 py-2 text-xs text-muted-foreground">
              <span className="animate-pulse">🤔 Sto pensando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-2 flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Rispondi..."
          className="text-xs h-8"
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="shrink-0 h-8 w-8"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
