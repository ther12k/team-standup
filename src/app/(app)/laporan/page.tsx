"use client";

import { Link } from "@/components/link";
import { FileText, Maximize2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { ReportExperience } from "@/components/reports/report-experience";
import { PageLoading } from "@/components/ui";

/**
 * Menu Laporan: pengalaman yang sama persis dengan tampilan fokus /laporan/lihat
 * (bar tanggal, chip divisi lain, daftar per tim) — hanya dibungkus shell aplikasi.
 */
export default function LaporanPage() {
  const { state, hydrated, today } = useStore();
  if (!hydrated) return <PageLoading label="Menyiapkan laporan…" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
            <FileText className="h-3.5 w-3.5" /> Laporan
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">
            Rencana dan pekerjaan selesai seperti saat dicatat; chip Divisi lain memuat laporan referensi.
          </p>
        </div>
        <Link
          href="/laporan/lihat"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-teal-200 bg-brand-soft px-3 text-[12px] font-medium text-brand"
        >
          <Maximize2 className="size-3.5" /> Tampilan fokus
        </Link>
      </div>
      <ReportExperience data={state} today={today} />
    </div>
  );
}
