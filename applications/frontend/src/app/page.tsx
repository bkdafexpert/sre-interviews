'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LinkRow } from '@/components/LinkRow';
import { CheckIcon, CopyIcon, LinkIcon } from '@/components/icons';
import { api, LinkItem } from '@/lib/api';
import { destShort, shortUrl } from '@/lib/format';
import { useCopy } from '@/lib/useCopy';

const EASE = 'cubic-bezier(0.16,1,0.3,1)';

function ShortenView() {
  const router = useRouter();
  const { copiedCode, copy } = useCopy();
  const [url, setUrl] = useState('');
  const [focused, setFocused] = useState(false);
  const [result, setResult] = useState<LinkItem | null>(null);
  const [recent, setRecent] = useState<LinkItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function loadRecent() {
    try {
      const r = await api.listLinks({ take: 4 });
      setRecent(r.items);
    } catch {
      /* ignore */
    }
  }

  async function toggleActive(code: string, active: boolean) {
    try {
      await api.setLinkActive(code, active);
      loadRecent();
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
      loadRecent();
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    loadRecent();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // The reference design defaults new links to a 90-day lifetime.
      const link = await api.createLink(url.trim(), 90);
      setResult(link);
      setUrl('');
      loadRecent();
    } catch (err: any) {
      setError(err?.message ?? 'Impossible de raccourcir ce lien.');
    } finally {
      setSubmitting(false);
    }
  }

  const glow = focused ? 1 : 0;

  return (
    <div className="fade-up" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 24 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E9041E' }}>
          Raccourcisseur
        </p>
        <h1 style={{ margin: 0, fontSize: 'clamp(28px,7vw,40px)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.05 }}>
          Raccourcissez votre lien.
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: '#5A5A5A' }}>Collez une URL, nous nous occupons du reste.</p>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ position: 'relative' }}>
          {/* AI-style animated glow behind the input, revealed on focus */}
          <div
            style={{
              position: 'absolute',
              inset: -5,
              borderRadius: 999,
              background: 'linear-gradient(90deg,#FF9A5A,#FF4D8D,#B44DFF,#4D9EFF,#FF9A5A)',
              filter: 'blur(10px)',
              animation: 'aiHue 9s linear infinite',
              opacity: glow,
              transition: `opacity 360ms ${EASE}`,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: -1.5,
              borderRadius: 999,
              overflow: 'hidden',
              opacity: glow,
              transition: `opacity 360ms ${EASE}`,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 1600,
                height: 1600,
                margin: '-800px 0 0 -800px',
                background: 'conic-gradient(from 0deg,#FF9A5A,#FF4D8D,#B44DFF,#4D9EFF,#FF9A5A)',
                animation: 'spin 8s linear infinite',
                opacity: 0.55,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 1600,
                height: 1600,
                margin: '-800px 0 0 -800px',
                background:
                  'conic-gradient(from 180deg,transparent 0deg,transparent 270deg,rgba(77,158,255,0.7) 320deg,rgba(180,77,255,0.9) 345deg,transparent 360deg)',
                animation: 'spin 4.5s linear infinite',
                filter: 'blur(4px)',
              }}
            />
          </div>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#FFFFFF',
              borderRadius: 999,
              padding: '8px 8px 8px 22px',
              boxShadow: '0 4px 20px rgba(20,20,20,0.12)',
            }}
          >
            <LinkIcon size={18} stroke="#8A8A8A" style={{ flex: 'none' }} />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="https://votre-site.fr/une-page-avec-une-tres-longue-adresse"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 15,
                color: '#141414',
                padding: '8px 0',
              }}
            />
            <button
              type="submit"
              className="sg-btn-primary"
              disabled={submitting}
              style={{
                padding: '12px 26px',
                background: '#E9041E',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 600,
                cursor: submitting ? 'default' : 'pointer',
                flex: 'none',
              }}
            >
              {submitting ? 'Raccourcissement…' : 'Raccourcir'}
            </button>
          </div>
        </div>
        {error && <p style={{ margin: 0, fontSize: 13.5, color: '#B33A2E' }}>{error}</p>}
      </form>

      {result && (
        <div
          className="fade-up"
          style={{
            background: '#141414',
            borderRadius: 12,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            borderTop: '6px solid #E9041E',
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E9041E' }}>
            Votre lien court est prêt
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              {shortUrl(result.code)}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="sg-btn-primary"
                onClick={() => copy(result.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  background: '#E9041E',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copiedCode === result.code ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
                {copiedCode === result.code ? 'Copié !' : 'Copier'}
              </button>
              <button
                className="sg-btn-ghost"
                onClick={() => router.push('/links')}
                style={{
                  padding: '10px 18px',
                  background: 'transparent',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Voir mes liens
              </button>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: '#B8B8B8', wordBreak: 'break-all' }}>
            Redirige vers : {destShort(result.destination)}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Derniers liens</h3>
          <Link href="/links" style={{ fontSize: 13.5 }}>
            Voir tout →
          </Link>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(20,20,20,0.08)', overflow: 'hidden' }}>
          {recent.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8A8A8A', fontSize: 14.5 }}>
              Aucun lien pour l’instant — raccourcissez votre première URL ci-dessus.
            </div>
          ) : (
            recent.map((l) => (
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
        </div>
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
      <ShortenView />
    </AppShell>
  );
}
