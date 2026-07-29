'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clearStaleOAuthState, isCognito, onAuthFailure, startLogin } from '@/lib/auth';
import { GoogleIcon, Spinner } from '@/components/icons';

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If a session already exists, skip straight to the app.
  useEffect(() => {
    api.me().then(() => router.replace('/')).catch(() => {});
  }, [router]);

  // Clear any leftover OAuth markers from a previous aborted attempt, and surface Cognito redirect
  // failures (e.g. redirect_mismatch / invalid_scope) instead of hanging on the spinner.
  useEffect(() => {
    clearStaleOAuthState();
    let unsub = () => {};
    onAuthFailure((msg) => {
      setError(msg);
      setBusy(false);
    }).then((u) => (unsub = u));
    return () => unsub();
  }, []);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      if (isCognito) {
        await startLogin(); // redirects the page to Cognito / Google
        // If we're still here shortly after, the redirect didn't happen (e.g. stale in-progress
        // state or a config error) — reset the spinner so the button isn't stuck.
        setTimeout(() => setBusy(false), 2500);
        return;
      }
      await api.loginWithGoogle();
      router.replace('/');
    } catch (e: any) {
      setError(e?.message ? `La connexion a échoué : ${e.message}` : 'La connexion a échoué. Réessayez.');
      setBusy(false);
    }
  }

  return (
    <div className="sg-login">
      <div className="sg-login-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark-cream.svg" alt="" width={34} height={34} style={{ display: 'block' }} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Sgcut</span>
        </div>
        <div className="sg-login-pitch">
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(30px,8vw,56px)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              color: '#FFFFFF',
            }}
          >
            Vos liens, <span style={{ color: '#E9041E' }}>en plus court.</span>
          </h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: '#B8B8B8' }}>
            Raccourcissez vos URLs, partagez-les partout, et mesurez chaque clic : sources, appareils,
            pays — tout est là.
          </p>
        </div>
        <p className="sg-login-foot" style={{ margin: 0, fontSize: 13, color: '#8A8A8A' }}>
          Raccourcisseur d’URLs
        </p>
      </div>

      <div className="sg-login-side">
        <div
          className="fade-up"
          style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 className="sg-login-title" style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2 }}>
              Connexion ou inscription.
            </h2>
            <p className="sg-login-sub" style={{ margin: 0, fontSize: 15 }}>
              Connectez-vous avec votre compte Google pour retrouver vos liens et vos statistiques.
            </p>
          </div>
          <button
            className="sg-google"
            onClick={connect}
            disabled={busy}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '13px 20px',
              background: '#FFFFFF',
              border: 'none',
              borderRadius: 999,
              boxShadow: '0 2px 12px rgba(20,20,20,0.12)',
              fontSize: 15,
              fontWeight: 600,
              color: '#141414',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.75 : 1,
            }}
          >
            {busy ? <Spinner size={18} stroke="#141414" /> : <GoogleIcon size={18} />}
            {busy ? 'Connexion…' : 'Continuer avec Google'}
          </button>
          {error && <p style={{ margin: 0, fontSize: 13, color: '#B33A2E', textAlign: 'center' }}>{error}</p>}
          <p className="sg-login-note" style={{ margin: 0, fontSize: 12.5, textAlign: 'center' }}>
            Votre compte est créé automatiquement à la première connexion.
          </p>
        </div>
      </div>
    </div>
  );
}
