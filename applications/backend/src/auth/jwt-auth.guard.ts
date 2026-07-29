import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Request } from 'express';
import { AuthService } from './auth.service';

export const AUTH_COOKIE = 'sgcut_token';

function authProvider(): 'demo' | 'cognito' {
  return process.env.AUTH_PROVIDER === 'cognito' ? 'cognito' : 'demo';
}

// Lazily-created Cognito verifier (caches the pool's JWKS internally).
let cognitoVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
function getCognitoVerifier() {
  if (!cognitoVerifier) {
    cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      tokenUse: 'id', // ID token → carries email/name for the user upsert
      clientId: process.env.COGNITO_CLIENT_ID!,
    });
  }
  return cognitoVerifier;
}

// Authenticates a request and attaches `req.user`. In demo mode it reads the httpOnly session
// cookie (our own JWT); in cognito mode it verifies a Cognito ID token from the Authorization header.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    return authProvider() === 'cognito'
      ? this.authenticateCognito(req)
      : this.authenticateCookie(req);
  }

  private async authenticateCookie(req: Request): Promise<boolean> {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) throw new UnauthorizedException('Not authenticated');
    try {
      const payload = await this.jwt.verifyAsync(token);
      (req as any).user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid session');
    }
  }

  private async authenticateCognito(req: Request): Promise<boolean> {
    const header = req.headers['authorization'];
    const bearer = typeof header === 'string' ? header.replace(/^Bearer\s+/i, '').trim() : '';
    if (!bearer) throw new UnauthorizedException('Missing bearer token');

    let claims: Record<string, any>;
    try {
      claims = await getCognitoVerifier().verify(bearer);
    } catch {
      throw new UnauthorizedException('Invalid Cognito token');
    }

    // The subject is always present and stable; use it so a valid session is never locked out.
    const sub = ((claims.sub as string) || (claims['cognito:username'] as string) || '').trim();
    if (!sub) throw new UnauthorizedException('Cognito token has no subject');

    const realEmail = (claims.email as string)?.trim().toLowerCase();
    // Fall back to a synthesized address when the IdP email isn't mapped into the token, so login
    // still works. (Fix the Cognito attribute mapping to get the real email/name — see README.)
    const email = realEmail || `${sub}@users.sgcut.local`;
    // Never surface the raw provider id (e.g. "google_1149…") as a display name.
    const name =
      (claims.name as string)?.trim() ||
      [claims.given_name, claims.family_name].filter(Boolean).join(' ').trim() ||
      realEmail?.split('@')[0] ||
      'Utilisateur';

    const { user } = await this.auth.upsertExternal(email, name);
    (req as any).user = { id: user.id, email: user.email };
    return true;
  }
}
