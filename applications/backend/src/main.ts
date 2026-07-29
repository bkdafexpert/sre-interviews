import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string };

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // The API controllers carry their own `api/...` prefixes; the short-link redirector lives at the
  // root (`/:code`) so a short URL reads like https://sgcut.co/<code>. A root single-segment route
  // can't shadow the two-segment /api/* routes, so no global prefix (and no greedy exclude) is used.

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );

  // The frontend proxies /api through same-origin rewrites, but we also allow direct
  // cross-origin calls (with credentials) from the configured frontend URL.
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl.split(','),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // OpenAPI / Swagger. Built from decorator metadata only (no DB needed), so the docs are available
  // as soon as the HTTP server is up — even before Prisma connects. UI at /api/docs, JSON at
  // /api/docs-json. Both auth modes are documented: a Bearer ID token (cognito) and the httpOnly
  // session cookie `sgcut_token` (demo).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sgcut API')
    .setDescription(
      'URL shortener API — create short links, follow redirects and read click analytics.',
    )
    .setVersion(version)
    .addBearerAuth()
    .addCookieAuth('sgcut_token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Sgcut API listening on http://0.0.0.0:${port}`);
}

bootstrap();
