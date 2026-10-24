import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Impor — Team Standup",
  description: "Impor laporan standup WhatsApp lampau dengan pratinjau, pemetaan anggota, dan deteksi duplikat.",
};

export default function ImporLayout({ children }: { children: ReactNode }) {
  return children;
}
