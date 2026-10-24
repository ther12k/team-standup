import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Muat variabel lingkungan dari .env.local atau .env
if (existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { workspaceRoutes } from "./routes/workspace";
import { userRoutes } from "./routes/users";
import { shareRoutes } from "./routes/shares";
import { liveRoutes } from "./routes/live";

const port = Number(process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3003));
const distDir = path.resolve(process.cwd(), "dist");

export const app = new Elysia()
  .use(cors({
    origin: true,
    credentials: true,
  }))
  .use(healthRoutes)
  .use(authRoutes)
  .use(workspaceRoutes)
  .use(userRoutes)
  .use(shareRoutes)
  .use(liveRoutes);

// Fallback SPA & static assets menggunakan Bun.file bawaan
app.get("*", async ({ path: reqPath }) => {
  if (reqPath.startsWith("/api/")) return;

  const targetPath = reqPath === "/" ? "index.html" : reqPath.slice(1);
  const assetFile = Bun.file(path.join(distDir, targetPath));
  if (await assetFile.exists()) {
    return new Response(assetFile);
  }

  // Fallback ke index.html untuk client-side routing (React Router)
  const indexFile = Bun.file(path.join(distDir, "index.html"));
  if (await indexFile.exists()) {
    return new Response(indexFile, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});

app.listen(port);

console.log(`🦊 Elysia 2 server berjalan di port ${port}`);

export type App = typeof app;
