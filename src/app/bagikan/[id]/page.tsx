/* eslint-disable react-hooks/set-state-in-effect -- kunci dari URL diambil sekali setelah hidrasi. */
"use client";

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlignJustify, Calendar, Globe2, LockKeyhole, Share2 } from "lucide-react";
import { ReportExperience } from "@/components/reports/report-experience";
import { ReportFeed } from "@/components/reports/report-feed";
import { FocusBrand } from "@/components/focus-brand";
import { Button, PageLoading, cn } from "@/components/ui";
import { formatMediumDate, todayInJakarta } from "@/lib/date";
import type { AppState } from "@/lib/types";

type SharePayload = {
  share: {
    start: string;
    end: string;
    groupBy: "member" | "project";
    createdAt: string;
    mode: "day" | "week";
    windowStart: string;
    windowEnd: string;
    division: string | null;
  };
  state: AppState;
};

/**
 * Pembaca tautan berbagi laporan — publik, tanpa login, tetapi kunci akses
 * (parameter k=) wajib benar. Mendukung dua tampilan:
 * 1. Tampilan Kalender (bawaan) — dengan bar tiket tanggal dan mode Harian/Mingguan.
 * 2. Tampilan Linimasa / Feed (alternatif gaya Facebook) — gulir vertikal per hari.
 */
export default function SharedReportPage({ initialView }: { initialView?: "calendar" | "feed" }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const key = searchParams.get("k") ?? "";
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Tentukan tampilan awal dari rute (/feed), query (?view=feed), atau prop.
  const isFeedRoute = location.pathname.endsWith("/feed") || searchParams.get("view") === "feed" || initialView === "feed";
  const [view, setView] = useState<"calendar" | "feed">(isFeedRoute ? "feed" : "calendar");

  useEffect(() => {
    setView(isFeedRoute ? "feed" : "calendar");
  }, [isFeedRoute]);

  useEffect(() => {
    if (!id || !key) {
      setError("Tautan ini tidak memuat kunci akses. Minta tautan lengkap dari pemilik laporan.");
      return;
    }
    const controller = new AbortController();
    fetch(`/api/shares/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Tautan berbagi tidak dapat dibuka.");
        return body as SharePayload;
      })
      .then(setPayload)
      .catch(e => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Gagal membuka tautan.");
      });
    return () => controller.abort();
  }, [id, key, attempt]);

  const switchView = (nextView: "calendar" | "feed") => {
    setView(nextView);
    if (!id) return;
    const basePath = location.pathname.startsWith("/bagikan") ? `/bagikan/${id}` : `/laporan/${id}`;
    const targetUrl = nextView === "feed" ? `${basePath}/feed?k=${key}` : `${basePath}?k=${key}`;
    navigate(targetUrl, { replace: true });
  };

  return (
    <div className="focus-page">
      <header className="border-b border-[#e5e9e1] bg-white/80">
        <div className="focus-container-wide flex h-[58px] items-center justify-between gap-4">
          <FocusBrand subtitle="Laporan dibagikan" />

          <div className="flex items-center gap-3 text-[11px]">
            {/* View Switcher: Kalender ↔ Linimasa/Feed */}
            {payload && (
              <div
                className="flex items-center gap-0.5 rounded-lg border border-line bg-[#eaf0e7] p-0.5"
                role="group"
                aria-label="Pilihan tampilan laporan"
              >
                <button
                  type="button"
                  onClick={() => switchView("calendar")}
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
                  onClick={() => switchView("feed")}
                  aria-pressed={view === "feed"}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    view === "feed" ? "bg-white text-ink shadow-xs" : "text-ink-soft hover:text-ink",
                  )}
                >
                  <AlignJustify className="size-3.5" /> Linimasa / Feed
                </button>
              </div>
            )}

            <span className="hidden items-center gap-1.5 text-ink-soft md:flex">
              <Globe2 size={13} /> Asia/Jakarta
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-[#e2e7dc] bg-[#f7f9f3] px-2.5 py-1 text-[#647555]">
              <Share2 size={11} /> Baca-saja
            </span>
          </div>
        </div>
      </header>

      <main className="focus-container-wide pb-5 pt-5 sm:pt-6">
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-amber-900">Tautan tidak bisa dibuka</h2>
            <p className="mt-2 text-sm text-amber-800">{error}</p>
            <Button
              className="mt-4"
              onClick={() => {
                setError("");
                setAttempt(v => v + 1);
              }}
            >
              Coba lagi
            </Button>
          </div>
        ) : !payload ? (
          <PageLoading label="Membuka laporan yang dibagikan…" />
        ) : (
          <>
            {view === "feed" ? (
              <ReportFeed
                data={payload.state}
                today={todayInJakarta()}
                teamDivision={payload.share.division}
                bounds={{ min: payload.share.windowStart, max: payload.share.windowEnd }}
                initialDate={payload.share.start}
                readOnly
                onSwitchToCalendar={() => switchView("calendar")}
              />
            ) : (
              <ReportExperience
                data={payload.state}
                today={todayInJakarta()}
                initialDate={payload.share.start}
                initialMode={payload.share.mode === "week" ? "mingguan" : "harian"}
                readOnly
                bounds={{ min: payload.share.windowStart, max: payload.share.windowEnd }}
                teamDivision={payload.share.division}
              />
            )}

            <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8dc] pt-3 text-[10px] text-ink-soft/60">
              <span className="flex items-center gap-1.5">
                <LockKeyhole size={12} /> Tautan berbagi baca-saja — tanggal di luar rentang yang dibagikan tampil terkunci; minta tautan baru untuk membukanya.
              </span>
              <span>
                Dibagikan {formatMediumDate(payload.share.createdAt)} · berlaku 180 hari <span className="mx-2">·</span> Dirangkum dengan Team Standup
              </span>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
