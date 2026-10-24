"use client";

import { useMemo, useState } from "react";
import { Building2, FileText, Search, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Card, EmptyState, PageLoading, Pill, cn } from "@/components/ui";
import { DivisionReportModal } from "@/components/divisions/report-modal";
import { formatLongDate, formatMediumDate } from "@/lib/date";
import type { DivisionReport } from "@/lib/types";

export default function DivisiPage() {
  const { state, hydrated } = useStore();
  const [division, setDivision] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DivisionReport | null>(null);

  const reports = useMemo(
    () => [...(state.divisionReports ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [state.divisionReports],
  );

  const divisions = useMemo(() => {
    const counts = new Map<string, number>();
    reports.forEach((report) => counts.set(report.division, (counts.get(report.division) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [reports]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (division !== "all" && report.division !== division) return false;
      if (!query) return true;
      return `${report.division} ${report.author ?? ""} ${report.text}`.toLowerCase().includes(query);
    });
  }, [reports, division, search]);

  if (!hydrated) return <PageLoading />;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
          <Building2 className="h-3.5 w-3.5" /> Referensi lintas divisi
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[26px]">Divisi Lain</h1>
        <p className="mt-0.5 text-[13px] text-ink-soft">
          Laporan harian divisi lain sebagai referensi — laporan tim sendiri ada di menu Laporan.
        </p>
      </div>

      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari divisi, penulis, atau isi laporan…"
              aria-label="Cari laporan divisi"
              className="h-9 w-full rounded-xl border border-line bg-white pl-8 pr-8 text-[12.5px] text-ink shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none"
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} aria-label="Bersihkan pencarian" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-soft hover:bg-slate-100 hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill className={cn("cursor-pointer border-line", division === "all" ? "bg-brand-soft text-brand-dark" : "bg-white text-ink-soft")} >
              <button type="button" onClick={() => setDivision("all")} className="font-semibold">Semua {reports.length}</button>
            </Pill>
            {divisions.map(([name, count]) => (
              <Pill key={name} className={cn("cursor-pointer border-line", division === name ? "bg-brand-soft text-brand-dark" : "bg-white text-ink-soft")}>
                <button type="button" onClick={() => setDivision(name)} className="font-semibold">{name} {count}</button>
              </Pill>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title={search || division !== "all" ? "Tidak ada laporan yang cocok" : "Belum ada laporan divisi"}
            description={search || division !== "all" ? "Coba kata kunci lain atau pilih divisi berbeda." : "Laporan divisi lain dimuat dari server — pastikan server workspace dapat dihubungi."}
            icon={<FileText className="h-5 w-5" />}
            action={search || division !== "all" ? <Button onClick={() => { setSearch(""); setDivision("all"); }}>Hapus filter</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => setSelected(report)}
              className="flex w-full items-start gap-3 rounded-xl border border-line bg-white p-3 text-left shadow-sm transition-colors hover:border-teal-300 hover:bg-[#fdfdfb]"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-[9px] font-bold uppercase text-brand">
                {report.division === "Maintenance" ? "MNT" : report.division === "PM Project" ? "PM" : report.division === "Product" ? "PRD" : "RND"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-[13px] font-semibold text-ink">{report.division}</p>
                  <span className="text-[11px] text-ink-soft">{formatLongDate(report.date)}</span>
                  <span className="text-[10px] text-ink-soft/70">{report.author}{report.time ? ` · ${report.time} WIB` : ""}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-soft">{report.text.replace(/\n+/g, " · ").slice(0, 220)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <DivisionReportModal report={selected} onClose={() => setSelected(null)} />
      {filtered.length > 0 ? (
        <p className="text-[10.5px] text-ink-soft/70">
          {filtered.length} laporan{division !== "all" ? ` divisi ${division}` : ""} · terbaru {formatMediumDate(filtered[0].date)} — diambil dari arsip chat divisi, tanpa laporan tim sendiri.
        </p>
      ) : null}
    </div>
  );
}
