/** @type {import('next').NextConfig} */

// Where server-side rewrites forward API + redirect traffic. In Docker this is the backend
// service name; for local dev it defaults to localhost.
const BACKEND = process.env.BACKEND_URL || 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      // Same-origin API proxy so the httpOnly session cookie just works.
      { source: '/api/:path*', destination: `${BACKEND}/api/:path*` },
      // Short links resolve at the app's own host: <app-host>/<code> → backend redirector.
      // Restricted to 6-char codes so it can't shadow /login, /links, /api, or static assets.
      { source: '/:code([A-Za-z0-9]{6})', destination: `${BACKEND}/:code` },
      // Back-compat alias.
      { source: '/l/:code', destination: `${BACKEND}/:code` },
    ];
  },
};

module.exports = nextConfig;
