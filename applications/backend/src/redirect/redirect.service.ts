import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Maps a request referrer host to one of the design's source buckets.
function classifySource(referer?: string): string {
  if (!referer) return 'Accès direct';
  let host = referer;
  try {
    host = new URL(referer).hostname;
  } catch {
    /* keep raw string */
  }
  host = host.toLowerCase();
  if (host.includes('instagram')) return 'Instagram';
  if (host.includes('linkedin') || host.includes('lnkd.in')) return 'LinkedIn';
  if (host.includes('google')) return 'Google';
  if (host.includes('facebook') || host.includes('fb.')) return 'Facebook';
  if (host.includes('twitter') || host.includes('t.co') || host.includes('x.com')) return 'X / Twitter';
  if (host.includes('mail') || host.includes('newsletter') || host.includes('mailchi')) return 'Newsletter';
  return 'Autres sites';
}

function classifyDevice(userAgent?: string): string {
  const ua = (userAgent ?? '').toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'Tablette';
  if (/mobi|iphone|android.*mobile|phone/.test(ua)) return 'Mobile';
  return 'Desktop';
}

// ISO-3166 alpha-2 (as sent by CDN headers such as cf-ipcountry) to French country names.
const COUNTRY_NAMES: Record<string, string> = {
  FR: 'France',
  BE: 'Belgique',
  CH: 'Suisse',
  CA: 'Canada',
  MA: 'Maroc',
  LU: 'Luxembourg',
  DE: 'Allemagne',
  GB: 'Royaume-Uni',
  US: 'États-Unis',
};

function classifyCountry(code?: string): string {
  if (!code) return 'France';
  return COUNTRY_NAMES[code.toUpperCase()] ?? 'Autres';
}

export interface RedirectMeta {
  referer?: string;
  userAgent?: string;
  countryCode?: string;
}

@Injectable()
export class RedirectService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(code: string, meta: RedirectMeta): Promise<string> {
    const link = await this.prisma.link.findUnique({ where: { id: code } });
    if (!link) throw new NotFoundException('Ce lien court n’existe pas.');
    if (link.disabledAt) throw new GoneException('Ce lien a été désactivé.');
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('Ce lien a expiré.');
    }

    await this.prisma.clickEvent.create({
      data: {
        linkId: link.id,
        source: classifySource(meta.referer),
        device: classifyDevice(meta.userAgent),
        country: classifyCountry(meta.countryCode),
      },
    });

    return link.destination;
  }
}
