# Multi-stage build untuk Team Standup menggunakan Bun + Elysia 2 + Vite
FROM oven/bun:alpine AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile
COPY tsconfig.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/drizzle.config.json ./
EXPOSE 3000
CMD ["bun", "run", "src/server/index.ts"]
