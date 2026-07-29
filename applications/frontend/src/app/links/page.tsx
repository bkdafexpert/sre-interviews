'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LinkRow } from '@/components/LinkRow';
import { ChevronDown, CheckIcon, FilterIcon, PlusIcon, SearchIcon, Spinner, TrendUp } from '@/components/icons';
import { api, LinkItem, Stats } from '@/lib/api';
import { cleanSearchQuery, frNumber, shortUrl } from '@/lib/format';
import { useCopy } from '@/lib/useCopy';

const PAGE = 25;
const FILTERS: { id: 'tous' | 'actifs' | 'expires'; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'actifs', label: 'Actifs' },
  { id: 'expires', label: 'Expirés' },
];

function fmtPct(d: number): string {
  const sign = d >= 0 ? '+ ' : '− ';
  return sign + Math.abs(d).toFixed(1).replace('.', ',') + ' %';
}

function StatCard({
  label,
  value,
  dark,
  red,
  children,
}: {
  label: string;
  value: string;
  dark?: boolean;
  red?: boolean;
  children?: React.ReactNode;
}) {
  const bg = red ? '#E9041E' : dark ? '#141414' : '#FFFFFF';
  const onColor = red || dark;
  return (
    <div
      style={{
        background: bg,
        color: onColor ? '#FFFFFF' : '#141414',
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        boxShadow: onColor ? undefined : '0 2px 12px rgba(20,20,20,0.08)',
      }}
    >
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: red ? 'rgba(255,255,255,0.75)' : dark ? '#E9041E' : '#8A8A8A',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: red || dark ? (dark ? 22 : 34) : 34,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          wordBreak: dark ? 'break-all' : undefined,
        }}
      >
        {value}
      </span>
      {children}
    </div>
  );
}

