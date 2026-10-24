import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = { title: "Standup Live — Team Standup", description: "Percakapan tim, transkrip yang bisa dipilih, dan laporan yang bisa dirapikan bersama.", referrer: "no-referrer" };
export default function LiveLayout({ children }: { children: ReactNode }) { return children; }
