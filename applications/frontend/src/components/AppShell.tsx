'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, User } from '@/lib/api';
import { isCognito, endSession } from '@/lib/auth';
import { ChevronDown, LogoutIcon, Spinner } from './icons';

function FullScreenLoader() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#E9041E',
      }}
    >
      <Spinner size={26} />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .me()
      .then((r) => {
        if (alive) setUser(r.user);
      })
      .catch(() => router.replace('/login'))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  async function logout() {
    if (isCognito) {
      await endSession(); // Amplify signs out and redirects to /login
      return;
    }
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  if (loading || !user) return <FullScreenLoader />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="sg-header">
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <button
            className="sg-avatar"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            title={user.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 6,
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                flex: 'none',
                borderRadius: 999,
                background: '#E9041E',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13.5,
                fontWeight: 700,
              }}
            >
              {user.initials}
            </div>
            <ChevronDown
              size={15}
              stroke="#8A8A8A"
              style={{
                transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1)',
                transform: menuOpen ? 'rotate(180deg)' : 'none',
              }}
            />
          </button>
          {menuOpen && (
            <div
              className="fade-up"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: 220,
                background: '#FFFFFF',
                borderRadius: 12,
                boxShadow: '0 6px 16px rgba(20,20,20,0.10),0 2px 4px rgba(20,20,20,0.06)',
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                zIndex: 20,
              }}
            >
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', marginBottom: 4 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: 12, color: '#8A8A8A' }}>
                  {user.email.endsWith('@users.sgcut.local') ? 'Compte Google' : user.email}
                </div>
              </div>
              <button
                className="sg-menu-item"
                onClick={logout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: '#B33A2E',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <LogoutIcon size={15} />
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="sg-main">
        <div className="sg-container">{children}</div>
      </main>
    </div>
  );
}
