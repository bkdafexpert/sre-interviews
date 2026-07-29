'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { CheckIcon, ChevronLeft, CopyIcon, Spinner } from '@/components/icons';
import { api, ApiError, Bar, LinkDetail } from '@/lib/api';
import { buildChartPath, destShort, formatDateFr, frNumber, shortUrl } from '@/lib/format';
import { useCopy } from '@/lib/useCopy';

function StatCard({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div
      style={{
        background: red ? '#E9041E' : '#FFFFFF',
        color: red ? '#FFFFFF' : '#141414',
        borderRadius: 12,
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        boxShadow: red ? undefined : '0 2px 12px rgba(20,20,20,0.08)',
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: red ? 'rgba(255,255,255,0.75)' : '#8A8A8A',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 30, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function BarList({ title, bars, fill }: { title: string; bars: Bar[]; fill: string }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(20,20,20,0.08)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
      {bars.length === 0 && <div style={{ fontSize: 13.5, color: '#8A8A8A' }}>Pas encore de données.</div>}
      {bars.map((s) => (
        <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
            <span style={{ fontWeight: 500 }}>{s.name}</span>
            <span style={{ color: '#8A8A8A' }}>{s.pct} %</span>
          </div>
          <svg width="100%" height="6" viewBox="0 0 100 6" preserveAspectRatio="none" style={{ display: 'block' }}>
            <rect width="100" height="6" rx="3" fill="#F0F0F0" />
            <rect width={s.pct} height="6" rx="3" fill={fill} />
          </svg>
        </div>
      ))}
    </div>
  );
}

function DetailView({ code }: { code: string }) {
  const router = useRouter();
  const { copiedCode, copy } = useCopy();
  const [detail, setDetail] = useState<LinkDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .linkDetail(code)
      .then((d) => alive && setDetail(d))
      .catch((e: ApiError) => alive && setError(e.status === 404 ? 'introuvable' : e.message));
    return () => {
      alive = false;
    };
  }, [code]);

  if (error === 'introuvable') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Lien introuvable</h1>
        <p style={{ margin: 0, color: '#5A5A5A' }}>Ce lien n’existe pas ou ne vous appartient pas.</p>
        <a href="/links" onClick={(e) => { e.preventDefault(); router.push('/links'); }}>
          ← Retour à mes liens
        </a>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ padding: 60, display: 'flex', justifyContent: 'center', color: '#E9041E' }}>
        <Spinner size={22} />
      </div>
    );
  }

  const chart = buildChartPath(detail.series);
  const now = new Date();
  const dayMs = 86400000;
  const labelStart = formatDateFr(new Date(now.getTime() - 29 * dayMs).toISOString());
  const labelMid = formatDateFr(new Date(now.getTime() - 15 * dayMs).toISOString());
  const labelEnd = formatDateFr(now.toISOString());
  const isCopied = copiedCode === detail.code;

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <a
          href="/links"
          onClick={(e) => { e.preventDefault(); router.push('/links'); }}
          style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontWeight: 600 }}
        >
          <ChevronLeft size={14} />
          Retour à mes liens
        </a>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(24px,6vw,34px)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.05, wordBreak: 'break-all' }}>
            {shortUrl(detail.code)}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#5A5A5A', wordBreak: 'break-all' }}>
            Redirige vers :{' '}
            <a href={detail.destination} target="_blank" rel="noreferrer">
              {destShort(detail.destination)}
            </a>
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#8A8A8A' }}>Créé le {formatDateFr(detail.createdAt)}</p>
        </div>
        <button
          className="sg-btn-primary"
          onClick={() => copy(detail.code)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 20px',
            background: '#E9041E',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          {isCopied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
          {isCopied ? 'Copié !' : 'Copier le lien'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
        <StatCard red label="Clics totaux" value={frNumber(detail.clicks)} />
        <StatCard label="7 derniers jours" value={frNumber(detail.clicks7)} />
        <StatCard label="Meilleure journée" value={frNumber(detail.bestDay)} />
      </div>

      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(20,20,20,0.08)',
          padding: '24px 24px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>Clics · 30 derniers jours</div>
        <svg viewBox="0 0 720 200" width="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="gradDetail" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#E9041E" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#E9041E" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[16, 72, 128, 184].map((y) => (
            <line key={y} x1="16" x2="704" y1={y} y2={y} stroke="#E5E5E5" strokeDasharray="3 4" />
          ))}
          {chart.area && <path d={chart.area} fill="url(#gradDetail)" />}
          {chart.line && (
            <path d={chart.line} stroke="#E9041E" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
          <circle cx={chart.dotX} cy={chart.dotY} r="5" fill="#FFFFFF" stroke="#E9041E" strokeWidth="2.5" />
          <text x="16" y="199" fontSize="11" fill="#8A8A8A" fontFamily="Outfit,sans-serif">
            {labelStart}
          </text>
          <text x="360" y="199" fontSize="11" fill="#8A8A8A" fontFamily="Outfit,sans-serif" textAnchor="middle">
            {labelMid}
          </text>
          <text x="704" y="199" fontSize="11" fill="#8A8A8A" fontFamily="Outfit,sans-serif" textAnchor="end">
            {labelEnd}
          </text>
        </svg>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        <BarList title="Sources" bars={detail.sources} fill="#E9041E" />
        <BarList title="Appareils" bars={detail.devices} fill="#141414" />
        <BarList title="Pays" bars={detail.countries} fill="#8E0212" />
      </div>
    </div>
  );
}

export default function Page() {
  const params = useParams<{ code: string }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  return (
    <AppShell>
      <DetailView code={code} />
    </AppShell>
  );
}
