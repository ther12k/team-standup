import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Divisi Lain — Team Standup",
  description: "Laporan harian divisi lain (RnD, PM Project, Product, Maintenance) sebagai referensi.",
};

export default function DivisiLayout({ children }: { children: ReactNode }) {
  return children;
}
