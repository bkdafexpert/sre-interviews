FROM node:22-bookworm-slim

WORKDIR /app

# Prisma needs openssl; curl is used by the Docker healthcheck.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl curl \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better layer caching.
COPY package.json ./
RUN npm install

# Copy source and build.
COPY . .
RUN npx prisma generate && npm run build && chmod +x docker-entrypoint.sh

EXPOSE 4000

CMD ["./docker-entrypoint.sh"]