function LinksView() {
  const router = useRouter();
  const { copiedCode, copy } = useCopy();

  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<'tous' | 'actifs' | 'expires'>('tous');
  const [filterOpen, setFilterOpen] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');

  const [items, setItems] = useState<LinkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  // Debounce the search box; strip the short-host prefix so typing the URL host doesn't filter.
  useEffect(() => {
    const t = setTimeout(() => setQuery(cleanSearchQuery(queryInput)), 250);
    return () => clearTimeout(t);
  }, [queryInput]);

  const loadFirst = useCallback(async () => {
    busy.current = true;
    setLoading(true);
    try {
      const r = await api.listLinks({ query, filter, skip: 0, take: PAGE });
      setItems(r.items);
      setTotal(r.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
      busy.current = false;
    }
  }, [query, filter]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const r = await api.listLinks({ query, filter, skip: items.length, take: PAGE });
      setItems((prev) => [...prev, ...r.items]);
      setTotal(r.total);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
      busy.current = false;
    }
  }, [query, filter, items.length]);

  async function toggleActive(code: string, active: boolean) {
    try {
      const updated = await api.setLinkActive(code, active);
      setItems((prev) => prev.map((it) => (it.code === code ? updated : it)));
      api.stats().then(setStats).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  async function confirmDelete() {
    const code = pendingDelete;
    if (!code) return;
    setPendingDelete(null);
    try {
      await api.deleteLink(code);
      setItems((prev) => prev.filter((it) => it.code !== code));
      setTotal((t) => Math.max(0, t - 1));
      api.stats().then(setStats).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  // Infinite scroll.
  useEffect(() => {
    const onScroll = () => {
      if (busy.current || items.length >= total) return;
      if (window.innerHeight + window.scrollY < document.body.scrollHeight - 300) return;
      loadMore();
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMore, items.length, total]);

  useEffect(() => {
    if (!filterOpen) return;
    const close = () => setFilterOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [filterOpen]);

  const filterLabel = FILTERS.find((f) => f.id === filter)!.label;
  const hasMore = items.length < total;
  const noResults = !loading && items.length === 0;

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E9041E' }}>
            Mes liens
          </p>
          <h1 style={{ margin: 0, fontSize: 'clamp(26px,6.5vw,36px)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.05 }}>
            {stats ? frNumber(stats.linkCount) : '—'} liens créés
          </h1>
        </div>
        <button
          className="sg-btn-primary"
          onClick={() => router.push('/')}
          style={{
            padding: '12px 22px',
            background: '#E9041E',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            fontSize: 14.5,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <PlusIcon size={15} />
          Nouveau lien
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        <StatCard red label="Clics totaux" value={stats ? frNumber(stats.totalClicks) : '—'}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
            {stats ? `${frNumber(stats.linkCount)} liens au total` : ' '}
          </span>
        </StatCard>
        <StatCard label="Liens actifs" value={stats ? frNumber(stats.activeCount) : '—'}>
          <span style={{ fontSize: 13, color: '#8A8A8A' }}>
            {stats ? `sur ${frNumber(stats.linkCount)} liens créés` : ' '}
          </span>
        </StatCard>
        <StatCard label="Clics · 7 derniers jours" value={stats ? frNumber(stats.clicks7) : '—'}>
          <span
            style={{
              fontSize: 13,
              color: stats && stats.delta7 != null && stats.delta7 < 0 ? '#B33A2E' : '#1B8A3C',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {stats && stats.delta7 != null ? (
              <>
                <TrendUp size={13} />
                {fmtPct(stats.delta7)}
              </>
            ) : (
              ' '
            )}
          </span>
        </StatCard>
        <StatCard dark label="Meilleur lien" value={stats?.best ? shortUrl(stats.best.code) : '—'}>
          <span style={{ fontSize: 13, color: '#B8B8B8' }}>
            {stats?.best ? `${frNumber(stats.best.clicks)} clics au total` : ' '}
          </span>
        </StatCard>
      </div>

      <div style={{ position: 'sticky', top: 8, zIndex: 11 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
            background: '#FFFFFF',
            borderRadius: 999,
            padding: '8px 8px 8px 20px',
            boxShadow: '0 2px 12px rgba(20,20,20,0.10)',
          }}
        >
          <SearchIcon size={16} stroke="#8A8A8A" style={{ flex: 'none' }} />
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Rechercher un lien ou une URL…"
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14.5,
              flex: 1,
              minWidth: 160,
              color: '#141414',
              padding: '8px 0',
            }}
          />
          <div style={{ position: 'relative', flex: 'none' }}>
            <button
              className="sg-chip"
              onClick={(e) => {
                e.stopPropagation();
                setFilterOpen((v) => !v);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                borderRadius: 999,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: '#F0F0F0',
                color: '#141414',
                border: 'none',
              }}
            >
              <FilterIcon size={14} />
              {filterLabel}
              <ChevronDown
                size={13}
                style={{ transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1)', transform: filterOpen ? 'rotate(180deg)' : 'none' }}
              />
            </button>
            {filterOpen && (
              <div
                className="fade-up"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  minWidth: 160,
                  background: '#FFFFFF',
                  borderRadius: 12,
                  boxShadow: '0 6px 16px rgba(20,20,20,0.10),0 2px 4px rgba(20,20,20,0.06)',
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  zIndex: 20,
                }}
              >
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    className="sg-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilter(f.id);
                      setFilterOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '9px 12px',
                      background: filter === f.id ? '#F7F6F4' : 'transparent',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: '#141414',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    {f.label}
                    {filter === f.id && <CheckIcon size={14} stroke="#E9041E" strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(20,20,20,0.08)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center', color: '#E9041E' }}>
            <Spinner size={20} />
          </div>
        ) : (
          items.map((l) => (
            <LinkRow
              key={l.code}
              item={l}
              copied={copiedCode === l.code}
              onOpen={() => router.push(`/links/${l.code}`)}
              onCopy={() => copy(l.code)}
              onToggleActive={() => toggleActive(l.code, !l.active)}
              onDelete={() => setPendingDelete(l.code)}
            />
          ))
        )}
        {noResults && (
          <div style={{ padding: 40, textAlign: 'center', color: '#8A8A8A', fontSize: 14.5 }}>
            Aucun lien ne correspond à votre recherche.
          </div>
        )}
        {hasMore && (
          <div style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#8A8A8A', fontSize: 13 }}>
            <Spinner size={16} stroke="#E9041E" />
            Chargement… ({frNumber(items.length)} sur {frNumber(total)})
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Supprimer le lien"
        message={
          <>
            Voulez-vous vraiment supprimer <strong>{pendingDelete ? shortUrl(pendingDelete) : ''}</strong> ? Cette
            action est irréversible et effacera aussi ses statistiques.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <AppShell>
      <LinksView />
    </AppShell>
  );
}
