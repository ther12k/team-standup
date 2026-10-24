"use client";

import { useState } from "react";
import { Link } from "@/components/link";
import { ArrowRight, Check, CheckCheck, FileText, Headphones, MessagesSquare, Radio, Sparkles, Users } from "lucide-react";
import { Avatar, Button, Field, Input } from "@/components/ui";
import type { Member } from "@/lib/types";

export function LiveLobby({ today, members, busy, error, onCreate }: {
  today: string; members: Member[]; busy: boolean; error: string;
  onCreate: (values: { title: string; date: string; withDemo: boolean }) => void;
}) {
  const [title, setTitle] = useState("Standup Tim Operasional");
  const [date, setDate] = useState(today);
  const [withDemo, setWithDemo] = useState(true);
  return <div className="mx-auto grid max-w-[1050px] items-center gap-10 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-16">
    <div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe6d5] bg-[#eff5e9] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[#51723c]"><Radio size={13} /> Ruang baru untuk kolaborasi</span>
      <h1 className="mt-6 text-[38px] font-semibold leading-[1.2] tracking-[-1.8px] text-ink sm:text-[46px]">Mulai dari obrolan.<br /><span className="text-brand">Pulang bawa rencana.</span></h1>
      <p className="mt-5 max-w-[410px] text-[14px] leading-[1.9] text-ink-soft">Standup yang mengalir, tanpa kehilangan hal penting. Ceritakan progres, pilih aktivitas dari transkrip, lalu rapikan laporan bersama.</p>
      <div className="mt-8 space-y-5">
        {[
          { Icon: MessagesSquare, title: "Satu ruang untuk seluruh tim", desc: "Percakapan teks tersinkron, atau gunakan dikte suara." },
          { Icon: Sparkles, title: "Ambil yang penting dari transkrip", desc: "Pilih, edit, dan masukkan ke aktivitasmu sendiri." },
          { Icon: FileText, title: "Laporan siap, tetap bisa diperbaiki", desc: "Tinjau bersama sebelum membagikan versi final." },
        ].map(({ Icon, title: name, desc }) => <div key={name} className="flex gap-3.5"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#e0e7db] bg-white text-brand"><Icon size={18} /></span><div><p className="text-[13px] font-semibold">{name}</p><p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{desc}</p></div></div>)}
      </div>
      <div className="mt-8 flex items-center gap-2.5"><div className="flex -space-x-2">{members.slice(0, 4).map(m => <Avatar key={m.id} name={m.name} accent={m.accent} size="sm" className="ring-2 ring-[#f7f8f5]" />)}</div><p className="text-[11px] text-ink-soft">Tempat ide dan progres bertemu.</p></div>
    </div>
    <div className="overflow-hidden rounded-3xl border border-[#e1e8da] bg-white shadow-[0_15px_50px_#284c3010]">
      <div className="relative overflow-hidden bg-[#174e3e] p-7 text-white">
        <div className="pointer-events-none absolute -right-10 -top-20 size-56 rounded-full border border-white/10" /><div className="pointer-events-none absolute -right-2 -top-12 size-40 rounded-full border border-white/10" />
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.15em] text-[#c5daba]"><Headphones size={16} /> Standup Live</div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">15 menit. Satu arah yang sama.</h2><p className="mt-2 text-[12px] text-[#b5ccba]">Beri ruang untuk bicara. Sisanya kita rangkum.</p>
        <div className="mt-5 flex items-center gap-2 text-[10px] text-white/70"><Check size={12} /> Tanpa instalasi <span className="mx-1">·</span><Check size={12} /> Tanpa layanan AI berbayar</div>
      </div>
      <form className="space-y-5 p-6 sm:p-7" onSubmit={e => { e.preventDefault(); onCreate({ title, date, withDemo }); }}>
        <Field label="Nama sesi" htmlFor="room-title"><Input id="room-title" value={title} onChange={e => setTitle(e.target.value)} required minLength={3} maxLength={100} className="h-11 text-[13px]" /></Field>
        <div className="grid grid-cols-2 gap-4"><Field label="Tanggal laporan" htmlFor="room-date"><Input type="date" id="room-date" value={date} onChange={e => setDate(e.target.value)} required className="h-11 text-[13px]" /></Field><div><p className="mb-1.5 text-xs font-semibold">Tim</p><div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-[#f9faf7] px-3 text-xs text-ink-soft"><Users size={15} /> {members.length} anggota</div></div></div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#e5e1f0] bg-[#f7f5fb] p-3.5"><input type="checkbox" checked={withDemo} onChange={e => setWithDemo(e.target.checked)} className="mt-0.5 size-4 accent-violet-600" /><span><span className="block text-[12px] font-medium text-[#5f4f81]">Sertakan percakapan contoh</span><span className="mt-1 block text-[10px] leading-relaxed text-[#8b7da5]">Coba alur dengan data demo. Nonaktifkan untuk sesi kosong.</span></span></label>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs leading-relaxed text-rose-700">{error}</p>}
        <Button type="submit" variant="primary" size="md" disabled={busy || !members.length} className="h-12 w-full">{busy ? "Menyiapkan ruang…" : "Mulai Standup Live"}<ArrowRight size={17} /></Button>
        <p className="text-center text-[10px] leading-relaxed text-ink-soft/75">Mode demo · identitas peserta dapat dipilih.<br />Percakapan teks disimpan. Tidak ada panggilan audio/video.</p>
      </form>
    </div>
    <div className="flex items-center gap-1.5 text-[10px] text-ink-soft/70 lg:col-span-2 lg:-mt-5"><CheckCheck size={14} /> Sudah punya laporan? <Link href="/laporan/lihat" className="font-medium text-brand underline-offset-4 hover:underline">Buka tampilan laporan <ArrowRight className="inline" size={11} /></Link></div>
  </div>;
}
