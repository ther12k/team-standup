import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = { title: "Laporan harian — Team Standup", description: "Satu hari, satu gambaran utuh. Laporan standup dalam tampilan fokus tanpa menu.", referrer: "no-referrer" };
export default function ReportViewLayout({ children }: { children: ReactNode }) { return children; }
