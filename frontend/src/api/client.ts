// Thin fetch wrapper shared by every API module. Adds the bearer token from
// localStorage, unwraps the backend's `{ error: { code, message } }` envelope
// into a typed error, and returns the parsed JSON body on success.

const API_BASE_URL = '/api';
export const TOKEN_STORAGE_KEY = 'seapedia_token';

export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

interface ErrorEnvelope {
  error?: { code: string; message: string };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const envelope = body as ErrorEnvelope | null;
    const error = envelope?.error ?? { code: 'UNKNOWN_ERROR', message: 'Terjadi kesalahan tak terduga.' };
    throw new ApiClientError(response.status, error.code, error.message);
  }

  return body as T;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  return handleResponse<T>(response);
}

/**
 * Sibling to apiFetch for multipart/form-data uploads (e.g. product photo
 * files). Deliberately does NOT set a Content-Type header — the browser
 * derives `multipart/form-data; boundary=...` from the FormData body itself,
 * and setting it manually would drop the boundary and break parsing.
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers = new Headers();
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData });
  return handleResponse<T>(response);
}
