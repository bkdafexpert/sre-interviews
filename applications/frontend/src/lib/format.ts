// Display helpers shared across views. Keeps the API returning raw data and the branding here.

// Optional branded short domain (e.g. "sgcut.co") for production. When unset, the short URL is
// derived from the host the app is actually served on — localhost:3000 in dev, the real FQDN in
// prod — so nothing is hard-coded and no rebuild is needed to change environments.
const BRAND_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || '';

// Host shown in the UI (no protocol), e.g. "localhost:3000" or "sgcut.co".
export function shortHost(): string {
  if (BRAND_DOMAIN) return BRAND_DOMAIN;
  if (typeof window !== 'undefined') return window.location.host;
  return 'localhost:3000'; // SSR fallback — real link content only renders after client mount
}

export function frNumber(n: number): string {
  return n.toLocaleString('fr-FR');
}

export function shortUrl(code: string): string {
  return `${shortHost()}/${code}`;
}

// Absolute, clickable/copyable short URL (with protocol).
export function shortUrlAbsolute(code: string): string {
  if (BRAND_DOMAIN) return `https://${BRAND_DOMAIN}/${code}`;
  if (typeof window !== 'undefined') return `${window.location.origin}/${code}`;
  return `http://localhost:3000/${code}`;
}

// Same-origin path that resolves the short link through the app host.
export function shortUrlHref(code: string): string {
  return `/${code}`;
}

export function destShort(dest: string): string {
  return dest.replace(/^https?:\/\//, '');
}

// Normalizes what the user types in the search box. The short host is the same for every link, so
// it's useless as a filter: typing a full short URL ("localhost:3000/ZV3S3R") searches by code, and
// typing just the host or a prefix of it ("loc", "localhost:3000/") is treated as empty rather than
// filtering everything out.
export function cleanSearchQuery(raw: string): string {
  let q = raw.trim().replace(/^https?:\/\//i, '');
  const host = shortHost().toLowerCase();
  const lower = q.toLowerCase();
  if (host) {
    if (lower.startsWith(host)) {
      q = q.slice(host.length).replace(/^\/+/, '');
    } else if (lower.length > 0 && (host + '/').startsWith(lower)) {
      q = '';
    }
  }
  return q;
}

export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export type LinkStatus = 'active' | 'expired' | 'disabled';

export function statusOf(status: LinkStatus) {
  switch (status) {
    case 'active':
      return { label: 'Actif', bg: '#E3F2E6', fg: '#1B8A3C' };
    case 'disabled':
      return { label: 'Désactivé', bg: '#FBE9EB', fg: '#B33A2E' };
    default:
      return { label: 'Expiré', bg: '#F0F0F0', fg: '#8A8A8A' };
  }
}

export interface ChartPath {
  line: string;
  area: string;
  dotX: string;
  dotY: string;
}

// SVG path builder for the click time-series, matching the reference design's geometry.
export function buildChartPath(series: number[], W = 720, H = 200, pad = 16): ChartPath {
  if (series.length === 0) {
    return { line: '', area: '', dotX: String(pad), dotY: String(H - pad) };
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const rng = max - min || 1;
  const denom = series.length - 1 || 1;
  const sx = (i: number) => pad + (i / denom) * (W - pad * 2);
  const sy = (v: number) => H - pad - ((v - min) / rng) * (H - pad * 2);
  const line = series.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ');
  const area = `${line} L${(W - pad).toFixed(1)} ${(H - pad).toFixed(1)} L${pad.toFixed(1)} ${(H - pad).toFixed(1)} Z`;
  return {
    line,
    area,
    dotX: sx(series.length - 1).toFixed(1),
    dotY: sy(series[series.length - 1]).toFixed(1),
  };
}
