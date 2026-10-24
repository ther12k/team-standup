 
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, AudioLines, Check, ChevronDown, FileText, MessageCircle, Mic, MicOff, Plus, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Avatar, Button, EmptyState, Modal, cn } from "@/components/ui";
import type { LiveMessage, LiveSession } from "@/lib/live";
import { newLiveId } from "@/lib/live";
import { formatClock } from "@/lib/date";
import { useDictation } from "@/lib/use-dictation";

export function Conversation({ session, me, busy, onSend, onPick, onSuggest }: {
  session: LiveSession; me: string; busy: boolean;
  onSend: (message: Omit<LiveMessage, "at">) => Promise<boolean>;
  onPick: (message: LiveMessage, snippet: string) => void;
  onSuggest: () => void;
}) {
  const [tab, setTab] = useState<"chat" | "transcript">("chat");
  const [text, setText] = useState(() => { try { return sessionStorage.getItem(`live-draft-${session.id}-${me}`) ?? ""; } catch { return ""; } });
  const [source, setSource] = useState<"typed" | "voice">("typed");
  const [draftId, setDraftId] = useState(() => newLiveId("msg"));
  const [consent, setConsent] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const onFinal = useCallback((words: string) => { setText(current => `${current} ${words}`.trim().slice(0, 3000)); setSource("voice"); }, []);
  const voice = useDictation(onFinal);
  const disabled = session.phase !== "active";
  const stopDictation = voice.stop;

  useEffect(() => {
    try { sessionStorage.setItem(`live-draft-${session.id}-${me}`, text); } catch { /* Unsaved text remains in the composer. */ }
  }, [text, session.id, me]);
  useEffect(() => {
    if (follow.current && scroll.current) scroll.current.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" });
    else setHasNew(true);
  }, [session.messages.length]);
  useEffect(() => { if (disabled) stopDictation(); }, [disabled, stopDictation]);

  const send = async () => {
    if (!text.trim() || busy || disabled || voice.listening) return;
    if (await onSend({ id: draftId, memberId: me, text: text.trim(), source })) {
      setText(""); setSource("typed"); setDraftId(newLiveId("msg")); follow.current = true;
      window.setTimeout(() => scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" }), 80);
    }
  };
  const pick = (message: LiveMessage) => {
    const selected = window.getSelection()?.toString().trim();
    onPick(message, selected && message.text.includes(selected) ? selected : message.text);
  };
  return <section className="overflow-hidden rounded-2xl border border-[#e1e7dc] bg-white shadow-[0_2px_8px_#14362a03]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9ede4] px-5 py-4">
      <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><MessageCircle size={16} /></span><h2 className="text-sm font-semibold">Ruang percakapan</h2></div>
      <div className="flex rounded-lg bg-[#f2f4ef] p-1" role="tablist" aria-label="Tampilan percakapan">
        {([['chat', 'Obrolan'], ['transcript', 'Transkrip']] as const).map(([value, label]) => <button role="tab" aria-selected={tab === value} type="button" key={value} onClick={() => setTab(value)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] transition", tab === value ? "bg-white font-medium text-ink shadow-sm" : "text-ink-soft")}>{value === 'transcript' && <FileText size={12} />}{label}</button>)}
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ebe7f3] bg-[#f8f7fc] px-5 py-2.5"><p className="flex items-center gap-1.5 text-[10px] text-[#807294]"><Sparkles size={13} className="text-violet-500" /> Asisten transkrip <span className="rounded bg-[#ede7f8] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-violet-600">Demo</span></p><button type="button" onClick={onSuggest} className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-700 hover:underline">Tinjau saran aktivitas <ArrowUpRight size={12} /></button></div>
    <div ref={scroll} onScroll={e => { const el = e.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; if (follow.current) setHasNew(false); }} className="h-[390px] overflow-y-auto overscroll-contain px-5 py-5 sm:h-[420px]" role="log" aria-live="polite" aria-label="Percakapan standup">
      <div className="mb-5 flex items-center gap-3"><span className="h-px flex-1 bg-line/60" /><p className="text-[9px] uppercase tracking-[.1em] text-ink-soft/60">Percakapan sesi ini · WIB</p><span className="h-px flex-1 bg-line/60" /></div>
      {!session.messages.length ? <EmptyState icon={<MessageCircle size={20} />} title="Sapa tim, mulai ceritanya." description="Kirim rencana, pekerjaan selesai, atau kendala pertamamu. Pesan akan terlihat oleh semua pemegang tautan ruang." /> : <div className={tab === "transcript" ? "space-y-0" : "space-y-6"}>
        {session.messages.map(message => {
          const member = session.members.find(m => m.id === message.memberId);
          const mine = message.memberId === me;
          const selected = session.activities.filter(a => a.messageId === message.id).length;
          return <div key={message.id} className={cn("group flex gap-3", tab === "transcript" && "border-b border-line/70 py-4 first:pt-0")}>
            {tab === "chat" ? <Avatar name={member?.name ?? "Anggota"} accent={member?.accent} size="sm" className="mt-0.5" /> : <span className="mt-0.5 w-10 shrink-0 text-[10px] tabular-nums text-ink-soft/65">{formatClock(message.at)}</span>}
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-semibold">{member?.name ?? "Anggota"}</span>{mine && <span className="text-[9px] text-ink-soft">(Anda)</span>}<span className="ml-auto flex items-center gap-1.5 text-[9px] text-ink-soft/60">{message.source === "demo" && <span className="rounded bg-slate-100 px-1.5 py-0.5">Contoh</span>}{message.source === "voice" && <span className="flex items-center gap-1"><Mic size={10} /> Dikte</span>}{tab === "chat" && formatClock(message.at)}</span></div>
              <div className={cn(tab === "chat" && "live-bubble px-3.5 py-3", tab === "chat" && mine && "live-bubble-own")}><p className="whitespace-pre-wrap break-words text-[12.5px] leading-[1.85] text-[#435044]">{message.text}</p></div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">{selected ? <span className="flex items-center gap-1 text-[9px] text-brand"><Check size={10} /> {selected} aktivitas dipilih</span> : <span className="text-[9px] text-ink-soft/50">{tab === "transcript" ? "Pilih potongan teks, lalu ambil sebagai aktivitas" : ""}</span>}
                {!disabled && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(message)} className="inline-flex items-center gap-1 rounded-md border border-[#e1e8db] bg-white px-2 py-1 text-[10px] font-medium text-brand transition hover:border-brand hover:bg-brand-soft"><Plus size={11} /> Ambil aktivitas</button>}
              </div>
            </div>
          </div>;
        })}
      </div>}
    </div>
    {hasNew && <div className="-mt-5 mb-2 flex justify-center"><button onClick={() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" }); setHasNew(false); follow.current = true; }} className="z-10 flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 text-[10px] shadow-sm">Pesan baru <ArrowDown size={12} /></button></div>}
    <div className="border-t border-[#e9ede4] bg-[#fcfdfb] p-4">
      {voice.listening && <p role="status" className="mb-2 flex items-center gap-2 text-xs text-rose-600"><span className="flex h-4 items-center gap-0.5">{[8, 14, 10, 16, 7].map((n, i) => <i key={i} className="wave-bar" style={{ height: n }} />)}</span>Mendengarkan… <span className="font-normal text-ink-soft">{voice.interim || "bicara dalam Bahasa Indonesia"}</span></p>}
      {voice.error && <p role="alert" className="mb-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900">{voice.error}</p>}
      <div className={cn("rounded-xl border bg-white p-3 transition", voice.listening ? "border-rose-300 ring-2 ring-rose-100" : "border-[#dde5d6] focus-within:border-brand/50")}>
        <textarea aria-label="Pesan standup" value={text} onChange={e => { setText(e.target.value); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} rows={2} maxLength={3000} disabled={disabled} placeholder={disabled ? "Sesi dijeda. Lanjutkan sesi untuk mengirim pesan." : "Apa rencana, progres, atau kendalamu hari ini?"} className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-ink outline-none placeholder:text-ink-soft/45 disabled:opacity-60" />
        <div className="mt-2 flex items-center justify-between gap-2"><button type="button" disabled={disabled || busy} onClick={() => voice.listening ? voice.stop() : voice.available ? setConsent(true) : voice.start()} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] transition disabled:opacity-40", voice.listening ? "bg-rose-50 text-rose-600" : "text-ink-soft hover:bg-slate-50")}>
          {voice.listening ? <MicOff size={14} /> : <Mic size={14} />}{voice.listening ? "Hentikan dikte" : "Dikte suara"}</button><span className="ml-auto hidden text-[9px] text-ink-soft/40 sm:inline">Enter untuk kirim</span><Button variant="primary" size="sm" onClick={() => void send()} disabled={busy || !text.trim() || disabled || voice.listening} className="h-8 text-[11px]">{busy ? "Mengirim…" : "Kirim"}<Send size={12} /></Button></div>
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[9px] text-ink-soft/55"><ShieldCheck size={11} /> Hanya pesan yang dikirim disimpan. Dikte tidak merekam percakapan orang lain.</p>
    </div>
    <Modal open={consent} onClose={() => setConsent(false)} title="Gunakan dikte suara?" description="Mikrofon hanya menangkap suara Anda, bukan panggilan tim." size="sm" footer={<><Button onClick={() => setConsent(false)}>Batal</Button><Button variant="primary" onClick={() => { setConsent(false); voice.start(); }}><Mic size={14} /> Izinkan & mulai</Button></>}>
      <div className="space-y-3 text-xs leading-relaxed text-ink-soft"><p>Peramban akan meminta izin mikrofon dan mengubah ucapan Bahasa Indonesia menjadi teks. Periksa atau perbaiki teks sebelum menekan <strong>Kirim</strong>.</p><p className="rounded-xl bg-amber-50 p-3 text-amber-900">Peramban dapat memakai layanan pengenalan suaranya secara online. Aplikasi tidak menyimpan audio. Jika dikte tidak tersedia, gunakan input teks.</p><p>Klik <strong>Hentikan dikte</strong> untuk mematikan mikrofon. Mikrofon juga berhenti saat meninggalkan ruang.</p></div>
    </Modal>
  </section>;
}
