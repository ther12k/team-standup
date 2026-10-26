"use client";

import { useNavigate } from "react-router-dom";
import { Calendar, FileText, Maximize2 } from "lucide-react";
import { Link } from "@/components/link";
import { useStore } from "@/lib/store";
import { useUser } from "@/components/user-context";
import { ReportFeed } from "@/components/reports/report-feed";
import { Button, PageLoading } from "@/components/ui";

/**
 * Tampilan alternatif laporan berupa linimasa / feed (gaya Facebook),
 * di mana pengguna dapat menggulir (scroll) riwayat standup vertikal per hari.
 */
export default function LaporanFeedPage() {
  const navigate = useNavigate();
  const { state, hydrated, today } = useStore();
  const user = useUser();

  if (!hydrated) return <PageLoading label="Menyiapkan linimasa…" />;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
            <FileText className="h-3.5 w-3.5" /> Linimasa Standup
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">
            Gulir bebas seluruh riwayat standup tim per hari seperti feed sosial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/laporan"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12px] font-medium text-ink shadow-xs transition hover:bg-slate-50"
          >
            <Calendar className="size-3.5 text-brand" /> Tampilan Kalender
          </Link>
          <Link
            href="/laporan/lihat"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-teal-200 bg-brand-soft px-3 text-[12px] font-medium text-brand shadow-xs transition hover:bg-brand-soft/80"
          >
            <Maximize2 className="size-3.5" /> Fokus
          </Link>
        </div>
      </div>

      {/* Main Feed */}
      <ReportFeed
        data={state}
        today={today}
        teamDivision={user?.division ?? "M2MPD"}
        onSwitchToCalendar={() => navigate("/laporan")}
      />
    </div>
  );
}
