'use client';

// Auth-provider abstraction. In "demo" mode auth is a backend httpOnly-cookie session (default,
// runs offline). In "cognito" mode the browser authenticates with Cognito via aws-amplify and the
// API is called with a Bearer ID token. aws-amplify is imported dynamically so it is never loaded
// or evaluated in demo mode (and never during SSR).

export const AUTH_PROVIDER = (process.env.NEXT_PUBLIC_AUTH_PROVIDER === 'cognito'
  ? 'cognito'
  : 'demo') as 'demo' | 'cognito';

export const isCognito = AUTH_PROVIDER === 'cognito';

let configured = false;
async function ensureAmplify() {
  if (configured) return;
  const { Amplify } = await import('aws-amplify');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
          userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
          loginWith: {
            oauth: {
              domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN!, // e.g. sgcut.auth.<region>.amazoncognito.com
              scopes: ['openid', 'email', 'profile'],
              redirectSignIn: [`${appUrl}/`],
              redirectSignOut: [`${appUrl}/login`],
              responseType: 'code',
            },
          },
        },
      },
    },
    { ssr: true },
  );
  configured = true;
}

// Returns the Cognito ID token to send as a Bearer, or null in demo mode (cookie is used instead).
export async function getIdToken(): Promise<string | null> {
  if (!isCognito) return null;
  await ensureAmplify();
  const { fetchAuthSession } = await import('aws-amplify/auth');
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

// Clears leftover Amplify OAuth in-progress markers from a previously aborted/failed redirect.
// Without this, a stale `oauthSignIn` flag makes signInWithRedirect throw "already in progress".
export function clearStaleOAuthState(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => /\.(oauthSignIn|inflightOAuth|oauthState|oauthPKCE)$/.test(k))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* localStorage unavailable */
  }
}

// Wipes any existing Cognito session (localStorage + cookies, since we use ssr cookie storage).
// Used to recover from a stuck/rejected session so a fresh sign-in can start.
export function clearCognitoSession(): void {
  const isCog = (k: string) => k.startsWith('CognitoIdentityServiceProvider.');
  try {
    Object.keys(localStorage).filter(isCog).forEach((k) => localStorage.removeItem(k));
  } catch {}
  try {
    document.cookie.split('; ').forEach((c) => {
      const name = c.split('=')[0];
      if (isCog(name)) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
  } catch {}
}

// Starts sign-in. Cognito redirects the whole page to the Hosted UI / Google, so this does not
// return in that case. In demo mode it is a no-op (the caller performs the demo login).
export async function startLogin(): Promise<void> {
  if (!isCognito) return;
  await ensureAmplify();
  clearStaleOAuthState(); // don't let a prior aborted attempt block a fresh one
  const { signInWithRedirect } = await import('aws-amplify/auth');
  try {
    await signInWithRedirect({ provider: 'Google' });
  } catch (e: any) {
    // A stuck/rejected session makes Amplify think we're already signed in — clear it and retry.
    if (e?.name === 'UserAlreadyAuthenticatedException') {
      clearCognitoSession();
      await signInWithRedirect({ provider: 'Google' });
    } else {
      throw e;
    }
  }
}

export async function endSession(): Promise<void> {
  if (!isCognito) return;
  await ensureAmplify();
  const { signOut } = await import('aws-amplify/auth');
  await signOut(); // redirects to redirectSignOut (/login)
}

// Subscribe to Cognito redirect failures (e.g. redirect_mismatch) so the UI can stop spinning
// and show the reason instead of hanging. Returns an unsubscribe function.
export async function onAuthFailure(cb: (message: string) => void): Promise<() => void> {
  if (!isCognito) return () => {};
  await ensureAmplify();
  const { Hub } = await import('aws-amplify/utils');
  return Hub.listen('auth', ({ payload }) => {
    if (payload.event === 'signInWithRedirect_failure') {
      const msg = (payload as any).data?.error?.message ?? 'Échec de la connexion Cognito.';
      cb(msg);
    }
  });
}
