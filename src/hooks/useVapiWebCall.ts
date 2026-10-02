import { useCallback, useRef, useState } from 'react';
import Daily, { DailyCall } from '@daily-co/daily-js';
import { supabase } from '@/integrations/supabase/client';

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking';

/**
 * Sessione vocale Radar nel browser tramite lo stesso assistente VAPI del telefono.
 * Il server crea la web call (chiave privata), il client si collega alla stanza audio.
 */
export function useVapiWebCall(opts: {
  onFinal: (role: 'user' | 'assistant', text: string) => void;
  onPartial?: (text: string) => void;
  onError?: (msg: string) => void;
}) {
  const [state, setState] = useState<VoiceState>('idle');
  const [active, setActive] = useState(false);
  const callRef = useRef<DailyCall | null>(null);
  const audioEls = useRef<HTMLAudioElement[]>([]);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const cleanup = useCallback(() => {
    audioEls.current.forEach(a => { a.pause(); a.srcObject = null; a.remove(); });
    audioEls.current = [];
    const c = callRef.current;
    callRef.current = null;
    if (c) { c.leave().catch(() => {}).finally(() => c.destroy().catch(() => {})); }
    setActive(false);
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    if (callRef.current) return;
    setActive(true);
    setState('connecting');
    try {
      const { data, error } = await supabase.functions.invoke('vapi-web-call', { body: {} });
      if (error || !data?.ok || !data?.webCallUrl) throw new Error(data?.message || 'Non riesco ad avviare la voce di Radar.');

      const call = Daily.createCallObject({ audioSource: true, videoSource: false });
      callRef.current = call;

      call.on('track-started', (e: any) => {
        if (!e?.participant || e.participant.local) return;
        if (e.track?.kind === 'audio') {
          const a = document.createElement('audio');
          a.autoplay = true;
          a.srcObject = new MediaStream([e.track]);
          document.body.appendChild(a);
          a.play().catch(() => {});
          audioEls.current.push(a);
        }
        call.sendAppMessage('playable', '*');
      });

      call.on('app-message', (e: any) => {
        if (!e?.data) return;
        if (e.data === 'listening') { setState('listening'); return; }
        let msg: any;
        try { msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
        if (msg.type === 'transcript') {
          if (msg.transcriptType === 'final') {
            optsRef.current.onFinal(msg.role === 'user' ? 'user' : 'assistant', msg.transcript);
            if (msg.role === 'user') { optsRef.current.onPartial?.(''); setState('processing'); }
          } else if (msg.role === 'user') {
            optsRef.current.onPartial?.(msg.transcript);
          }
        } else if (msg.type === 'speech-update' && msg.role === 'assistant') {
          setState(msg.status === 'started' ? 'speaking' : 'listening');
        } else if (msg.type === 'status-update' && msg.status === 'ended') {
          cleanup();
        }
      });

      call.on('left-meeting', () => cleanup());
      call.on('error', (e: any) => { console.error('[Radar voce]', e); optsRef.current.onError?.('Connessione vocale interrotta.'); cleanup(); });

      await call.join({ url: data.webCallUrl });
      setState('listening');
    } catch (e: any) {
      console.error(e);
      const m = String(e?.message || '');
      optsRef.current.onError?.(/permission|NotAllowed/i.test(m) ? 'Permesso microfono necessario.' : m || 'Errore voce');
      cleanup();
    }
  }, [cleanup]);

  return { state, active, start, stop: cleanup };
}
