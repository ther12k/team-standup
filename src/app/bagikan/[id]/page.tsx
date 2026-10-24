/* eslint-disable react-hooks/set-state-in-effect -- kunci dari URL diambil sekali setelah hidrasi. */
"use client";

import { useEffect, useState } from "react";
import { Globe2, LockKeyhole, Share2 } from "lucide-react";
import { ActivitySections, ReportCard, TeamCard } from "@/components/reports/report-experience";
import { FocusBrand } from "@/components/focus-brand";
import { Button, PageLoading } from "@/components/ui";
import { buildReport } from "@/lib/report";
import { formatLongDate, formatMediumDate } from "@/lib/date";
import type { AppState } from "@/lib/types";

type SharePayload = {
  share: { start: string; end: string; groupBy: "member" | "project"; createdAt: string };
  state: AppState;
};

/**
 * Pembaca tautan berbagi laporan — publik, tanpa login, tetapi kunci akses
 * (parameter k=) wajib benar. Hanya entri pada rentang yang dibagikan yang
 * pernah dikirim server; anggota/tugas di luar rentang tidak ikut.
 */
export default function SharedReportPage() {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.pathname.split("/").filter(Boolean).pop() ?? "";
    const key = url.searchParams.get("k") ?? "";
    if (!key) {
      setError("Tautan ini tidak memuat kunci akses. Minta tautan lengkap dari pemilik laporan.");
      return;
    }
    const controller = new AbortController();
    fetch(`/api/shares/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Tautan berbagi tidak dapat dibuka.");
        return body as SharePayload;
      })
      .then(setPayload)
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Gagal membuka tautan."); });
    return () => controller.abort();
  }, [attempt]);

  const multiDay = payload ? payload.share.start !== payload.share.end : false;
  const report = payload ? buildReport(payload.state, payload.share.start, payload.share.end, payload.share.groupBy) : null;

  return <div className="focus-page">
    <header className="border-b border-[#e5e9e1] bg-white/80">
      <div className="focus-container-wide flex h-[58px] items-center justify-between gap-4"><FocusBrand subtitle="Laporan dibagikan" />
        <div className="flex items-center gap-3 text-[11px]"><span className="hidden items-center gap-1.5 text-ink-soft md:flex"><Globe2 size={13} /> Asia/Jakarta</span><span className="flex items-center gap-1.5 rounded-full border border-[#e2e7dc] bg-[#f7f9f3] px-2.5 py-1 text-[#647555]"><Share2 size={11} /> Baca-saja</span></div>
      </div>
    </header>
    <main className="focus-container-wide pb-5 pt-5 sm:pt-6">
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-semibold text-amber-900">Tautan tidak bisa dibuka</h2>
          <p className="mt-2 text-sm text-amber-800">{error}</p>
          <Button className="mt-4" onClick={() => { setError(""); setAttempt(v => v + 1); }}>Coba lagi</Button>
        </div>
      ) : !payload || !report ? (
        <PageLoading label="Membuka laporan yang dibagikan…" />
      ) : <>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              {multiDay
                ? `${formatMediumDate(payload.share.start)} – ${formatMediumDate(payload.share.end)}`
                : formatLongDate(payload.share.start)}
            </h1>
            <p className="mt-0.5 text-[12px] text-ink-soft">
              {payload.share.groupBy === "project" ? "Dikelompokkan per proyek" : "Dikelompokkan per tim"} · {report.lines.length} aktivitas · tautan ini mengikuti data terkini tim.
            </p>
          </div>
          <p className="flex items-center gap-1.5 text-[10.5px] text-ink-soft/70">
            <LockKeyhole size={12} /> Dibagikan {formatMediumDate(payload.share.createdAt)} · berlaku 180 hari
          </p>
        </div>
        {report.groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white py-10 text-center text-sm text-ink-soft">
            Belum ada catatan pada rentang yang dibagikan.
          </div>
        ) : payload.share.groupBy === "member" ? (
          (() => {
            const buckets: { title: string; memberCards: { group: ReturnType<typeof buildReport>["groups"][number]; member?: AppState["members"][number] }[] }[] = [];
            payload.state.members.forEach(member => {
              const group = report.groups.find(g => g.key === member.id);
              if (!group) return;
              const title = member.role || "Tanpa peran";
              let bucket = buckets.find(b => b.title === title);
              if (!bucket) { bucket = { title, memberCards: [] }; buckets.push(bucket); }
              bucket.memberCards.push({ group, member });
            });
            return <div className="grid items-start gap-3 sm:grid-cols-2">
              {buckets.map(bucket => <TeamCard key={bucket.title} title={bucket.title} memberCards={bucket.memberCards} data={payload.state} showDate={multiDay} />)}
            </div>;
          })()
        ) : (
          <div className="grid items-start gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {report.groups.map(group => <ReportCard key={group.key} group={group} data={payload.state} groupBy="project" showDate={multiDay} />)}
          </div>
        )}
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8dc] pt-3 text-[10px] text-ink-soft/60">
          <span className="flex items-center gap-1.5"><LockKeyhole size={12} /> Tautan berbagi baca-saja — hanya rentang tanggal ini yang terlihat.</span>
          <span>Ruang kerja tim <span className="mx-2">·</span> Dirangkum dengan Team Standup</span>
        </footer>
      </>}
    </main>
  </div>;
}
