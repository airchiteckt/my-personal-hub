import { useCallback, useEffect, useRef, useState } from 'react';
import { Porcupine } from '@picovoice/porcupine-web';
import { WebVoiceProcessor } from '@picovoice/web-voice-processor';

/**
 * Attivazione di Radar con la parola chiave "Radar" (Picovoice Porcupine, tutto in locale nel browser).
 *
 * Per attivarlo servono due file in public/porcupine/:
 * - porcupine_params_it.pv  (modello italiano, già incluso)
 * - radar_it.ppn            (parola chiave "Radar" addestrata su console.picovoice.ai)
 * e la AccessKey Picovoice (gratuita) qui sotto.
 */
export const PORCUPINE_ACCESS_KEY = ''; // ← incolla qui la AccessKey da console.picovoice.ai
const KEYWORD_PATH = '/porcupine/radar_it.ppn';
const MODEL_PATH = '/porcupine/porcupine_params_it.pv';

export type WakeState = 'off' | 'starting' | 'listening' | 'error';

export function useRadarWakeWord(opts: { enabled: boolean; onWake: () => void }) {
  const [state, setState] = useState<WakeState>('off');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const porcupineRef = useRef<Porcupine | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const startingRef = useRef(false);

  const stop = useCallback(async () => {
    const p = porcupineRef.current;
    porcupineRef.current = null;
    if (p) {
      try { await WebVoiceProcessor.unsubscribe(p); } catch { /* noop */ }
      try { await p.release(); } catch { /* noop */ }
      try { await p.terminate(); } catch { /* noop */ }
    }
    setState('off');
  }, []);

  useEffect(() => {
    if (!opts.enabled) {
      stop();
      return;
    }
    if (!PORCUPINE_ACCESS_KEY) {
      setState('error');
      setErrorMsg('Manca la chiave Picovoice');
      return;
    }
    if (porcupineRef.current || startingRef.current) return;
    startingRef.current = true;
    setState('starting');

    let cancelled = false;
    (async () => {
      try {
        const porcupine = await Porcupine.create(
          PORCUPINE_ACCESS_KEY,
          [{ publicPath: KEYWORD_PATH, label: 'Radar' }],
          () => { optsRef.current.onWake(); },
          { publicPath: MODEL_PATH },
          { processErrorCallback: (e) => { console.error('[wake word]', e); setState('error'); setErrorMsg('Errore motore di ascolto'); } },
        );
        if (cancelled) { await porcupine.release(); await porcupine.terminate(); return; }
        porcupineRef.current = porcupine;
        await WebVoiceProcessor.subscribe(porcupine);
        if (!cancelled) setState('listening');
      } catch (e) {
        console.error('[wake word] init', e);
        if (!cancelled) {
          setState('error');
          setErrorMsg('File della parola chiave mancanti o chiave non valida');
        }
      } finally {
        startingRef.current = false;
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.enabled]);

  // Cleanup on unmount
  useEffect(() => () => { stop(); }, [stop]);

  return { state, errorMsg, stop };
}
