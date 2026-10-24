import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: "Team Standup — Standup harian & pelacakan tugas",
  description:
    "Aplikasi internal untuk standup harian, pelacakan tugas, impor laporan WhatsApp, dan laporan tim dalam Bahasa Indonesia.",
};

export const viewport: Viewport = {
  themeColor: "#0f6f5c",
  width: "device-width",
  initialScale: 1,
};

/** Root layout hanya menyediakan kerangka global; StoreProvider & AppShell ada di layout (app). */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
