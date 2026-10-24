# Image produksi untuk Team Standup (Next.js standalone + Drizzle/PostgreSQL).
# Bangun:  docker build -t team-standup .
# Jalankan (butuh PostgreSQL):
#   docker run -d --name standup-db -e POSTGRES_USER=standup \
#     -e POSTGRES_PASSWORD=rahasia -e POSTGRES_DB=hi_standup postgres:16-alpine
#   docker run -d --name standup-app --link standup-db \
#     -e DATABASE_URL=postgres://standup:rahasia@standup-db:5432/hi_standup \
#     -p 3000:3000 team-standup
# Database dibuat otomatis saat permintaan pertama (tabel + data contoh).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
