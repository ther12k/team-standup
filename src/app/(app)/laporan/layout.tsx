import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Laporan — Team Standup",
  description: "Rekap standup harian, mingguan, dan rentang kustom siap salin atau ekspor CSV.",
};

export default function LaporanLayout({ children }: { children: ReactNode }) {
  return children;
}
