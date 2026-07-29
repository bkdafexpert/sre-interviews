# Sgcut — Raccourcisseur d'URL

A Société Générale–branded URL shortener, implemented from the Claude Design project
`sgcut.dc.html`. **NestJS** API + **Next.js** UI + **PostgreSQL**, all orchestrated with Docker.

The UI faithfully reproduces the reference design: a Google sign-in screen and a three-view app
(**Raccourcir** / **Mes liens** / **détail d'un lien**) with click analytics — sources, devices,
countries and a 30-day time series.

## Run it (Docker only)

Nothing is installed on the host — everything builds and runs in containers.

```bash
docker compose up --build
```

Then open:

| URL | What |
| --- | --- |
| http://localhost:3000 | The app (redirects to `/login` until you sign in) |
| http://localhost:4000/api/health | API health check |
| http://localhost:3000/&lt;code&gt; | A short link — resolves at the app's own host (also on the backend at http://localhost:4000/&lt;code&gt;) |

On first boot the backend creates the schema (`prisma db push`) and seeds a demo account with links
and ~30 days of click events, so the dashboards are populated immediately.

**Sign in:** click **Continuer avec Google**. See the note on auth below.

To stop and wipe data: `docker compose down -v`.

## Architecture

```
applications/
├── docker-compose.yml        # postgres + backend + frontend
├── backend/                  # NestJS API (Prisma + PostgreSQL)
│   ├── prisma/schema.prisma  # User · Link · ClickEvent
│   ├── prisma/seed.ts        # demo account + realistic click events
│   └── src/
│       ├── auth/             # session cookie (JWT), demo Google sign-in
│       ├── links/            # create / list / stats / detail (+ analytics aggregation)
│       └── redirect/         # GET /<code> → 302 + click tracking
└── frontend/                 # Next.js App Router UI
    ├── public/               # SG brand assets
    └── src/
        ├── app/              # /login, / (raccourcir), /links, /links/[code]
        ├── components/       # AppShell (header + auth guard), LinkRow, icons
        └── lib/              # api client, formatting, clipboard hook
```

The frontend calls the API through same-origin Next rewrites (`/api/* → backend`), so the httpOnly
session cookie works without CORS gymnastics.

## API

All app routes require the session cookie. The short-link redirect is public.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/google` | Sign in (see note) — sets the session cookie |
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/auth/logout` | Clear the session |
| POST | `/api/v1/links` | Create a short link `{ destination, expiresInDays? }` |
| GET | `/api/v1/links?query=&filter=tous\|actifs\|expires&skip=&take=` | Paginated list |
| GET | `/api/v1/links/stats` | Dashboard totals |
| GET | `/api/v1/links/:code` | Link + analytics (series, sources, devices, countries) |
| PATCH | `/api/v1/links/:code` | Activate / deactivate a link `{ active: boolean }` |
| DELETE | `/api/v1/links/:code` | Delete a link (click events cascade) |
| GET | `/:code` | Resolve a short link → 302, and record a `ClickEvent` |

Analytics are aggregated from real `ClickEvent` rows. The redirector derives the source from the
`Referer`, the device from the `User-Agent`, and the country from a CDN header (`cf-ipcountry` /
`x-country`).

## Notes / decisions

- **Auth is pluggable via `AUTH_PROVIDER` (`demo` | `cognito`).**
  - **`demo`** (default, offline): `POST /api/v1/auth/google` upserts a user and issues our own
    httpOnly-cookie session JWT. With no body it signs in the seeded demo user (Camille Dupont) —
    this is what the design's "Continuer avec Google" button drives out of the box.
  - **`cognito`**: the browser signs in with **aws-amplify** → Amazon Cognito (Hosted UI + Google
    federation) and calls the API with a `Bearer` ID token; the backend verifies it via JWKS
    (`aws-jwt-verify`) and upserts the user. No AWS Amplify *service* is needed — only a Cognito User
    Pool + app client. Enable it by setting `AUTH_PROVIDER=cognito` + `COGNITO_*` on the backend and
    rebuilding the frontend with `NEXT_PUBLIC_AUTH_PROVIDER=cognito` + `NEXT_PUBLIC_COGNITO_*` (these
    are inlined at build time). Cognito setup: User Pool + a **public** app client (authorization
    code + PKCE), a Hosted UI domain, Google added as a federated IdP, and callback/sign-out URLs set
    to your app origin.
- **Short-link host is dynamic.** The domain shown in short URLs is derived from the host the app is
  served on (`localhost:3000` in dev, the real FQDN in prod) — nothing is hard-coded. Set the build
  arg / env `NEXT_PUBLIC_SHORT_DOMAIN` (e.g. `sgcut.co`) to display a branded domain instead; in that
  case that domain must point at the redirector in your deployment.
- **Logo marks.** `societe-generale-logo.webp` from the design project is used as-is. The two square
  logo marks are provided as crisp SVGs (cream / green / red variants) rather than the source PNGs.
- **`support.js`** in the design project is the prototype's client-side render runtime for the `x-dc`
  template DSL; it isn't ported — the UI is reimplemented natively in React/Next.

## Local development (optional, needs Node)

Docker is the supported path. If you do run locally: start Postgres, copy each `.env.example` to
`.env`, then `npm install && npx prisma db push && npm run start:dev` (backend) and
`npm install && npm run dev` (frontend).

## 🔗 Documentation

### The UI

Three views make up the app:

| View | Path | Purpose |
| --- | --- | --- |
| **Raccourcir** | `/` | Create a short link |
| **Mes liens** | `/links` | Paginated, filterable list with per-link status |
| **Link detail** | `/links/:code` | Click time series + breakdown by source / device / country |

Analytics are aggregated from real `ClickEvent` rows: the redirector derives the source from the
`Referer`, the device from the `User-Agent`, and the country from a CDN header.

### The API

All app routes require the session cookie; the short-link redirect is public. A few highlights (full
table in the [app docs](applications/README.md#api)):

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/links` | Create a short link `{ destination, expiresInDays? }` |
| GET  | `/api/v1/links` | Paginated / filterable list |
| GET  | `/api/v1/links/:code` | Link + analytics (series, sources, devices, countries) |
| GET  | `/:code` | Resolve a short link → 302, and record a `ClickEvent` |