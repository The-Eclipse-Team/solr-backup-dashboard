import { useEffect, useState } from 'react';

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

/** A ticking clock used to keep live durations and the "now" label moving between polls. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface PollResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Polls `url` every `intervalMs`, keeping the last successful payload visible across refreshes. The
 * next poll is scheduled after the previous one settles rather than on a fixed interval: a request
 * slower than the interval would otherwise stack another one on top of it, and each of those makes the
 * server scan the whole report directory again.
 */
export function usePolling<T>(url: string, intervalMs: number): PollResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true);

    const tick = async () => {
      try {
        const json = await fetchJson<T>(url);
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(tick, intervalMs);
        }
      }
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, intervalMs]);

  return { data, error, loading };
}
