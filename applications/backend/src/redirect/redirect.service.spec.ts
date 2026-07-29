import { GoneException, NotFoundException } from '@nestjs/common';
import { RedirectService } from './redirect.service';

// Pure unit test — PrismaService is mocked, so no database is required.
describe('RedirectService', () => {
  function makeService(link: unknown, create = jest.fn().mockResolvedValue({})) {
    const prisma = {
      link: { findUnique: jest.fn().mockResolvedValue(link) },
      clickEvent: { create },
    };
    return { service: new RedirectService(prisma as never), create };
  }

  it('resolves an active link, records a classified click and returns the destination', async () => {
    const link = {
      id: 'abc123',
      destination: 'https://example.com',
      disabledAt: null,
      expiresAt: null,
    };
    const { service, create } = makeService(link);

    const dest = await service.resolve('abc123', {
      referer: 'https://www.instagram.com/',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS) Mobile',
      countryCode: 'BE',
    });

    expect(dest).toBe('https://example.com');
    expect(create).toHaveBeenCalledTimes(1);
    const { data } = create.mock.calls[0][0];
    expect(data).toMatchObject({
      linkId: 'abc123',
      source: 'Instagram',
      device: 'Mobile',
      country: 'Belgique',
    });
  });

  it('throws NotFound when the code is unknown', async () => {
    const { service } = makeService(null);
    await expect(service.resolve('nope', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws Gone when the link is disabled', async () => {
    const { service } = makeService({
      id: 'x',
      destination: 'https://example.com',
      disabledAt: new Date(),
      expiresAt: null,
    });
    await expect(service.resolve('x', {})).rejects.toBeInstanceOf(GoneException);
  });

  it('throws Gone when the link has expired', async () => {
    const { service } = makeService({
      id: 'y',
      destination: 'https://example.com',
      disabledAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.resolve('y', {})).rejects.toBeInstanceOf(GoneException);
  });
});
