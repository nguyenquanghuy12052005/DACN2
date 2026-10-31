import { useEffect, useState } from 'react';

export interface LiveEvent {
  id: string;
  time: string;
  method: string;
  route: string;
  status: number | null;
  latencyMs: number;
  result: string;
  connectionId: number | null;
  clientKey: string;
  protocol: string;
}
export interface LiveSnapshot {
  schemaVersion: 1;
  source: 'live';
  sessionId: string;
  transport: 'proxy' | 'direct-browser';
  observedAt: string;
  gatewayHealth: boolean | null;
  backendHealth: boolean | null;
  healthAt: string | null;
  completedRps: number | null;
  p95Ms: number | null;
  sampleCount: number;
  discarded: number;
  events: LiveEvent[];
  fingerprints: string[];
  connections: {
    connectionId: number;
    ja4: string | null;
    h2: { status: string; akamai: string | null; reason: string | null } | null;
  }[];
  series: { time: string; value: number }[];
}
export interface LiveState {
  snapshot: LiveSnapshot | null;
  connected: boolean;
}
export function liveAvailable() {
  return (
    document
      .querySelector('meta[name="dacn2-live"]')
      ?.getAttribute('content') === '1'
  );
}
export function useLive(enabled: boolean): LiveState {
  const [state, setState] = useState<LiveState>({
    snapshot: null,
    connected: false,
  });
  useEffect(() => {
    if (!enabled || !liveAvailable()) return;
    let stopped = false,
      stream: EventSource | undefined,
      retry: ReturnType<typeof setTimeout> | undefined,
      lastAt = 0,
      attempts = 0;
    function connect() {
      stream = new EventSource('/api/live/events');
      stream.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data) as LiveSnapshot;
          if (
            data.schemaVersion !== 1 ||
            data.source !== 'live' ||
            !Array.isArray(data.events) ||
            data.events.length > 300 ||
            !Number.isFinite(Date.parse(data.observedAt))
          )
            throw Error('Invalid live schema');
          if (stopped) return;
          lastAt = Date.now();
          attempts = 0;
          setState({ snapshot: data, connected: true });
        } catch {
          stream?.close();
          setState((previous) => ({ ...previous, connected: false }));
        }
      };
      stream.onerror = () => {
        stream?.close();
        if (stopped) return;
        setState((previous) => ({ ...previous, connected: false }));
        retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempts++));
      };
    }
    connect();
    const watchdog = setInterval(() => {
      if (lastAt && Date.now() - lastAt > 15000)
        setState((previous) => ({ ...previous, connected: false }));
    }, 3000);
    return () => {
      stopped = true;
      stream?.close();
      clearTimeout(retry);
      clearInterval(watchdog);
    };
  }, [enabled]);
  return enabled ? state : { snapshot: null, connected: false };
}
export interface Course {
  id: string;
  code: string;
  name: string;
  capacity: number;
  availableSeats: number;
  registeredCount: number;
}
export async function liveRequest(
  path: string,
  body?: { studentCode: string },
  signal?: AbortSignal,
) {
  const started = performance.now();
  const gateway = document
    .querySelector('meta[name="dacn2-gateway"]')
    ?.getAttribute('content');
  const token = document
    .querySelector('meta[name="dacn2-session"]')
    ?.getAttribute('content');
  if (
    gateway &&
    (gateway !== 'https://127.0.0.1:18444' ||
      !/^[a-f0-9]{64}$/.test(token ?? ''))
  )
    throw Error('Invalid direct lab configuration');
  const response = await fetch(
    gateway ? `${gateway}${path}` : `/api/live${path}`,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(gateway ? { 'X-DACN2-Session': token! } : { 'X-DACN2-UI': '1' }),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ?? AbortSignal.timeout(8000),
      cache: 'no-store',
      credentials: 'omit',
    },
  );
  let payload: unknown = await response.json();
  if (gateway && !body && path === '/courses' && Array.isArray(payload)) {
    const ids = new Set(
      document
        .querySelector('meta[name="dacn2-fixtures"]')
        ?.getAttribute('content')
        ?.split(',') ?? [],
    );
    payload = payload.filter((c) => c && ids.has(String(c.id)));
  }
  return {
    status: response.status,
    requestId: response.headers.get('x-request-id'),
    connectionId: response.headers.get('x-dacn2-connection-id'),
    protocol: response.headers.get('x-dacn2-protocol'),
    elapsedMs: performance.now() - started,
    body: payload,
  };
}
