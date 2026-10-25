/* eslint-disable react-hooks/set-state-in-effect -- kunci dari URL diambil sekali setelah hidrasi. */
"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Globe2, LockKeyhole, Share2 } from "lucide-react";
import { ActivitySections, ReportCard, TeamCard } from "@/components/reports/report-experience";
import { FocusBrand } from "@/components/focus-brand";
import { Button, PageLoading } from "@/components/ui";
import { buildReport } from "@/lib/report";
import { addDays, formatLongDate, formatMediumDate } from "@/lib/date";
import { SHARE_DAY_LOOKBACK, SHARE_WEEK_LOOKBACK_WEEKS } from "@/lib/share";
import type { AppState } from "@/lib/types";

type SharePayload = {
  share: { start: string; end: string; groupBy: "member" | "project"; createdAt: string; mode: "day" | "week"; windowStart: string };
  state: AppState;
};

/**
 * Pembaca tautan berbagi laporan — publik, tanpa login, tetapi kunci akses
 * (parameter k=) wajib benar. Server hanya mengirim entri pada rentang yang
 * dibagikan plus jendela navigasi mundurnya (10 hari untuk tautan harian,
 * 1 minggu sebelumnya untuk mingguan); anggota/tugas di luar itu tidak ikut.
 */
export default function SharedReportPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const key = searchParams.get("k") ?? "";
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!id || !key) {
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
      .then(body => { setPayload(body); setOffset(0); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Gagal membuka tautan."); });
    return () => controller.abort();
  }, [id, key, attempt]);

  const share = payload?.share;
  const mode = share?.mode ?? "day";
  const stepDays = mode === "day" ? 1 : 7;
  const maxOffset = mode === "day" ? SHARE_DAY_LOOKBACK : SHARE_WEEK_LOOKBACK_WEEKS;
  // offset = langkah mundur dari rentang yang dibagikan; 0 = rentang aslinya.
  const rangeStart = share ? addDays(share.start, -stepDays * offset) : "";
  const rangeEnd = share
    ? mode === "day"
      ? rangeStart
      : addDays(share.start, -stepDays * offset + Math.round((Date.parse(share.end) - Date.parse(share.start)) / 86_400_000))
    : "";
  const multiDay = rangeStart !== rangeEnd;
  const report = payload && share ? buildReport(payload.state, rangeStart, rangeEnd, share.groupBy) : null;
  const navLabel = mode === "day" ? "hari" : "minggu";

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
      ) : !payload || !report || !share ? (
        <PageLoading label="Membuka laporan yang dibagikan…" />
      ) : <>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center rounded-lg border border-line bg-white p-0.5 shadow-sm" role="group" aria-label={`Navigasi ${navLabel}`}>
                <button
                  type="button"
                  onClick={() => setOffset(o => Math.min(maxOffset, o + 1))}
                  disabled={offset >= maxOffset}
                  aria-label={`${navLabel} sebelumnya`}
                  title={offset >= maxOffset ? `Batas mundur: ${maxOffset === 1 ? "minggu sebelumnya saja" : `${maxOffset} hari sebelumnya`}` : `${navLabel} sebelumnya`}
                  className="grid size-7 place-items-center rounded-md text-ink-soft transition hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-ink-soft"
                ><ChevronLeft size={15} /></button>
                <span className="min-w-9 text-center text-[10.5px] font-medium tabular-nums text-ink-soft" title="Posisi navigasi mundur dari rentang yang dibagikan">{offset}/{maxOffset}</span>
                <button
                  type="button"
                  onClick={() => setOffset(o => Math.max(0, o - 1))}
                  disabled={offset === 0}
                  aria-label={`${navLabel} berikutnya`}
                  title={offset === 0 ? "Sudah di rentang yang dibagikan" : `Kembali ke ${navLabel} berikutnya`}
                  className="grid size-7 place-items-center rounded-md text-ink-soft transition hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-ink-soft"
                ><ChevronRight size={15} /></button>
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-ink">
                {multiDay
                  ? `${formatMediumDate(rangeStart)} – ${formatMediumDate(rangeEnd)}`
                  : formatLongDate(rangeStart)}
              </h1>
              {offset > 0 ? (
                <button
                  type="button"
                  onClick={() => setOffset(0)}
                  className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 transition hover:bg-amber-100"
                  title="Kembali ke rentang yang dibagikan pemilik tautan"
                >Sebelum rentang dibagikan · kembali</button>
              ) : null}
            </div>
            <p className="mt-0.5 text-[12px] text-ink-soft">
              {share.groupBy === "project" ? "Dikelompokkan per proyek" : "Dikelompokkan per tim"} · {report.lines.length} aktivitas · tautan ini mengikuti data terkini tim.
            </p>
          </div>
          <p className="flex items-center gap-1.5 text-[10.5px] text-ink-soft/70">
            <LockKeyhole size={12} /> Dibagikan {formatMediumDate(share.createdAt)} · berlaku 180 hari
          </p>
        </div>
        {report.groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white py-10 text-center text-sm text-ink-soft">
            Belum ada catatan pada {multiDay ? "rentang ini" : "tanggal ini"}.
          </div>
        ) : share.groupBy === "member" ? (
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
          <span className="flex items-center gap-1.5">
            <LockKeyhole size={12} /> Tautan berbagi baca-saja — hanya rentang yang dibagikan
            {mode === "day" ? ` dan ${maxOffset} hari sebelumnya` : ` serta ${maxOffset === 1 ? "minggu sebelumnya" : `${maxOffset} minggu sebelumnya`}`} yang terlihat.
          </span>
          <span>Ruang kerja tim <span className="mx-2">·</span> Dirangkum dengan Team Standup</span>
        </footer>
      </>}
    </main>
  </div>;
}
