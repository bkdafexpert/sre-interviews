import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthProfile {
  email?: string;
  name?: string;
}

// The design's login screen offers "Continuer avec Google". A real Google OAuth exchange needs
// client credentials that aren't part of this exercise, so this service treats the sign-in as a
// trusted profile hand-off: it upserts the user and issues our own session JWT. Swapping in a real
// OAuth callback later only means verifying the Google token before calling `signIn`.
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private initialsFor(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'SG';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Upsert a user by email and refresh their display name/initials, then mint our session JWT.
  private async upsert(email: string, name: string) {
    const initials = this.initialsFor(name);
    const user = await this.prisma.user.upsert({
      where: { email },
      update: { name, initials }, // keep the displayed identity in sync with the provider
      create: { email, name, initials },
    });
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { user: this.publicUser(user), token };
  }

  // Demo sign-in: falls back to the seeded demo identity when no profile is supplied.
  async signIn(profile: AuthProfile) {
    const email = (profile.email ?? 'camille@atelier.fr').trim().toLowerCase();
    const name = profile.name?.trim() || 'Camille Dupont';
    return this.upsert(email, name);
  }

  // Federated sign-in (Cognito): the email is authoritative — no demo fallback.
  async upsertExternal(email: string, name: string) {
    return this.upsert(email.trim().toLowerCase(), name.trim());
  }

  async userById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.publicUser(user) : null;
  }

  publicUser(user: { id: string; email: string; name: string; initials: string }) {
    return { id: user.id, email: user.email, name: user.name, initials: user.initials };
  }
}
