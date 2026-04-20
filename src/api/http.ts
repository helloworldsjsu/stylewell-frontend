import { buildApiUrl } from '../config/api';
import { getFlaskApiUrl } from '../lib/supabase';

export interface ApiErrorEnvelope {
  error: string;
  code?: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  status: number;
  envelope: ApiErrorEnvelope;

  constructor(status: number, envelope: ApiErrorEnvelope) {
    super(envelope.error);
    this.name = 'ApiRequestError';
    this.status = status;
    this.envelope = envelope;
  }
}

export interface RequestJsonOptions {
  retries?: number;
  retryDelayMs?: number;
  operationName?: string;
}

async function resolveRequestUrl(path: string): Promise<string> {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const dynamicBaseUrl = await getFlaskApiUrl();
  return buildApiUrl(path, dynamicBaseUrl);
}

function toErrorEnvelope(payload: unknown, fallbackMessage: string): ApiErrorEnvelope {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const errorValue = (payload as any).error;
    return {
      error: typeof errorValue === 'string' ? errorValue : fallbackMessage,
      code: typeof (payload as any).code === 'string' ? (payload as any).code : undefined,
      details: (payload as any).details,
    };
  }
  if (typeof payload === 'string' && payload.trim().length > 0) {
    return { error: payload };
  }
  return { error: fallbackMessage };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

export function toUserFacingApiMessage(error: unknown, fallbackMessage: string): string {
  const status =
    error instanceof ApiRequestError
      ? error.status
      : typeof (error as any)?.status === 'number'
        ? (error as any).status
        : undefined;

  const envelopeError =
    error instanceof ApiRequestError
      ? error.envelope.error
      : typeof (error as any)?.envelope?.error === 'string'
        ? (error as any).envelope.error
        : undefined;

  if (typeof status === 'number') {
    if (status === 400) return envelopeError || fallbackMessage;
    if (status === 401) return 'Authentication expired. Please sign in again.';
    if (status === 403) return 'You do not have permission for this action.';
    if (status === 404) return 'Requested resource was not found.';
    if (status === 429) return 'Too many requests. Please retry in a moment.';
    if (status >= 500) return 'Server error. Please retry shortly.';
    return envelopeError || fallbackMessage;
  }

  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and retry.';
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

export async function requestJson<T>(path: string, init?: RequestInit, options?: RequestJsonOptions): Promise<T> {
  const retries = options?.retries ?? 1;
  const retryDelayMs = options?.retryDelayMs ?? 350;
  const operationName = options?.operationName ?? 'request';
  const requestUrl = await resolveRequestUrl(path);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const headers = new Headers(init?.headers ?? undefined);
      headers.set('ngrok-skip-browser-warning', 'true');

      const response = await fetch(requestUrl, {
        ...init,
        headers,
      });
      const payload = await parseResponseBody(response);

      if (!response.ok) {
        const apiError = new ApiRequestError(
          response.status,
          toErrorEnvelope(payload, `Request failed with status ${response.status}`),
        );

        if (attempt < retries && shouldRetryStatus(response.status)) {
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }

        throw apiError;
      }

      return payload as T;
    } catch (error) {
      if (attempt < retries && isNetworkError(error)) {
        await wait(retryDelayMs * (attempt + 1));
        continue;
      }

      const message = toUserFacingApiMessage(error, `Failed to ${operationName}`);
      throw new Error(message);
    }
  }

  throw new Error(`Failed to ${operationName}`);
}
