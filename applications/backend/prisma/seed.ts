/**
 * Seeds a demo account so the UI is populated on first run.
 *
 * Analytics in this app are aggregated from real ClickEvent rows, so the seed generates click
 * events distributed across the last 30 days (shaped by a per-link curve) with sampled
 * source / device / country values. Counts are capped per link to keep seeding fast.
 *
 * Idempotent: if the demo user already has links, seeding is skipped.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const EVENTS_CAP = 260;

// Deterministic LCG so repeated seeds produce identical data.
let _seed = 1337;
function rnd(): number {
  _seed = (_seed * 1103515245 + 12345) % 2147483648;
  return _seed / 2147483648;
}

type Weighted = [string, number][];

function pickWeighted(pairs: Weighted): string {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * total;
  for (const [name, w] of pairs) {
    r -= w;
    if (r <= 0) return name;
  }
  return pairs[pairs.length - 1][0];
}

interface LinkSpec {
  destination: string;
  createdDaysAgo: number;
  expiresInDays: number | null; // null = never; negative = already expired
  targetClicks: number;
  series: number[]; // shape over time, oldest → newest
  sources: Weighted;
  devices: Weighted;
  countries: Weighted;
}

const CURATED: LinkSpec[] = [
  {
    destination: 'https://www.atelier-lumiere.fr/collections/nouveautes-printemps-2026',
    createdDaysAgo: 15,
    expiresInDays: 90,
    targetClicks: 1284,
    series: [22, 30, 26, 38, 34, 45, 41, 52, 48, 60, 56, 66, 62, 74, 70, 80, 76, 88, 84, 95],
    sources: [['Instagram', 38], ['Newsletter', 26], ['LinkedIn', 20], ['Accès direct', 16]],
    devices: [['Mobile', 64], ['Desktop', 31], ['Tablette', 5]],
    countries: [['France', 71], ['Belgique', 12], ['Suisse', 10], ['Canada', 7]],
  },
  {
    destination: 'https://blog.atelier-lumiere.fr/articles/comment-choisir-son-eclairage-de-bureau',
    createdDaysAgo: 24,
    expiresInDays: null,
    targetClicks: 862,
    series: [40, 36, 44, 38, 48, 42, 50, 44, 52, 46, 54, 48, 50, 44, 46, 40, 42, 38, 40, 36],
    sources: [['LinkedIn', 44], ['Google', 28], ['Newsletter', 18], ['Accès direct', 10]],
    devices: [['Desktop', 58], ['Mobile', 37], ['Tablette', 5]],
    countries: [['France', 66], ['Suisse', 14], ['Belgique', 12], ['Maroc', 8]],
  },
  {
    destination: 'https://www.atelier-lumiere.fr/campagnes/newsletter-juillet-2026',
    createdDaysAgo: 26,
    expiresInDays: 65,
    targetClicks: 640,
    series: [10, 80, 64, 50, 40, 34, 28, 24, 20, 18, 16, 14, 13, 12, 11, 10, 10, 9, 9, 8],
    sources: [['Newsletter', 82], ['Accès direct', 12], ['Instagram', 6]],
    devices: [['Mobile', 71], ['Desktop', 26], ['Tablette', 3]],
    countries: [['France', 78], ['Belgique', 10], ['Suisse', 8], ['Canada', 4]],
  },
  {
    destination: 'https://www.atelier-lumiere.fr/tarifs',
    createdDaysAgo: 39,
    expiresInDays: null,
    targetClicks: 418,
    series: [12, 14, 13, 16, 15, 18, 17, 20, 19, 22, 21, 24, 23, 26, 25, 28, 27, 30, 29, 32],
    sources: [['Google', 46], ['Accès direct', 30], ['LinkedIn', 24]],
    devices: [['Desktop', 62], ['Mobile', 34], ['Tablette', 4]],
    countries: [['France', 74], ['Suisse', 12], ['Belgique', 9], ['Autres', 5]],
  },
  {
    destination: 'https://events.atelier-lumiere.fr/webinaire-eclairage-durable-juin-2026',
    createdDaysAgo: 55,
    expiresInDays: -27, // expired
    targetClicks: 1976,
    series: [30, 60, 90, 120, 150, 130, 110, 140, 160, 180, 150, 120, 90, 60, 40, 20, 10, 5, 2, 1],
    sources: [['LinkedIn', 52], ['Newsletter', 31], ['Accès direct', 17]],
    devices: [['Desktop', 67], ['Mobile', 29], ['Tablette', 4]],
    countries: [['France', 62], ['Belgique', 15], ['Suisse', 13], ['Canada', 10]],
  },
  {
    destination: 'https://www.atelier-lumiere.fr/recrutement/responsable-boutique-lyon',
    createdDaysAgo: 68,
    expiresInDays: -12, // expired
    targetClicks: 233,
    series: [20, 24, 22, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1],
    sources: [['LinkedIn', 68], ['Indeed', 22], ['Accès direct', 10]],
    devices: [['Mobile', 52], ['Desktop', 45], ['Tablette', 3]],
    countries: [['France', 94], ['Belgique', 4], ['Autres', 2]],
  },
];

const GEN_PATHS = [
  'collections/ete-2026',
  'blog/guide-luminaires',
  'promo/soldes-flash',
  'catalogue/suspensions',
  'evenements/portes-ouvertes',
  'newsletter/aout-2026',
  'produits/lampe-atelier-n7',
  'guide/entretien-laiton',
  'campagnes/rentree-2026',
  'tarifs/professionnels',
];
const GEN_SUBS = ['www', 'blog', 'shop', 'events'];

function generatedSpecs(n: number): LinkSpec[] {
  return Array.from({ length: n }, (_, i) => {
    const active = rnd() > 0.3;
    const target = Math.floor(rnd() * 900) + 40;
    let v = 20 + rnd() * 30;
    const series = Array.from({ length: 20 }, () => {
      v = Math.max(2, v + (rnd() - 0.5) * 16);
      return Math.round(v);
    });
    const createdDaysAgo = 3 + Math.floor(rnd() * 60);
    return {
      destination: `https://${GEN_SUBS[i % GEN_SUBS.length]}.atelier-lumiere.fr/${GEN_PATHS[i % GEN_PATHS.length]}`,
      createdDaysAgo,
      expiresInDays: active ? (rnd() > 0.5 ? null : 120) : -Math.floor(rnd() * 20 + 1),
      targetClicks: target,
      series,
      sources: [['LinkedIn', 40], ['Newsletter', 30], ['Google', 20], ['Accès direct', 10]] as Weighted,
      devices: [['Mobile', 55], ['Desktop', 40], ['Tablette', 5]] as Weighted,
      countries: [['France', 72], ['Belgique', 12], ['Suisse', 10], ['Canada', 6]] as Weighted,
    };
  });
}

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeCode(): string {
  let c = '';
  for (let i = 0; i < 6; i++) c += CODE_ALPHABET[Math.floor(rnd() * CODE_ALPHABET.length)];
  return c;
}

function buildEvents(linkId: string, spec: LinkSpec, now: number): Prisma.ClickEventCreateManyInput[] {
  const count = Math.min(spec.targetClicks, EVENTS_CAP);
  const windowDays = Math.max(1, Math.min(30, spec.createdDaysAgo + 1));
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const weightAt = (offset: number): number => {
    // offset 0 = today (newest) → end of series; offset windowDays-1 = oldest → start of series
    if (windowDays === 1) return spec.series[spec.series.length - 1] || 1;
    const frac = (windowDays - 1 - offset) / (windowDays - 1);
    const idx = Math.round(frac * (spec.series.length - 1));
    return (spec.series[idx] || 1) + 0.5;
  };
  const weights = Array.from({ length: windowDays }, (_, off) => weightAt(off));
  const weightTotal = weights.reduce((a, w) => a + w, 0);

  const events: Prisma.ClickEventCreateManyInput[] = [];
  for (let i = 0; i < count; i++) {
    let r = rnd() * weightTotal;
    let off = 0;
    for (; off < windowDays; off++) {
      r -= weights[off];
      if (r <= 0) break;
    }
    if (off >= windowDays) off = windowDays - 1;
    const dayStart = startToday.getTime() - off * DAY_MS;
    const ts = dayStart + Math.floor(rnd() * DAY_MS);
    events.push({
      linkId,
      createdAt: new Date(Math.min(ts, now)),
      source: pickWeighted(spec.sources),
      device: pickWeighted(spec.devices),
      country: pickWeighted(spec.countries),
    });
  }
  return events;
}

async function main() {
  const email = 'camille@atelier.fr';
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Camille Dupont', initials: 'CD' },
  });

  const existing = await prisma.link.count({ where: { userId: user.id } });
  if (existing > 0) {
    console.log(`Seed skipped — demo user already has ${existing} links.`);
    return;
  }

  const now = Date.now();
  const specs = [...CURATED, ...generatedSpecs(12)];
  const usedCodes = new Set<string>();
  const allEvents: Prisma.ClickEventCreateManyInput[] = [];

  for (const spec of specs) {
    let code = makeCode();
    while (usedCodes.has(code)) code = makeCode();
    usedCodes.add(code);

    const createdAt = new Date(now - spec.createdDaysAgo * DAY_MS);
    const expiresAt =
      spec.expiresInDays === null ? null : new Date(now + spec.expiresInDays * DAY_MS);

    await prisma.link.create({
      data: { id: code, userId: user.id, destination: spec.destination, createdAt, expiresAt },
    });
    allEvents.push(...buildEvents(code, spec, now));
  }

  // Bulk insert click events in chunks.
  for (let i = 0; i < allEvents.length; i += 1000) {
    await prisma.clickEvent.createMany({ data: allEvents.slice(i, i + 1000) });
  }

  console.log(
    `Seeded ${specs.length} links and ${allEvents.length} click events for ${user.email}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
