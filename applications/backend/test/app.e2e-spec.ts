import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// End-to-end smoke test against a REAL Postgres in demo auth mode. The runner is expected to have
// pushed the schema and seeded the demo user before this runs. Env: AUTH_PROVIDER=demo,
// JWT_SECRET=test-secret, DATABASE_URL pointing at the DB.
describe('Sgcut API (e2e, demo auth)', () => {
  let app: INestApplication;
  let sessionCookie: string;
  let createdCode: string;

  beforeAll(async () => {
    // AUTH_PROVIDER is read lazily by the guard, so setting it here is honoured. JWT sign/verify use
    // the same in-process key regardless of value, so the flow is self-consistent.
    process.env.AUTH_PROVIDER = process.env.AUTH_PROVIDER ?? 'demo';
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    // Mirror main.ts: cookie parsing + the same global ValidationPipe.
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /api/health → 200 {status:"ok"}', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/v1/auth/google → sets the sgcut_token cookie', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/google').send({});
    expect([200, 201]).toContain(res.status);

    const raw = res.headers['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : [raw];
    const token = cookies.find((c) => c && c.startsWith('sgcut_token='));
    expect(token).toBeDefined();
    sessionCookie = (token as string).split(';')[0];
    expect(sessionCookie).toContain('sgcut_token=');
  });

  it('POST /api/v1/links → returns a link with a code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/links')
      .set('Cookie', sessionCookie)
      .send({ destination: 'https://example.com' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.code).toBeTruthy();
    expect(res.body.destination).toBe('https://example.com');
    createdCode = res.body.code;
  });

  it('GET /:code → 302 to the destination', async () => {
    const res = await request(app.getHttpServer()).get(`/${createdCode}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com');
  });

  it('GET /api/v1/links/stats → totals reflect ≥1 link and ≥1 click', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/links/stats')
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(res.body.linkCount).toBeGreaterThanOrEqual(1);
    expect(res.body.totalClicks).toBeGreaterThanOrEqual(1);
  });
});
