type ScrapeEventLevel = 'info' | 'warn' | 'error';

export type ScrapeEventType =
  | 'scrape_timeout'
  | 'scrape_rate_limited'
  | 'scrape_request_failed'
  | 'scrape_parse_error'
  | 'scrape_malformed_payload'
  | 'scrape_low_results'
  | 'scrape_fallback_provider_used';

export interface ScrapeEvent {
  type: ScrapeEventType;
  level: ScrapeEventLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

const SCRAPE_LOGS_KEY = 'wa_scrape_monitor_logs';
const SCRAPE_LOGS_LIMIT = 200;
const ENABLED = String(import.meta.env.VITE_ENABLE_SCRAPE_MONITORING ?? 'true').toLowerCase() !== 'false';

function readLogs(): ScrapeEvent[] {
  if (!ENABLED) return [];
  try {
    const raw = localStorage.getItem(SCRAPE_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScrapeEvent[]) : [];
  } catch {
    return [];
  }
}

function writeLogs(events: ScrapeEvent[]) {
  if (!ENABLED) return;
  try {
    localStorage.setItem(SCRAPE_LOGS_KEY, JSON.stringify(events.slice(0, SCRAPE_LOGS_LIMIT)));
  } catch {
    // Ignore storage write errors to avoid breaking user flow.
  }
}

export function logScrapeEvent(event: Omit<ScrapeEvent, 'timestamp'>) {
  if (!ENABLED) return;

  const withTimestamp: ScrapeEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  const existing = readLogs();
  writeLogs([withTimestamp, ...existing]);

  const payload = {
    type: withTimestamp.type,
    message: withTimestamp.message,
    context: withTimestamp.context,
    timestamp: withTimestamp.timestamp,
  };

  if (withTimestamp.level === 'error') {
    console.error('[scrape-monitor]', payload);
    return;
  }

  if (withTimestamp.level === 'warn') {
    console.warn('[scrape-monitor]', payload);
    return;
  }

  console.info('[scrape-monitor]', payload);
}
