// Thin client for the Sgcut API. All calls go through same-origin /api (proxied to the backend
// by Next rewrites), so the httpOnly session cookie is sent automatically.

export interface User {
  id: string;
  email: string;
  name: string;
  initials: string;
}

export type LinkStatus = 'active' | 'expired' | 'disabled';

export interface LinkItem {
  code: string;
  destination: string;
  createdAt: string;
  expiresAt: string | null;
  active: boolean;
  status: LinkStatus;
  clicks: number;
}

export interface ListResult {
  items: LinkItem[];
  total: number;
  skip: number;
  take: number;
}

export interface Stats {
  linkCount: number;
  activeCount: number;
  totalClicks: number;
  clicks7: number;
  delta7: number | null;
  best: { code: string; destination: string; clicks: number } | null;
}

export interface Bar {
  name: string;
  count: number;
  pct: number;
}

export interface LinkDetail extends LinkItem {
  clicks7: number;
  bestDay: number;
  series: number[];
  sources: Bar[];
  devices: Bar[];
  countries: Bar[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

import { getIdToken } from './auth';

// Versioned API base. Proxied to the backend by the Next `/api/:path*` rewrite.
const API_BASE = '/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // In cognito mode, attach the Bearer ID token; in demo mode this is null and the cookie is used.
  const bearer = await getIdToken();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  me: () => request<{ user: User }>('/auth/me'),
  loginWithGoogle: (profile?: { email?: string; name?: string }) =>
    request<{ user: User }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(profile ?? {}),
    }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  createLink: (destination: string, expiresInDays: number | null) =>
    request<LinkItem>('/links', {
      method: 'POST',
      body: JSON.stringify({ destination, ...(expiresInDays ? { expiresInDays } : {}) }),
    }),
  listLinks: (params: { query?: string; filter?: string; skip?: number; take?: number }) => {
    const q = new URLSearchParams();
    if (params.query) q.set('query', params.query);
    if (params.filter) q.set('filter', params.filter);
    if (params.skip != null) q.set('skip', String(params.skip));
    if (params.take != null) q.set('take', String(params.take));
    const qs = q.toString();
    return request<ListResult>(`/links${qs ? `?${qs}` : ''}`);
  },
  stats: () => request<Stats>('/links/stats'),
  linkDetail: (code: string) => request<LinkDetail>(`/links/${encodeURIComponent(code)}`),
  setLinkActive: (code: string, active: boolean) =>
    request<LinkItem>(`/links/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),
  deleteLink: (code: string) =>
    request<{ ok: boolean; code: string }>(`/links/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    }),
};
