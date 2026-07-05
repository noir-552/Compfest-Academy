FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json openapi.yaml ./
COPY src ./src

RUN npx prisma generate && npm run build

ENV DATABASE_URL=file:/app/data/dev.db
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "mkdir -p /app/data && npx prisma migrate deploy && npm run seed && node dist/server.js"]
