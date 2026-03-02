import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Sparkles, Clock, Brain, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

type Msg = { role: 'user' | 'assistant'; content: string };
type AiMode = 'general' | 'reminder' | 'task_suggest' | 'effort_estimate';

const MODES: { key: AiMode; label: string; icon: React.ElementType }[] = [
  { key: 'general', label: 'Chat', icon: Bot },
  { key: 'reminder', label: 'Promemoria', icon: Clock },
  { key: 'task_suggest', label: 'Suggerisci', icon: Sparkles },
  { key: 'effort_estimate', label: 'Stima', icon: Brain },
];

export function AiAssistant() {
  const { session } = useAuth();
  const { enterprises, projects, tasks } = usePrp();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AiMode>('general');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const buildContext = () => ({
    enterprises: enterprises.map(e => ({ name: e.name, status: e.status })),
    projects: projects.map(p => ({ name: p.name, type: p.type, enterpriseId: p.enterpriseId })),
    tasks: tasks
      .filter(t => t.status !== 'done')
      .map(t => ({
        title: t.title,
        priority: t.priority,
        status: t.status,
        estimatedMinutes: t.estimatedMinutes,
        deadline: t.deadline,
        scheduledDate: t.scheduledDate,
      })),
  });

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    if (mode === 'task_suggest') {
      // Non-streaming structured response
      try {
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: {
            type: mode,
            messages: newMessages,
            context: buildContext(),
          },
        });
        if (error) throw error;
        const suggestions = data?.suggestions ?? [];
        const text = suggestions.length
          ? suggestions
              .map(
                (s: any, i: number) =>
                  `**${i + 1}. ${s.title}**\n- Priorità: ${s.priority} | Tempo stimato: ${s.estimated_minutes} min\n- _${s.reason}_`
              )
              .join('\n\n')
          : 'Nessun suggerimento disponibile.';
        setMessages(prev => [...prev, { role: 'assistant', content: text }]);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'Errore AI');
      }
      setIsLoading(false);
      return;
    }

    // Streaming chat
    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          type: mode,
          messages: newMessages,
          context: buildContext(),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Errore ${resp.status}`);
      }

      if (!resp.body) throw new Error('No stream body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantSoFar = '';

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Errore AI');
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
          <SheetTitle className="text-base">Assistente AI</SheetTitle>
          <div className="flex gap-1.5 flex-wrap pt-1">
            {MODES.map(m => (
              <Badge
                key={m.key}
                variant={mode === m.key ? 'default' : 'secondary'}
                className="cursor-pointer text-[11px] gap-1"
                onClick={() => { setMode(m.key); setMessages([]); }}
              >
                <m.icon className="h-3 w-3" />
                {m.label}
              </Badge>
            ))}
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-10 space-y-1">
              <Bot className="h-8 w-8 mx-auto opacity-30 mb-2" />
              <p>Ciao! Sono il tuo assistente PRP.</p>
              <p>Seleziona una modalità e scrivimi.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground">
                <span className="animate-pulse">Sto pensando...</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-3 shrink-0 space-y-2">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground w-full"
              onClick={() => setMessages([])}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Pulisci chat
            </Button>
          )}
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi un messaggio..."
              rows={1}
              className="resize-none text-sm min-h-[40px]"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
