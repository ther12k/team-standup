/* eslint-disable react-hooks/set-state-in-effect -- Restores the optional browser-only demo identity preference after hydration. */
"use client";

import { Link } from "@/components/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCheck, ChevronRight, Clock3, Copy, FileCheck2, Info, Link2, Loader2, MessageCircle, Plus, Radio, Users, Wifi, WifiOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUser } from "@/components/user-context";
import { useLiveRoom } from "@/lib/use-live-room";
import { newLiveId, type LiveActivity, type LiveMessage, type LiveSuggestion } from "@/lib/live";
import { Avatar, Button, Field, Input, Modal, PageLoading, cn, copyToClipboard, useToast } from "@/components/ui";
import { FocusBrand } from "@/components/focus-brand";
import { LiveLobby } from "@/components/live/live-lobby";
import { ActivityEditor } from "@/components/live/activity-editor";
import { Conversation } from "@/components/live/conversation";
import { DraftNotes, SuggestionsModal } from "@/components/live/draft-notes";
import { ReportReview } from "@/components/live/report-review";
import { formatClock, formatLongDate, formatMediumDate } from "@/lib/date";
import { prevWorkingDay } from "@/lib/workdays";
import { formatStandupForWhatsApp } from "@/lib/whatsapp";

function SessionTimer({ start, end }: { start: string; end?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (end) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [end]);
  const seconds = Math.max(0, Math.floor(((end ? new Date(end).getTime() : now) - new Date(start).getTime()) / 1000));
  return <span className="flex items-center gap-1.5 rounded-xl border border-[#e1e7dc] bg-white px-3 py-2 text-[11px] tabular-nums text-ink-soft"><Clock3 size={14} />{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>;
}

export default function LivePage() {
  const { state, hydrated, today } = useStore();
  const user = useUser();
  const { notify } = useToast();
  const room = useLiveRoom();
  const { session, credentials, busy, error, connection } = room;
  const [me, setMe] = useState(user?.memberId ?? "");
  const [editing, setEditing] = useState<LiveActivity | null>(null);
  const [suggestionNote, setSuggestionNote] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTitle, setNewTitle] = useState("Standup Tim Operasional");
  const [newDemo, setNewDemo] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const memberId = session?.members.some(m => m.id === me) ? me : session?.members[0]?.id ?? "";
  const active = session?.phase === "active";

  useEffect(() => {
    // Identitas terhubung akun login menang; preferensi tersimpan hanya untuk akun tanpa anggota.
    if (user?.memberId) { setMe(user.memberId); return; }
    try { const saved = sessionStorage.getItem("standup-live-identity"); if (saved) setMe(saved); } catch { /* optional identity preference */ }
  }, [user?.memberId]);
  const changeIdentity = (id: string) => { setMe(id); try { sessionStorage.setItem("standup-live-identity", id); } catch { /* preference only */ } };
  const addManual = (owner = memberId) => { setSuggestionNote(""); setEditing({ id: newLiveId("a"), memberId: owner, text: "", kind: "plan", createTask: false, origin: "manual" }); };
  const pickMessage = (message: LiveMessage, snippet: string, suggestion?: LiveSuggestion) => {
    setShowSuggestions(false); setSuggestionNote(suggestion?.note ?? "Sesuaikan teks dan pemilik. Rencana tidak otomatis dianggap selesai.");
    setEditing({ id: newLiveId("a"), memberId, text: snippet, kind: suggestion?.kind ?? "plan", createTask: false, messageId: message.id, origin: "transcript" });
  };
  const editActivity = (activity: LiveActivity) => { setSuggestionNote(""); setEditing(activity); };
  const phase = async (value: "active" | "review" | "published") => {
    const result = await room.act({ type: "phase", phase: value });
    if (result) {
      notify(value === "published" ? "Laporan diterbitkan. Catatan Standup dan Tugas sudah diperbarui." : value === "review" ? "Draf laporan siap ditinjau. Lengkapi yang masih kurang." : "Percakapan dilanjutkan.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const inviteUrl = credentials && typeof window !== "undefined" ? `${window.location.origin}/live?room=${credentials.id}#key=${credentials.key}` : "";
  const step = session?.phase === "active" ? 0 : session?.phase === "review" ? 1 : 2;

  return <div className="focus-page">
    <header className="border-b border-[#e3e8de] bg-white/85"><div className="focus-container flex h-[72px] items-center justify-between gap-3"><FocusBrand subtitle="Ruang kolaborasi" /><Link href="/" className="flex items-center gap-1.5 text-[11px] text-ink-soft transition hover:text-brand"><ArrowLeft size={13} /><span className="hidden sm:inline">Kembali ke</span> workspace</Link></div></header>
    <main className="focus-container pb-28 pt-7 sm:pt-9 md:pb-12">
      {!hydrated || !room.initialized ? <PageLoading label="Membuka ruang standup…" /> : !session && credentials && !error ? <div className="flex min-h-80 flex-col items-center justify-center gap-4 text-ink-soft"><Loader2 size={24} className="animate-spin text-brand" /><p className="text-sm">Menghubungkan ke ruang…</p></div> : !session ? <>
        {credentials && error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><Info size={16} /><p className="flex-1">{error} Anda dapat mencoba lagi atau membuat sesi baru di bawah.</p><Button onClick={() => void room.refresh()}>Coba lagi</Button></div>}
        <LiveLobby today={today} members={state.members} busy={busy} error={!credentials ? error : ""} onCreate={values => void room.create(values)} />
      </> : <>
        <div className="mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div><div className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-ink-soft/70"><Radio size={13} className="text-brand" />{session.title}<span className="rounded bg-[#eaf0e4] px-1.5 py-0.5 text-[8px] font-medium tracking-wide text-[#698255]">DEMO</span></div>
            <div className="flex items-center gap-3"><h1 className="text-[28px] font-semibold tracking-[-.9px] sm:text-[31px]">Standup Live<span className="text-brand">.</span></h1><span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-medium", active ? "border-emerald-200 bg-emerald-50 text-brand" : "border-[#e1e7dc] bg-white text-ink-soft")}><span className={cn("size-1.5 rounded-full", active ? "bg-brand" : session.phase === "published" ? "bg-brand" : "bg-amber-400")} />{active ? "Sesi berlangsung" : session.phase === "review" ? "Sedang ditinjau" : "Laporan terbit"}</span></div>
            <p className="mt-2 text-[11px] text-ink-soft">{formatLongDate(session.date)}<span className="mx-2 text-ink-soft/35">/</span>Ruang #{session.id.slice(0, 6).toUpperCase()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2"><SessionTimer start={session.startedAt} end={session.endedAt} /><Button onClick={() => setShowReference(true)} className="h-9 text-[11px]"><BookOpen size={14} /> Referensi</Button><Button onClick={() => setShowInvite(true)} className="h-9 text-[11px]"><Users size={14} /> Undang tim</Button>{active ? <Button variant="primary" disabled={busy} onClick={() => void phase("review")} className="h-9 text-[11px]">Selesai & buat laporan <ArrowRight size={14} /></Button> : <Button onClick={() => { setNewDate(today); setShowNew(true); }} className="h-9 text-[11px]"><Plus size={14} /> Sesi baru</Button>}</div>
        </div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e7d9] pb-4">
          <ol className="flex items-center gap-3 sm:gap-5" aria-label="Tahap sesi">{["Percakapan", "Tinjau laporan", "Bagikan"].map((name, i) => <li key={name} className="flex items-center gap-3 sm:gap-5"><span className={cn("flex items-center gap-2 text-[10px] sm:text-[11px]", step === i ? "font-semibold text-brand" : "text-ink-soft/60")}><span className={cn("grid size-[22px] place-items-center rounded-full text-[9px]", step > i ? "bg-brand-soft text-brand" : step === i ? "bg-brand text-white" : "border border-[#dce4d6] bg-white")}>{step > i ? <Check size={11} /> : `0${i + 1}`}</span>{name}</span>{i < 2 && <ChevronRight size={12} className="text-[#c7d2bf]" />}</li>)}</ol>
          <span className={cn("flex items-center gap-1.5 text-[9px]", connection === "connected" ? "text-ink-soft/65" : "text-amber-700")}>{connection === "connected" ? <Wifi size={12} /> : <WifiOff size={12} />}{connection === "connected" ? "Tersinkron · tersimpan otomatis" : "Menghubungkan ulang…"}</span>
        </div>
        {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900"><WifiOff size={14} /><p className="flex-1">{error}</p><Button size="xs" onClick={() => void room.refresh()}>Coba lagi</Button></div>}
        {active ? <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e1e7dc] bg-white px-5 py-4">
            <div className="flex min-w-0 items-center gap-4"><span className="text-[10px] font-medium text-ink-soft">Tim sesi</span><div className="flex -space-x-1.5">{session.members.slice(0, 6).map(m => <span key={m.id} title={`${m.name} · ${m.role}`}><Avatar name={m.name} accent={m.accent} size="sm" className={cn("ring-2 ring-white", m.id === memberId && "relative z-10 ring-brand/30")} /></span>)}</div><span className="hidden text-[10px] text-ink-soft/65 sm:inline">{session.members.length} anggota terdaftar</span></div>
            <label className="flex items-center gap-2 text-[10px] text-ink-soft">Anda sebagai <select aria-label="Identitas peserta demo" value={memberId} onChange={e => changeIdentity(e.target.value)} className="max-w-[170px] rounded-lg border border-[#dfe6d8] bg-[#f7faf3] px-2 py-2 text-[11px] font-semibold text-[#456331]">{session.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><span className="hidden rounded border border-[#e4e7dd] px-1 py-0.5 text-[8px] text-ink-soft/60 sm:inline">DEMO</span></label>
          </div>
          <div className="live-grid"><Conversation key={`${session.id}-${memberId}`} session={session} me={memberId} busy={busy} onSend={async message => Boolean(await room.act({ type: "message", message }))} onPick={pickMessage} onSuggest={() => setShowSuggestions(true)} /><DraftNotes session={session} me={memberId} busy={busy} onAdd={() => addManual()} onEdit={editActivity} onRemove={id => { void room.act({ type: "remove", activityId: id }); }} onSuggest={() => setShowSuggestions(true)} /></div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[10px] leading-relaxed text-ink-soft/60"><span className="flex items-center gap-1.5"><Info size={12} />Ruang percakapan teks, bukan panggilan audio/video. Semua pemegang tautan bisa berkolaborasi.</span><span>{session.activities.length} aktivitas dalam draf · {session.messages.length} pesan</span></div>
        </> : <ReportReview session={session} credentials={credentials} busy={busy} onAdd={addManual} onEdit={editActivity} onRemove={id => { void room.act({ type: "remove", activityId: id }); }} onPhase={value => void phase(value)} onTranscript={() => setShowTranscript(true)} />}
      </>}
      <footer className="mt-10 flex items-center justify-between border-t border-[#e1e7db] pt-5 text-[9px] text-ink-soft/60"><span className="flex items-center gap-1.5"><CheckCheck size={13} /> Team Standup · Langkah kecil, progres bersama.</span><span className="hidden sm:inline">Asia/Jakarta</span></footer>
    </main>
    {active && session && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#dce5d4] bg-white/95 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_#183c2006] backdrop-blur md:hidden"><div className="flex items-center gap-3"><button onClick={() => addManual()} className="flex flex-1 items-center gap-2 text-[11px] font-medium text-brand"><span className="grid size-9 place-items-center rounded-xl bg-brand-soft"><Plus size={16} /></span><span>Catat manual<span className="mt-0.5 block text-left text-[9px] font-normal text-ink-soft">{session.activities.length} aktivitas dalam draf</span></span></button><Button variant="primary" disabled={busy} onClick={() => void phase("review")} className="h-10 text-[11px]">Tinjau laporan <ArrowRight size={13} /></Button></div></div>}
    {editing && session && <ActivityEditor key={editing.id} initial={editing} session={session} me={memberId} busy={busy} note={suggestionNote} onClose={() => setEditing(null)} onSave={async activity => { const result = await room.act({ type: "upsert", activity }); if (result) notify("Aktivitas tersimpan di draf. Teks percakapan asli tetap utuh."); return Boolean(result); }} />}
    {showSuggestions && session && <SuggestionsModal session={session} onClose={() => setShowSuggestions(false)} onPick={(message, suggestion) => pickMessage(message, suggestion.text, suggestion)} />}
    <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Ajak tim ke percakapan" description="Buka tautan ini di tab atau perangkat lain untuk berkolaborasi." size="sm" footer={<Button onClick={() => setShowInvite(false)}>Selesai</Button>}>
      <div className="space-y-4"><span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Users size={23} /></span><p className="text-xs leading-relaxed text-ink-soft">Peserta dapat memilih identitas demo, mengirim pesan, dan menyusun aktivitas bersama. Pesan tersinkron setiap beberapa detik.</p><Field label="Tautan undangan" htmlFor="invite-url"><div className="flex gap-2"><Input id="invite-url" readOnly value={inviteUrl} className="min-w-0 text-[10px]" onFocus={e => e.target.select()} /><Button variant="primary" aria-label="Salin undangan" onClick={async () => { const ok = await copyToClipboard(inviteUrl); setInviteCopied(ok); notify(ok ? "Tautan undangan disalin." : "Salin tautan secara manual dari kolom di samping.", ok ? "success" : "info"); }}>{inviteCopied ? <Check size={14} /> : <Copy size={14} />}</Button></div></Field><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-900">Siapa pun dengan tautan ini dapat melihat transkrip dan mengedit ruang. Jangan bagikan ke luar tim. Identitas demo belum diverifikasi dengan akun.</p></div>
    </Modal>
    <Modal
      open={showReference}
      onClose={() => setShowReference(false)}
      title="Referensi rapat"
      description={session ? `Laporan kemarin & hari ini untuk pendampingan diskusi · sesi ${formatLongDate(session.date)}` : undefined}
      size="md"
      footer={<Button onClick={() => setShowReference(false)}>Tutup</Button>}
    >
      {session ? (() => {
        const refDates = [prevWorkingDay(session.date, state.holidays ?? []), session.date];
        const divisions = (state.divisionReports ?? []).filter(r => refDates.includes(r.date));
        return <div className="space-y-4">
          {refDates.map(refDate => (
            <div key={`ours-${refDate}`}>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand"><FileCheck2 size={12} /> Tim kita · {formatMediumDate(refDate)}{refDate === session.date ? " (hari ini)" : " (kemarin)"}</p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-[#fbfaf6] p-2.5 font-sans text-[11.5px] leading-relaxed text-ink">{formatStandupForWhatsApp(state, refDate)}</pre>
            </div>
          ))}
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft"><BookOpen size={12} /> Divisi lain</p>
          {divisions.length ? divisions.map(r => (
            <details key={r.id} className="rounded-xl border border-line bg-white p-2.5">
              <summary className="cursor-pointer text-[11.5px] font-semibold text-ink">{r.division} · {formatMediumDate(r.date)}{r.author ? ` — ${r.author}` : ""}{r.time ? ` (${r.time} WIB)` : ""}</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-[11.5px] leading-relaxed text-ink-soft">{r.text}</pre>
            </details>
          )) : <p className="text-[11.5px] text-ink-soft">Tidak ada laporan divisi lain untuk kemarin/hari ini.</p>}
        </div>;
      })() : null}
    </Modal>
    <Modal open={showTranscript} onClose={() => setShowTranscript(false)} title="Transkrip percakapan asli" description="Tetap utuh meskipun aktivitas atau laporan telah diedit." size="md" footer={<Button onClick={() => setShowTranscript(false)}>Tutup</Button>}><div className="space-y-4">{session?.messages.map(m => <div key={m.id} className="border-b border-line pb-4"><p className="mb-2 text-xs font-semibold">{session.members.find(member => member.id === m.memberId)?.name}<span className="ml-2 text-[10px] font-normal text-ink-soft">{formatClock(m.at)} WIB {m.source === "demo" ? "· Contoh" : ""}</span></p><p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">{m.text}</p></div>)}{!session?.messages.length && <p className="text-xs text-ink-soft">Belum ada pesan di sesi ini.</p>}</div></Modal>
    <Modal open={showNew} onClose={() => setShowNew(false)} title="Mulai sesi baru" description="Sesi lama tetap tersimpan dan dapat dibuka melalui tautannya." size="sm" footer={<><Button onClick={() => setShowNew(false)}>Batal</Button><Button variant="primary" disabled={busy || newTitle.trim().length < 3 || !newDate} onClick={async () => { const created = await room.create({ title: newTitle, date: newDate, withDemo: newDemo }); if (created) { setShowNew(false); setEditing(null); } }}>Buat ruang baru <ArrowRight size={14} /></Button></>}><div className="space-y-4"><Field label="Nama sesi" htmlFor="new-session-title"><Input id="new-session-title" value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={100} /></Field><Field label="Tanggal laporan" htmlFor="new-session-date"><Input id="new-session-date" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} /></Field><label className="flex items-center gap-2 text-xs text-ink-soft"><input type="checkbox" checked={newDemo} onChange={e => setNewDemo(e.target.checked)} className="accent-teal-700" /> Sertakan percakapan contoh</label></div></Modal>
  </div>;
}
