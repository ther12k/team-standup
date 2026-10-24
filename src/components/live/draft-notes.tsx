"use client";

import { useState } from "react";
import { ArrowUpRight, Check, FilePenLine, Link2, ListChecks, Pencil, Plus, Quote, Sparkles, Trash2 } from "lucide-react";
import { Avatar, Button, Modal, cn } from "@/components/ui";
import { LIVE_KINDS } from "@/components/live/activity-editor";
import { suggestFromTranscript, type LiveActivity, type LiveMessage, type LiveSession, type LiveSuggestion } from "@/lib/live";

export function DraftNotes({ session, me, busy, onAdd, onEdit, onRemove, onSuggest }: {
  session: LiveSession; me: string; busy: boolean;
  onAdd: () => void; onEdit: (activity: LiveActivity) => void;
  onRemove: (id: string) => void; onSuggest: () => void;
}) {
  const [all, setAll] = useState(false);
  const mine = session.activities.filter(a => a.memberId === me);
  const visible = all ? session.activities : mine;
  return <aside className="space-y-4">
    <div className="relative overflow-hidden rounded-2xl border border-[#e2dcee] bg-[#f5f2fa] p-5">
      <div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-[#eae3f5] text-[#8261ad]"><Sparkles size={18} /></span><span className="rounded-md border border-[#dfd4ec] px-1.5 py-0.5 text-[8px] font-semibold tracking-wider text-[#8a72a3]">AI ASSIST · DEMO</span></div>
      <h2 className="mt-3 text-[14px] font-semibold tracking-tight text-[#4f3d68]">Obrolan jadi langkah nyata.</h2><p className="mt-2 text-[11px] leading-[1.8] text-[#9383a4]">Ambil bagian penting dari transkrip. Rapikan, pilih pemiliknya, lalu masukkan ke draf.</p>
      <button onClick={onSuggest} disabled={!session.messages.length} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#dfd6e9] bg-white/80 px-3 py-2.5 text-[11px] font-semibold text-[#79579a] transition hover:bg-white disabled:opacity-40"><Sparkles size={13} /> Susun dari transkrip <ArrowUpRight size={12} /></button><p className="mt-2.5 text-center text-[8.5px] text-[#a697b5]">Saran berbasis aturan, bukan layanan AI eksternal.</p>
    </div>
    <section className="rounded-2xl border border-[#e1e7dc] bg-white p-5">
      <div className="flex items-center gap-2"><ListChecks size={17} className="text-brand" /><h2 className="flex-1 text-[13px] font-semibold">Draf aktivitas</h2><span className="rounded-md bg-[#eef3e9] px-2 py-0.5 text-[10px] font-semibold text-brand">{session.activities.length}</span></div>
      <div className="mb-4 mt-4 flex gap-5 border-b border-line text-[11px]"><button aria-pressed={!all} onClick={() => setAll(false)} className={cn("border-b-2 pb-2.5", !all ? "border-brand font-semibold text-brand" : "border-transparent text-ink-soft")}>Catatan saya <span className="ml-1 text-[9px] opacity-60">{mine.length}</span></button><button aria-pressed={all} onClick={() => setAll(true)} className={cn("border-b-2 pb-2.5", all ? "border-brand font-semibold text-brand" : "border-transparent text-ink-soft")}>Seluruh tim</button></div>
      {visible.length ? <div className="max-h-[410px] space-y-3 overflow-y-auto pr-0.5">{visible.map(activity => {
        const kind = LIVE_KINDS.find(k => k.kind === activity.kind)!;
        const owner = session.members.find(m => m.id === activity.memberId);
        return <div key={activity.id} className="group rounded-xl border border-[#e6eadf] bg-[#fcfdfb] p-3">
          <div className="flex items-center justify-between gap-2"><span className={cn("flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium", kind.tone)}><kind.Icon size={10} />{kind.label}</span><div className="flex items-center"><button disabled={busy} onClick={() => onEdit(activity)} aria-label={`Ubah aktivitas ${activity.text}`} className="rounded-md p-1.5 text-ink-soft/60 hover:bg-slate-100 hover:text-brand"><Pencil size={11} /></button><button disabled={busy} onClick={() => onRemove(activity.id)} aria-label={`Hapus aktivitas ${activity.text}`} className="rounded-md p-1.5 text-ink-soft/50 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={11} /></button></div></div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-[#455241]">{activity.text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[8.5px] text-ink-soft/65">{activity.origin === "transcript" ? <Quote size={10} /> : <FilePenLine size={10} />}{activity.origin === "transcript" ? "Dari transkrip" : "Catatan manual"}{(activity.taskId || activity.createTask) && <span className="ml-auto flex items-center gap-1"><Link2 size={10} />{activity.createTask ? "Tugas baru" : "Tugas tertaut"}</span>}</div>
          {all && owner && <div className="mt-2 flex items-center gap-1.5 border-t border-line/70 pt-2 text-[9px] text-ink-soft"><Avatar name={owner.name} accent={owner.accent} size="xs" className="size-5 text-[8px]" />{owner.name}</div>}
        </div>;
      })}</div> : <div className="px-2 py-5 text-center"><span className="mx-auto grid size-11 place-items-center rounded-2xl border border-dashed border-[#d9e2cf] bg-[#f7f9f4] text-[#9daf90]"><FilePenLine size={19} /></span><p className="mt-3 text-xs font-medium text-[#617254]">Belum ada aktivitas dipilih</p><p className="mt-2 text-[10px] leading-relaxed text-ink-soft/65">Ambil dari transkrip atau catat manual.<br />Hanya yang dipilih masuk ke laporan.</p></div>}
      <button type="button" onClick={onAdd} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#cfddc4] bg-[#f9fbf6] px-3 py-3 text-[11px] font-medium text-brand transition hover:border-brand hover:bg-brand-soft"><Plus size={14} /> Tambah manual</button>
    </section>
    <p className="flex items-start gap-2 px-2 text-[10px] leading-[1.8] text-ink-soft/65"><Check size={13} className="mt-0.5 shrink-0 text-brand" />Draf tersimpan di ruang. Belum mengubah tugas atau laporan sebelum diterbitkan.</p>
  </aside>;
}

export function SuggestionsModal({ session, onClose, onPick }: {
  session: LiveSession; onClose: () => void;
  onPick: (message: LiveMessage, suggestion: LiveSuggestion) => void;
}) {
  const suggestions = session.messages.flatMap(message => suggestFromTranscript(message.text).map(suggestion => ({ message, suggestion })));
  return <Modal open onClose={onClose} title="Pilih bagian yang penting" description="Saran demo berbasis aturan. Periksa teks, pemilik, dan jenis aktivitas sebelum menambahkan." size="md" footer={<Button onClick={onClose}>Tutup</Button>}>
    <div className="space-y-3">
      {!suggestions.length && <div className="rounded-xl border border-dashed border-line p-6 text-center"><p className="text-sm font-medium">Belum ada saran yang bisa dikenali.</p><p className="mt-2 text-xs text-ink-soft">Gunakan Ambil aktivitas pada pesan, atau tambah aktivitas manual. Tidak ada isi yang ditebak.</p></div>}
      {suggestions.map(({ message, suggestion }, i) => {
        const member = session.members.find(m => m.id === message.memberId);
        const meta = LIVE_KINDS.find(k => k.kind === suggestion.kind)!;
        return <div key={`${message.id}-${i}`} className="rounded-xl border border-line p-4"><div className="flex items-center gap-2"><Avatar name={member?.name ?? "Anggota"} accent={member?.accent} size="xs" /><span className="text-xs font-medium">{member?.name}</span><span className={cn("ml-auto rounded-md border px-1.5 py-0.5 text-[9px]", meta.tone)}>{meta.label}</span></div><p className="mt-3 text-[13px] leading-relaxed">{suggestion.text}</p><p className="mt-2 text-[10px] leading-relaxed text-ink-soft">{suggestion.note}</p><Button size="xs" variant="soft" onClick={() => onPick(message, suggestion)} className="mt-3"><Plus size={12} /> Tinjau & pilih</Button></div>;
      })}
    </div>
  </Modal>;
}
