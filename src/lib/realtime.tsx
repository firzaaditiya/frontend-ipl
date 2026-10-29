import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './auth';

export interface RealtimeEvent {
  type: string;
  at: string;
  data?: unknown;
}

interface RealtimeContextValue {
  connected: boolean;
  lastEvent: RealtimeEvent | null;
  subscribe: (listener: (event: RealtimeEvent) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function parseChunk(chunk: string, fallbackType: string): RealtimeEvent | null {
  let type = fallbackType;
  const dataLines: string[] = [];
  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) type = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(dataLines.join('\n'));
    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      return parsed as RealtimeEvent;
    }
    return { type, at: new Date().toISOString(), data: parsed };
  } catch {
    return null;
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const listenersRef = useRef(new Set<(event: RealtimeEvent) => void>());

  const subscribe = useCallback((listener: (event: RealtimeEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnected(false);
      return;
    }

    let cancelled = false;
    let controller: AbortController | null = null;
    let retry = 0;
    let timer: number | undefined;

    const emit = (event: RealtimeEvent) => {
      setLastEvent(event);
      listenersRef.current.forEach((listener) => listener(event));
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      retry = Math.min(retry + 1, 5);
      const delay = Math.min(1000 * 2 ** (retry - 1), 15000);
      timer = window.setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      if (cancelled || !token) return;
      controller = new AbortController();
      try {
        const res = await fetch('/api/v1/events', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });

        if (res.status === 401) {
          window.dispatchEvent(new Event('auth:logout'));
          return;
        }
        if (!res.ok || !res.body) {
          throw new Error(`stream status ${res.status}`);
        }

        setConnected(true);
        retry = 0;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { value, done } = await reader.read();
          if (done || cancelled) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            if (chunk.trim() && !chunk.startsWith(':')) {
              const event = parseChunk(chunk, 'message');
              if (event) emit(event);
            }
            boundary = buffer.indexOf('\n\n');
          }
        }
      } catch {
        /* jaringan/abort → reconnect */
      } finally {
        if (!cancelled) {
          setConnected(false);
          scheduleReconnect();
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      controller?.abort();
      if (timer) window.clearTimeout(timer);
      setConnected(false);
    };
  }, [token]);

  const value = useMemo(
    () => ({ connected, lastEvent, subscribe }),
    [connected, lastEvent, subscribe],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used within RealtimeProvider');
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRealtimeEvent(handler: (event: RealtimeEvent) => void) {
  const { subscribe } = useRealtime();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => subscribe((event) => handlerRef.current(event)), [subscribe]);
}
