import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Attivazione di Radar con la parola "Radar" usando il riconoscimento vocale del browser
 * (Web Speech API). Gratis, senza chiavi. Funziona in Chrome/Edge; dove non è supportato
 * lo stato va in errore e resta il bottone.
 */
export type WakeState = 'off' | 'starting' | 'listening' | 'error';

const WAKE_RE = /\bradar\b/i;

export function useRadarWakeWord(opts: { enabled: boolean; onWake: () => void }) {
  const [state, setState] = useState<WakeState>('off');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const recRef = useRef<any>(null);
  const enabledRef = useRef(opts.enabled);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  enabledRef.current = opts.enabled;
  const lastWakeRef = useRef(0);

  const stop = useCallback(() => {
    const r = recRef.current;
    recRef.current = null;
    if (r) {
      r.onend = null;
      try { r.abort(); } catch { /* noop */ }
    }
    setState('off');
  }, []);

  useEffect(() => {
    if (!opts.enabled) { stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setState('error');
      setErrorMsg('Browser non supportato: usa Chrome o Edge');
      return;
    }
    if (recRef.current) return;
    setState('starting');

    const rec = new SR();
    rec.lang = 'it-IT';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => setState('listening');
    rec.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const txt = ev.results[i][0]?.transcript ?? '';
        if (WAKE_RE.test(txt) && Date.now() - lastWakeRef.current > 4000) {
          lastWakeRef.current = Date.now();
          optsRef.current.onWake();
          break;
        }
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setState('error');
        setErrorMsg('Permesso microfono negato');
        enabledRef.current = false;
      }
    };
    rec.onend = () => {
      // Il browser chiude l'ascolto periodicamente: riavvia finché attivo
      if (enabledRef.current && recRef.current === rec) {
        setTimeout(() => { try { rec.start(); } catch { /* noop */ } }, 300);
      }
    };
    recRef.current = rec;
    try { rec.start(); } catch (e) {
      console.error('[wake word]', e);
      setState('error');
      setErrorMsg('Impossibile avviare l\'ascolto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.enabled]);

  useEffect(() => () => { stop(); }, [stop]);

  return { state, errorMsg, stop };
}
