/* eslint-disable react-hooks/set-state-in-effect -- URL fragment and query restored once after hydration. */
"use client";

import { useEffect, useState } from "react";
import { AlignJustify, Calendar, Globe2, LockKeyhole } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUser } from "@/components/user-context";
import { ReportExperience } from "@/components/reports/report-experience";
import { ReportFeed } from "@/components/reports/report-feed";
import { FocusBrand } from "@/components/focus-brand";
import { Button, PageLoading, cn } from "@/components/ui";
import { formatClock, isValidISODate } from "@/lib/date";
import type { PublishedReport } from "@/lib/live";

export default function ReportFocusPage() {
  const { state, hydrated, today, storageError } = useStore();
  const user = useUser();
  const [view, setView] = useState<"calendar" | "feed">("calendar");
  const [query, setQuery] = useState<{ room: string | null; key: string; date: string | null } | null>(null);
  const [remote, setRemote] = useState<PublishedReport | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const room = params.get("room");
    let key = hash.get("view") ?? "";
    try {
      if (room && key) sessionStorage.setItem(`standup-view-${room}`, key);
      if (room && !key) key = sessionStorage.getItem(`standup-view-${room}`) ?? "";
    } catch { /* The URL token still works when storage is unavailable. */ }
    setQuery({ room, key, date: params.get("date") });
  }, []);

  useEffect(() => {
    if (!query || !today) return;
    if (!query.room) return;
    const controller = new AbortController();
    setError("");
    fetch(`/api/live/rooms/${encodeURIComponent(query.room)}/report`, { headers: { Authorization: `Bearer ${query.key}` }, cache: "no-store", signal: controller.signal })
      .then(async res => { const body = await res.json(); if (!res.ok) throw new Error(body.error || "Laporan tidak dapat dibuka."); return body as PublishedReport; })
      .then(body => setRemote(body))
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Gagal membuka laporan."); });
    return () => controller.abort();
  }, [query, today, attempt]);

  const snapshot = Boolean(query?.room);
  const data = snapshot ? remote?.state ?? null : state;
  const initialDate = isValidISODate(query?.date ?? "") ? query?.date ?? null : remote?.date ?? null;

  return <div className="focus-page">
    <header className="border-b border-[#e5e9e1] bg-white/80">
      <div className="focus-container-wide flex h-[58px] items-center justify-between gap-4"><FocusBrand subtitle="Laporan tim" />
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-0.5 rounded-lg border border-line bg-[#eaf0e7] p-0.5" role="group" aria-label="Pilihan tampilan laporan">
            <button
              type="button"
              onClick={() => setView("calendar")}
              aria-pressed={view === "calendar"}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                view === "calendar" ? "bg-white text-ink shadow-xs" : "text-ink-soft hover:text-ink",
              )}
            >
              <Calendar className="size-3.5" /> Kalender
            </button>
            <button
              type="button"
              onClick={() => setView("feed")}
              aria-pressed={view === "feed"}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                view === "feed" ? "bg-white text-ink shadow-xs" : "text-ink-soft hover:text-ink",
              )}
            >
              <AlignJustify className="size-3.5" /> Linimasa / Feed
            </button>
          </div>
          <span className="hidden items-center gap-1.5 text-ink-soft md:flex"><Globe2 size={13} /> Asia/Jakarta</span>
          <span className="flex items-center gap-1.5 rounded-full border border-[#e2e7dc] bg-[#f7f9f3] px-2.5 py-1 text-[#647555]"><LockKeyhole size={11} /> Hanya lihat</span>
        </div>
      </div>
    </header>
    <main className="focus-container-wide pb-5 pt-5 sm:pt-6">
      {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-900">Laporan belum bisa dibuka</h2><p className="mt-2 text-sm text-amber-800">{error}</p><Button className="mt-4" onClick={() => setAttempt(v => v + 1)}>Coba lagi</Button></div>
        : !hydrated || !query ? <PageLoading label="Menyiapkan laporan…" /> : <>
        {storageError && !query.room && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{storageError}</p>}
        {view === "feed" ? (
          <ReportFeed data={data} today={today} teamDivision={user?.division ?? null} onSwitchToCalendar={() => setView("calendar")} />
        ) : (
          <ReportExperience data={data} today={today} snapshot={snapshot} initialDate={initialDate} teamDivision={user?.division ?? null} />
        )}
      </>}
      <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8dc] pt-3 text-[10px] text-ink-soft/60"><span className="flex items-center gap-1.5"><LockKeyhole size={12} /> {query?.room ? "Tautan baca-saja; percakapan dan transkrip tidak dibagikan." : "Data tim tersinkron lintas perangkat melalui server; laporan Live terbit tetap punya tautan baca-saja sendiri."}</span><span>{remote ? `Diterbitkan ${formatClock(remote.publishedAt)} WIB` : "Ruang kerja tim"} <span className="mx-2">·</span> Dirangkum dengan Team Standup</span></footer>
    </main>
  </div>;
}
