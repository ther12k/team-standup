import Link from "next/link";
import { ArrowRight, AudioLines, Maximize2, Radio } from "lucide-react";

export function WorkflowBanner() {
  return <section className="relative overflow-hidden rounded-2xl border border-[#2b6e53] bg-[#185740] p-5 text-white sm:p-6">
    <div aria-hidden className="pointer-events-none absolute -right-12 -top-28 size-72 rounded-full border border-white/[.07]" /><div aria-hidden className="pointer-events-none absolute -right-2 -top-16 size-48 rounded-full border border-white/[.08]" />
    <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-4"><span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-[#cde4a7] sm:flex"><AudioLines size={25} /></span><div><p className="mb-2 flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[.16em] text-[#c4dfa6]"><span className="size-1.5 rounded-full bg-[#c4dfa6]" /> Baru · Standup Live</p><h2 className="text-[17px] font-semibold tracking-tight sm:text-[19px]">Obrolan singkat. Arah kerja jelas.</h2><p className="mt-1.5 text-[11px] leading-relaxed text-[#c2d6c4]">Pilih dari transkrip, rapikan aktivitas, bagikan laporan.</p></div></div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col"><Link href="/live" className="flex items-center justify-center gap-2 rounded-xl bg-[#e9f3d9] px-4 py-2.5 text-[11px] font-semibold text-[#235835] shadow-sm transition hover:bg-white">Mulai Standup Live <ArrowRight size={13} /></Link><Link href="/laporan/lihat" className="flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-[10px] text-[#d5e4cf] transition hover:bg-white/10"><Maximize2 size={12} /> Laporan tanpa menu</Link></div>
    </div>
  </section>;
}
