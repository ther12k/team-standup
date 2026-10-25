"use client";

import { Link } from "@/components/link";
import { useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCheck, ClipboardList, ExternalLink, FileText, Link2, LockKeyhole, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Avatar, Button, CopyButton, cn, copyToClipboard, useToast } from "@/components/ui";
import { LIVE_KINDS } from "@/components/live/activity-editor";
import { liveReportSnapshot, type LiveActivity, type LiveSession, type RoomCredentials } from "@/lib/live";
import { buildReport } from "@/lib/report";
import { formatReportForWhatsApp } from "@/lib/whatsapp";
import { formatLongDate } from "@/lib/date";

export function ReportReview({ session, credentials, busy, onEdit, onAdd, onRemove, onPhase, onTranscript }: {
  session: LiveSession; credentials: RoomCredentials | null; busy: boolean;
  onEdit: (activity: LiveActivity) => void; onAdd: (memberId: string) => void; onRemove: (id: string) => void;
  onPhase: (phase: "active" | "review" | "published") => void; onTranscript: () => void;
}) {
  const { notify } = useToast();
  const [reviewedRevision, setReviewedRevision] = useState(-1);
  const published = session.phase === "published";
  const preview = liveReportSnapshot({ ...session, phase: "published", publishedAt: session.publishedAt ?? session.startedAt });
  const report = buildReport(preview.state, session.date, session.date);
  const missing = session.members.filter(m => !session.activities.some(a => a.memberId === m.id));
  const viewPath = `/laporan/lihat?room=${session.id}#view=${credentials?.viewKey ?? ""}`;
  const checked = reviewedRevision === session.revision;

  return <div className="animate-rise">
    <div className={cn("mb-7 flex flex-col justify-between gap-5 rounded-2xl border p-6 sm:flex-row sm:items-center", published ? "border-[#d5e3ca] bg-[#edf4e6]" : "border-[#e1e7dc] bg-white")}>
      <div className="flex gap-4"><span className={cn("mt-1 grid size-12 shrink-0 place-items-center rounded-2xl", published ? "bg-brand text-white" : "bg-brand-soft text-brand")}>{published ? <CheckCheck size={24} /> : <FileText size={23} />}</span><div><p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[.15em] text-brand">{published ? "Berhasil diterbitkan" : "Draf laporan · belum dibagikan"}</p><h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{published ? "Satu percakapan. Satu laporan." : "Obrolan selesai, laporan hampir siap."}</h2><p className="mt-2 text-xs leading-relaxed text-ink-soft">{published ? "Laporan tersimpan. Bagikan tautan baca-saja atau salin ringkasannya." : "Periksa isi, lengkapi yang kurang, lalu terbitkan saat sudah sesuai."}</p></div></div>
      <Button onClick={onTranscript} className="self-start sm:self-center"><ClipboardList size={14} /> Lihat transkrip asli</Button>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="mb-5 flex items-end justify-between gap-2"><div><h3 className="text-[15px] font-semibold">Laporan per anggota</h3><p className="mt-1 text-[11px] text-ink-soft">{formatLongDate(session.date)} · Asia/Jakarta</p></div><span className="text-[10px] text-ink-soft">{session.activities.length} aktivitas dipilih</span></div>
        {session.members.map(member => {
          const activities = session.activities.filter(a => a.memberId === member.id);
          return <article key={member.id} className={cn("rounded-2xl border p-5", activities.length ? "border-[#e1e7dc] bg-white" : "border-dashed border-[#dce3d5] bg-[#f9fbf6]")}>
            <div className="flex items-center gap-3"><Avatar name={member.name} accent={member.accent} size="sm" /><div className="min-w-0 flex-1"><h4 className="text-[13px] font-semibold">{member.name}</h4><p className="mt-0.5 text-[10px] text-ink-soft">{member.role}</p></div>{!published && <Button variant="ghost" size="xs" onClick={() => onAdd(member.id)}><Plus size={12} /> Tambah</Button>}</div>
            {!activities.length ? <p className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-[#dce3d5] p-3 text-[11px] text-ink-soft"><AlertCircle size={13} className="text-amber-600" /> Belum ada aktivitas. {published ? "Tidak dianggap selesai." : "Lengkapi manual atau kembali ke percakapan."}</p> : <div className="mt-5 space-y-4">{LIVE_KINDS.map(({ kind, label, Icon, tone }) => {
              const items = activities.filter(a => a.kind === kind); if (!items.length) return null;
              return <section key={kind}><h5 className={cn("mb-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium", tone)}><Icon size={11} />{label}<span className="opacity-60">{items.length}</span></h5><ul className="space-y-2">{items.map(activity => <li key={activity.id} className="group flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-[#f8faf6]"><span className="mt-2 size-1 shrink-0 rounded-full bg-[#a6b39d]" /><div className="min-w-0 flex-1"><p className="text-[12px] leading-relaxed text-[#43503e]">{activity.text}</p>{(activity.taskId || activity.createTask) && <p className="mt-1 flex items-center gap-1 text-[9px] text-ink-soft/65"><Link2 size={10} />{activity.createTask ? published ? "Tugas baru dibuat · Belum Mulai" : "Akan dibuat sebagai tugas baru" : session.tasks.find(t => t.id === activity.taskId)?.title}</p>}</div>{!published && <div className="flex shrink-0"><button onClick={() => onEdit(activity)} disabled={busy} aria-label={`Ubah ${activity.text}`} className="rounded p-1.5 text-ink-soft/60 hover:bg-brand-soft hover:text-brand"><Pencil size={12} /></button><button onClick={() => onRemove(activity.id)} disabled={busy} aria-label={`Hapus ${activity.text}`} className="rounded p-1.5 text-ink-soft/40 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={12} /></button></div>}</li>)}</ul></section>;
            })}</div>}
          </article>;
        })}
      </div>
      <aside className="space-y-4 lg:sticky lg:top-5">
        <div className="rounded-2xl border border-[#e1e7dc] bg-white p-5"><h3 className="text-[13px] font-semibold">Ringkasan sesi</h3><div className="mt-4 space-y-3">{LIVE_KINDS.map(({ kind, label, Icon, tone }) => <div key={kind} className="flex items-center gap-2 text-xs"><span className={cn("grid size-7 place-items-center rounded-lg border", tone)}><Icon size={13} /></span><span className="text-ink-soft">{label}</span><span className="ml-auto font-semibold">{session.activities.filter(a => a.kind === kind).length}</span></div>)}</div><div className="mt-4 border-t border-line pt-3 text-[10px] leading-relaxed text-ink-soft">{session.messages.length} pesan asli tersimpan · {session.members.length - missing.length}/{session.members.length} anggota punya catatan.</div></div>
        {!!missing.length && <div className="rounded-2xl border border-[#f0e3c5] bg-[#fffbf0] p-4"><p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800"><AlertCircle size={14} /> {missing.length} anggota belum lengkap</p><p className="mt-2 text-[11px] leading-relaxed text-amber-800/75">{missing.map(m => m.name.split(" ")[0]).join(", ")} belum memiliki aktivitas. {published ? "Anda bisa memperbaiki laporan kapan saja." : "Boleh diterbitkan; bagian kosong tetap tidak dianggap selesai."}</p></div>}
        <div className="rounded-2xl border border-[#e1e7dc] bg-white p-5">
          {published ? <><h3 className="mb-3 text-[13px] font-semibold">Siap dibagikan ke tim</h3><Link href={viewPath} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-xs font-medium text-white hover:bg-brand-dark">Buka laporan tanpa menu <ExternalLink size={13} /></Link><Button className="mt-2 h-10 w-full" disabled={!credentials?.viewKey} onClick={async () => { const ok = await copyToClipboard(`${window.location.origin}${viewPath}`); notify(ok ? "Tautan baca-saja disalin. Transkrip tidak ikut dibagikan." : "Gagal menyalin tautan. Buka laporan lalu salin alamatnya.", ok ? "success" : "error"); }}><Link2 size={14} /> Salin tautan laporan</Button><CopyButton text={formatReportForWhatsApp(report)} label="Salin untuk WhatsApp" variant="secondary" className="mt-2 h-10 w-full" /><p className="my-4 flex gap-1.5 text-[10px] leading-relaxed text-ink-soft/70"><LockKeyhole size={12} className="shrink-0" />Tautan hanya menampilkan laporan, bukan percakapan.</p><Button variant="ghost" className="w-full border-t border-line pt-2" onClick={() => onPhase("review")} disabled={busy}><Pencil size={13} /> Ubah laporan</Button></> : <>
            <h3 className="text-[13px] font-semibold">Sudah sesuai?</h3><p className="mt-2 text-[11px] leading-relaxed text-ink-soft">Hanya aktivitas yang dipilih akan masuk laporan. Catatan harian lain tidak ditimpa.</p>
            <label className="my-4 flex cursor-pointer items-start gap-2.5 text-[11px] leading-relaxed text-ink-soft"><input type="checkbox" checked={checked} onChange={e => setReviewedRevision(e.target.checked ? session.revision : -1)} className="mt-0.5 size-4 shrink-0 accent-teal-700" /><span>Saya sudah meninjau pemilik, rencana, pekerjaan sebelumnya, dan kendala.</span></label>
            <Button variant="primary" className="h-11 w-full" onClick={() => onPhase("published")} disabled={busy || !checked || !session.activities.length}><Send size={14} /> {busy ? "Menerbitkan…" : session.publishedAt ? "Terbitkan perubahan" : "Terbitkan laporan"}</Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => onPhase("active")} disabled={busy}><ArrowLeft size={13} /> Kembali ke percakapan</Button>
            <p className="mt-2 text-center text-[9px] text-ink-soft/60">Masih bisa diperbaiki setelah diterbitkan.</p>
          </>}
        </div>
      </aside>
    </div>
  </div>;
}
