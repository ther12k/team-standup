import type { AppState, StandupEntry } from "@/lib/types";
import { formatLongDate, formatShortDate } from "@/lib/date";
import { isEntryEmpty } from "@/lib/tasks";
import type { ReportLine, ReportResult } from "@/lib/report";

function section(title: string, items: string[]): string[] {
  if (items.length === 0) return [];
  return [`_${title}_`, ...items.map((text) => `• ${text}`)];
}

export function formatStandupForWhatsApp(state: AppState, date: string): string {
  const lines: string[] = [`*Standup Harian — ${formatLongDate(date)}*`, "_Zona waktu: Asia/Jakarta_"];
  const entries = state.entries
    .filter((entry) => entry.date === date && !isEntryEmpty(entry))
    .slice()
    .sort(
      (a, b) =>
        state.members.findIndex((m) => m.id === a.memberId) -
        state.members.findIndex((m) => m.id === b.memberId),
    );

  if (entries.length === 0) {
    lines.push("", "Belum ada catatan standup untuk tanggal ini.");
    return lines.join("\n");
  }

  entries.forEach((entry) => {
    const member = state.members.find((m) => m.id === entry.memberId);
    const block: string[] = [];
    block.push(...section("Rencana", entry.plans.map((item) => item.text)));
    block.push(...section("Pekerjaan Sebelumnya", entry.done.map((item) => item.text)));
    block.push(...section("Kendala", entry.blockers.map((item) => item.text)));
    if (block.length === 0) return;
    lines.push("", `*${member?.name ?? "Anggota"}*${member?.role ? ` — ${member.role}` : ""}`, ...block);
  });

  return lines.join("\n");
}

/**
 * Judul bagian ringkasan ber-ikon. Label sengaja mengikuti format WhatsApp tim
 * ("Rencana Kerja Hari Ini", "Pekerjaan Selesai", "Kendala", penanda 👨‍💻, dan
 * bullet "*") supaya teks yang dibagikan bisa diimpor kembali lewat menu Impor.
 */
const REPORT_SECTIONS = [
  { kind: "plan", label: "🗓️ Rencana Kerja Hari Ini" },
  { kind: "done", label: "✅ Pekerjaan Selesai" },
  { kind: "blocker", label: "⛔ Kendala" },
] as const;

export function formatReportForWhatsApp(
  report: ReportResult,
  options?: { link?: string; memberOrder?: string[] },
): string {
  const singleDay = report.start === report.end;
  const dateLabel = singleDay
    ? formatShortDate(report.start)
    : `${formatShortDate(report.start)} – ${formatShortDate(report.end)}`;
  const lines: string[] = [`💬 Report ${singleDay ? "Daily" : "Weekly"} Stand Up – ${dateLabel}`];

  // Ringkasan selalu per anggota apa pun mode pengelompokan di layar; urutan
  // mengikuti daftar anggota (memberOrder), tanpa itu urutan kemunculan pertama.
  const order = new Map((options?.memberOrder ?? []).map((id, index) => [id, index] as const));
  const members = new Map<string, { id: string; name: string; lines: ReportLine[] }>();
  report.lines.forEach((line) => {
    const bucket = members.get(line.memberId) ?? { id: line.memberId, name: line.memberName, lines: [] };
    bucket.lines.push(line);
    members.set(line.memberId, bucket);
  });
  const blocks = Array.from(members.values()).sort((a, b) => {
    const rankA = order.get(a.id);
    const rankB = order.get(b.id);
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return 0; // urutan kemunculan dipertahankan (sort stabil)
  });

  if (blocks.length === 0) {
    lines.push("", "Belum ada catatan pada rentang ini.");
  }

  REPORT_SECTIONS.forEach(({ kind, label }) => {
    const withItems = blocks
      .map((block) => ({
        name: block.name,
        items: block.lines
          .filter((line) => line.kind === kind)
          .map((line) => `* ${line.text}${singleDay ? "" : ` (${formatShortDate(line.date)})`}`),
      }))
      .filter((block) => block.items.length > 0);
    if (withItems.length === 0) return;
    lines.push("", label, "");
    withItems.forEach((block, index) => {
      if (index > 0) lines.push("");
      lines.push(`👨‍💻 ${block.name}`, ...block.items);
    });
  });

  if (report.missingMembers.length > 0) {
    lines.push("", `⏳ Belum mengisi: ${report.missingMembers.map((member) => member.name).join(", ")}`);
  }

  if (options?.link) {
    lines.push("", options.link);
  }

  return lines.join("\n");
}

export function summarizeEntry(entry: StandupEntry): string {
  const parts = [
    entry.plans.length ? `${entry.plans.length} rencana` : null,
    entry.done.length ? `${entry.done.length} pekerjaan sebelumnya` : null,
    entry.blockers.length ? `${entry.blockers.length} kendala` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" • ") : "Belum diisi";
}
