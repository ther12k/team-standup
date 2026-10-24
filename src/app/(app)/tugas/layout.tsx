import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Tugas — Team Standup",
  description: "Daftar tugas tim dengan filter PIC, status, proyek, dan tenggat.",
};

export default function TugasLayout({ children }: { children: ReactNode }) {
  return children;
}
