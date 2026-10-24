"use client";

import { useState } from "react";
import { AlertCircle, Check, CircleCheck, ClipboardList, Link2, Quote, Sparkles } from "lucide-react";
import { Avatar, Button, Field, Modal, Select, Textarea, cn } from "@/components/ui";
import type { LiveActivity, LiveSession } from "@/lib/live";
import { statusMeta } from "@/lib/tasks";

export const LIVE_KINDS = [
  { kind: "plan" as const, label: "Rencana", Icon: ClipboardList, tone: "text-sky-700 bg-sky-50 border-sky-200" },
  { kind: "done" as const, label: "Selesai", Icon: CircleCheck, tone: "text-brand bg-brand-soft border-teal-200" },
  { kind: "blocker" as const, label: "Kendala", Icon: AlertCircle, tone: "text-amber-700 bg-amber-50 border-amber-200" },
];

export function ActivityEditor({ initial, session, me, busy, note, onClose, onSave }: {
  initial: LiveActivity; session: LiveSession; me: string; busy: boolean; note?: string;
  onClose: () => void; onSave: (activity: LiveActivity) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const source = session.messages.find(m => m.id === initial.messageId);
  const existing = session.activities.some(a => a.id === initial.id);
  const submit = async () => {
    if (!draft.text.trim() || draft.text.trim().length > 3000) { setError("Isi aktivitas antara 1–3.000 karakter."); return; }
    if (!draft.memberId) { setError("Pilih penanggung jawab aktivitas."); return; }
    if (await onSave({ ...draft, text: draft.text.trim() })) onClose();
  };
  return <Modal open onClose={onClose} title={existing ? "Ubah aktivitas" : initial.messageId ? "Ambil dari transkrip" : "Tambah aktivitas manual"} description="Kamu yang menentukan apa yang masuk ke laporan." size="md" footer={<><Button disabled={busy} onClick={onClose}>Batal</Button><Button variant="primary" disabled={busy} onClick={submit}><Check size={15} />{busy ? "Menyimpan…" : existing ? "Simpan perubahan" : "Tambahkan ke draf"}</Button></>}>
    <div className="space-y-5">
      {source && <div className="rounded-xl border border-[#e6e4ef] bg-[#f7f6fb] p-3.5"><p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700"><Quote size={12} /> Transkrip asli · {session.members.find(m => m.id === source.memberId)?.name}</p><p className="text-xs leading-relaxed text-ink-soft">“{source.text}”</p><p className="mt-2 text-[10px] text-ink-soft/70">Teks asli tidak berubah saat aktivitas diperbaiki.</p></div>}
      {note && <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900"><Sparkles size={14} className="mt-0.5 shrink-0" />{note}</p>}
      <Field label="Aktivitas untuk laporan" htmlFor="live-activity-text" hint="Pilih bagian yang relevan; rapikan dengan kata-kata sendiri bila perlu."><Textarea id="live-activity-text" autoFocus value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })} rows={4} maxLength={3000} className="text-[13px]" placeholder="Apa yang dikerjakan atau perlu dibantu?" /></Field>
      <div><p className="mb-2 text-xs font-semibold">Masukkan sebagai</p><div className="grid grid-cols-3 gap-2" role="group" aria-label="Jenis aktivitas">
        {LIVE_KINDS.map(({ kind, label, Icon, tone }) => <button type="button" key={kind} aria-pressed={draft.kind === kind} onClick={() => setDraft({ ...draft, kind })} className={cn("flex items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium transition", draft.kind === kind ? `${tone} ring-1 ring-current/10` : "border-line bg-white text-ink-soft")}><Icon size={15} />{label}</button>)}
      </div><p className="mt-2 text-[10px] leading-relaxed text-ink-soft">{draft.kind === "done" ? "Pilih Selesai hanya untuk pekerjaan yang benar-benar dinyatakan selesai. Status tugas tetap terpisah." : "Rencana tidak dianggap selesai. Menambahkan aktivitas tidak mengubah status tugas."}</p></div>
      <Field label="Penanggung jawab" htmlFor="live-activity-owner"><Select id="live-activity-owner" value={draft.memberId} onChange={e => setDraft({ ...draft, memberId: e.target.value })}>{session.members.map(m => <option key={m.id} value={m.id}>{m.name}{m.id === me ? " (saya)" : ""}</option>)}</Select></Field>
      <Field label="Tugas terkait" htmlFor="live-activity-task" hint={draft.createTask ? "Tugas baru dibuat saat laporan diterbitkan, berstatus Belum Mulai dan tanpa tenggat otomatis." : "Opsional. Satu tugas dapat dipakai di beberapa standup."}><div className="relative"><Link2 size={14} className="absolute left-3 top-3 text-ink-soft" /><Select id="live-activity-task" className="pl-9" value={draft.createTask ? "__new__" : draft.taskId ?? ""} onChange={e => setDraft({ ...draft, createTask: e.target.value === "__new__", taskId: e.target.value && e.target.value !== "__new__" ? e.target.value : undefined })}>
        <option value="">Catatan saja, tanpa tugas</option><option value="__new__">＋ Buat tugas baru dari aktivitas ini</option><optgroup label="Tautkan ke tugas yang sudah ada">{session.tasks.map(t => <option key={t.id} value={t.id}>{t.title} · {statusMeta(t.status).label}</option>)}</optgroup>
      </Select></div></Field>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
    </div>
  </Modal>;
}
