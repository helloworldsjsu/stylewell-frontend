export type ApiMode = 'mock' | 'live';

function normalizeHfSpaceHost(hostname: string): string {
  // Common misconfig: "<owner>-<space>.space" instead of "<owner>-<space>.hf.space".
  if (/^[a-z0-9-]+\.space$/i.test(hostname)) {
    return hostname.replace(/\.space$/i, '.hf.space');
  }
  return hostname;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  const withPortSlash = trimmed.replace(/^(https?:\/\/[^/\s:]+:\d+)(?=[a-z])/i, '$1/');
  try {
    const parsed = new URL(withPortSlash);
    parsed.hostname = normalizeHfSpaceHost(parsed.hostname);
    return parsed.href.replace(/\/$/, '');
  } catch {
    return withPortSlash.replace(/\/$/, '');
  }
}

const hasSupabaseEnv = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const hasConfiguredApiBase = Boolean(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_FLASK_API_URL);

export const API_MODE: ApiMode =
  (import.meta.env.VITE_API_MODE as ApiMode | undefined) ??
  (hasConfiguredApiBase || hasSupabaseEnv ? 'live' : 'mock');

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_FLASK_API_URL ||
    'http://127.0.0.1:5000',
);

export function isLiveApiMode(): boolean {
  return API_MODE === 'live';
}

export function buildApiUrl(path: string, baseUrl: string = API_BASE_URL): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}
