"use client";

import { Building2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { formatLongDate, formatMediumDate } from "@/lib/date";
import type { DivisionReport } from "@/lib/types";

/** Laporan terbaru tiap divisi dalam rentang [start, end]. */
export function latestPerDivisionInRange(reports: DivisionReport[], start: string, end: string): DivisionReport[] {
  const latest = new Map<string, DivisionReport>();
  reports.forEach((report) => {
    if (report.date < start || report.date > end) return;
    const existing = latest.get(report.division);
    if (!existing || report.date > existing.date) latest.set(report.division, report);
  });
  return [...latest.values()].sort((a, b) => a.division.localeCompare(b.division));
}

export function DivisionReportModal({ report, onClose }: { report: DivisionReport | null; onClose: () => void }) {
  return (
    <Modal
      open={Boolean(report)}
      onClose={onClose}
      title={report ? `${report.division} · ${formatLongDate(report.date)}` : ""}
      description={report ? `${report.author ?? "Divisi"}${report.time ? ` · ${report.time} WIB` : ""} · sumber: arsip chat divisi` : undefined}
      size="md"
      footer={<Button onClick={onClose}>Tutup</Button>}
    >
      {report ? (
        <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-[#fbfaf6] p-3 font-sans text-[12.5px] leading-relaxed text-ink">
          {report.text}
        </pre>
      ) : null}
    </Modal>
  );
}

export function DivisionChip({
  report,
  onClick,
}: {
  report: DivisionReport;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Lihat laporan ${report.division} ${formatMediumDate(report.date)}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e7dc] bg-white px-2.5 py-1 text-[10.5px] font-medium text-ink-soft shadow-sm transition-colors hover:border-teal-300 hover:bg-brand-soft hover:text-brand-dark"
    >
      <Building2 className="size-3 shrink-0 text-brand" />
      <span className="font-semibold text-ink">{report.division}</span>
      <span className="text-ink-soft/80">{formatMediumDate(report.date)}</span>
    </button>
  );
}
