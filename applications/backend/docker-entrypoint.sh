#!/bin/sh
set -e

echo "[sgcut-api] Applying database schema (prisma db push)…"
# Retry a few times in case the database is still coming up.
n=0
until npx prisma db push --skip-generate --accept-data-loss; do
  n=$((n + 1))
  if [ "$n" -ge 10 ]; then
    echo "[sgcut-api] Database not reachable after $n attempts — giving up." >&2
    exit 1
  fi
  echo "[sgcut-api] Database not ready yet (attempt $n) — retrying in 3s…"
  sleep 3
done

echo "[sgcut-api] Seeding demo data…"
npx prisma db seed || echo "[sgcut-api] Seed step reported an issue (continuing)."

echo "[sgcut-api] Starting API…"
exec node dist/main.js
