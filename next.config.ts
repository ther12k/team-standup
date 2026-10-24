import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Folder repositori ini adalah root Turbopack — induk Workspace memuat lockfile lain
  // yang membuat Next menebak root yang salah.
  turbopack: { root: __dirname },
  // Peramban tertanam membuka dev server lewat 127.0.0.1; tanpa ini HMR dianggap
  // lintas-origin dan halaman dev memuat ulang terus-menerus.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Output mandiri untuk image Docker produksi (lihat Dockerfile).
  output: "standalone",
};

export default nextConfig;
