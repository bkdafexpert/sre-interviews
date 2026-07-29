import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DAY_MS = 24 * 60 * 60 * 1000;

export type LinkFilter = 'tous' | 'actifs' | 'expires';

export interface ListParams {
  query?: string;
  filter?: LinkFilter;
  skip?: number;
  take?: number;
}

interface LinkRow {
  id: string;
  destination: string;
  createdAt: Date;
  expiresAt: Date | null;
  disabledAt: Date | null;
  _count: { clickEvents: number };
}

export type LinkStatus = 'active' | 'expired' | 'disabled';

function computeStatus(
  expiresAt: Date | null,
  disabledAt: Date | null,
  now = new Date(),
): { active: boolean; status: LinkStatus } {
  if (disabledAt) return { active: false, status: 'disabled' };
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return { active: false, status: 'expired' };
  return { active: true, status: 'active' };
}

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(link: LinkRow) {
    const { active, status } = computeStatus(link.expiresAt, link.disabledAt);
    return {
      code: link.id,
      destination: link.destination,
      createdAt: link.createdAt.toISOString(),
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
      active,
      status,
      clicks: link._count.clickEvents,
    };
  }

  private async generateCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      const existing = await this.prisma.link.findUnique({ where: { id: code } });
      if (!existing) return code;
    }
    throw new Error('Could not allocate a unique short code');
  }

  async create(userId: string, destination: string, expiresInDays: number | null) {
    const code = await this.generateCode();
    const expiresAt =
      expiresInDays && expiresInDays > 0 ? new Date(Date.now() + expiresInDays * DAY_MS) : null;
    const link = await this.prisma.link.create({
      data: { id: code, userId, destination, expiresAt },
      include: { _count: { select: { clickEvents: true } } },
    });
    return this.serialize(link);
  }

  async list(userId: string, params: ListParams) {
    const now = new Date();
    const take = Math.min(Math.max(params.take ?? 25, 1), 200);
    const skip = Math.max(params.skip ?? 0, 0);

    const and: Prisma.LinkWhereInput[] = [];
    if (params.filter === 'actifs') {
      // Active = not manually disabled and not past its expiry.
      and.push({ disabledAt: null }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
    } else if (params.filter === 'expires') {
      // Inactive = manually disabled OR expired by date.
      and.push({ OR: [{ disabledAt: { not: null } }, { expiresAt: { lte: now } }] });
    }
    const q = params.query?.trim();
    if (q) {
      // Match the code and the destination. Also match the last path segment, so pasting a full
      // short URL as shown in the UI (e.g. "localhost:3000/ZV3S3R") still finds it by its code.
      const terms = [q];
      const lastSegment = q.split('/').filter(Boolean).pop();
      if (lastSegment && lastSegment !== q) terms.push(lastSegment);
      and.push({
        OR: terms.flatMap((t) => [
          { id: { contains: t, mode: 'insensitive' } },
          { destination: { contains: t, mode: 'insensitive' } },
        ]),
      });
    }
    const where: Prisma.LinkWhereInput = { userId, ...(and.length ? { AND: and } : {}) };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.link.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { _count: { select: { clickEvents: true } } },
      }),
      this.prisma.link.count({ where }),
    ]);

    return { items: rows.map((r) => this.serialize(r)), total, skip, take };
  }

  async stats(userId: string) {
    const now = new Date();
    const links = await this.prisma.link.findMany({
      where: { userId },
      include: { _count: { select: { clickEvents: true } } },
    });

    const linkCount = links.length;
    const activeCount = links.filter((l) => computeStatus(l.expiresAt, l.disabledAt, now).active).length;
    const totalClicks = links.reduce((a, l) => a + l._count.clickEvents, 0);

    const sevenAgo = new Date(now.getTime() - 7 * DAY_MS);
    const fourteenAgo = new Date(now.getTime() - 14 * DAY_MS);
    const [clicks7, clicksPrev7] = await this.prisma.$transaction([
      this.prisma.clickEvent.count({
        where: { link: { userId }, createdAt: { gte: sevenAgo } },
      }),
      this.prisma.clickEvent.count({
        where: { link: { userId }, createdAt: { gte: fourteenAgo, lt: sevenAgo } },
      }),
    ]);
    const delta7 =
      clicksPrev7 === 0 ? null : ((clicks7 - clicksPrev7) / clicksPrev7) * 100;

    const best = [...links].sort((a, b) => b._count.clickEvents - a._count.clickEvents)[0];

    return {
      linkCount,
      activeCount,
      totalClicks,
      clicks7,
      delta7, // percentage vs previous 7 days, or null when there's no baseline
      best: best
        ? { code: best.id, destination: best.destination, clicks: best._count.clickEvents }
        : null,
    };
  }

  async detail(userId: string, code: string) {
    const link = await this.prisma.link.findFirst({
      where: { id: code, userId },
      include: { _count: { select: { clickEvents: true } } },
    });
    if (!link) throw new NotFoundException('Link not found');

    const events = await this.prisma.clickEvent.findMany({
      where: { linkId: code },
      select: { createdAt: true, source: true, device: true, country: true },
    });

    const now = new Date();
    // 30-day daily time series (index 0 = 29 days ago, index 29 = today).
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startDay.setDate(startDay.getDate() - 29);
    const series = new Array(30).fill(0) as number[];
    const sevenAgo = new Date(now.getTime() - 7 * DAY_MS);
    let clicks7 = 0;

    const tally = { source: new Map<string, number>(), device: new Map<string, number>(), country: new Map<string, number>() };
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

    for (const e of events) {
      const idx = Math.floor((e.createdAt.getTime() - startDay.getTime()) / DAY_MS);
      if (idx >= 0 && idx < 30) series[idx] += 1;
      if (e.createdAt.getTime() >= sevenAgo.getTime()) clicks7 += 1;
      bump(tally.source, e.source);
      bump(tally.device, e.device);
      bump(tally.country, e.country);
    }

    const total = events.length;
    const toBars = (m: Map<string, number>, topN: number) =>
      [...m.entries()]
        .map(([name, count]) => ({ name, count, pct: total ? Math.round((count / total) * 100) : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, topN);

    const { active, status } = computeStatus(link.expiresAt, link.disabledAt, now);
    return {
      code: link.id,
      destination: link.destination,
      createdAt: link.createdAt.toISOString(),
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
      active,
      status,
      clicks: total,
      clicks7,
      bestDay: series.length ? Math.max(...series) : 0,
      series,
      sources: toBars(tally.source, 5),
      devices: toBars(tally.device, 3),
      countries: toBars(tally.country, 5),
    };
  }

  private async ownedLink(userId: string, code: string) {
    const link = await this.prisma.link.findFirst({ where: { id: code, userId } });
    if (!link) throw new NotFoundException('Link not found');
    return link;
  }

  async remove(userId: string, code: string) {
    await this.ownedLink(userId, code);
    await this.prisma.link.delete({ where: { id: code } }); // click events cascade-delete
    return { ok: true, code };
  }

  async setActive(userId: string, code: string, active: boolean) {
    const link = await this.ownedLink(userId, code);
    const data: Prisma.LinkUpdateInput = { disabledAt: active ? null : new Date() };
    // Reactivating a link that had expired by date: give it a fresh 90-day lease so it truly
    // becomes active again (clearing disabledAt alone wouldn't be enough).
    if (active && link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      data.expiresAt = new Date(Date.now() + 90 * DAY_MS);
    }
    const updated = await this.prisma.link.update({
      where: { id: code },
      data,
      include: { _count: { select: { clickEvents: true } } },
    });
    return this.serialize(updated);
  }
}
