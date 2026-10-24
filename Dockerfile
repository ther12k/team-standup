# Image produksi untuk Team Standup (Next.js standalone).
# Dibangun dari output .next/standalone yang sudah dicompile (npm run build).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY .next/standalone ./
COPY .next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
