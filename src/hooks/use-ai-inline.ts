import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseAiInlineOptions {
  type: string;
  debounceMs?: number;
}

export function useAiInline<T = any>({ type, debounceMs = 800 }: UseAiInlineOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  const fetch = useCallback(async (context: any, message?: string) => {
    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await globalThis.fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            type,
            context,
            messages: message ? [{ role: 'user', content: message }] : [],
          }),
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'AI error');
      }

      const result = await res.json();
      setData(result);
      return result as T;
    } catch (e: any) {
      if (e.name === 'AbortError') return null;
      console.error('AI inline error:', e);
      toast.error(e.message || 'Errore AI');
      return null;
    } finally {
      setLoading(false);
    }
  }, [type]);

  const debouncedFetch = useCallback((context: any, message?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetch(context, message), debounceMs);
  }, [fetch, debounceMs]);

  const clear = useCallback(() => {
    setData(null);
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { data, loading, fetch, debouncedFetch, clear };
}
