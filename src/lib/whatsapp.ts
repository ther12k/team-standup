import type { AppState, StandupEntry } from "@/lib/types";
import { formatLongDate, formatMediumDate } from "@/lib/date";
import { isEntryEmpty } from "@/lib/tasks";
import type { ReportResult } from "@/lib/report";

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

export function formatReportForWhatsApp(report: ReportResult): string {
  const lines: string[] = [
    `*Laporan Standup — ${formatMediumDate(report.start)}${report.end !== report.start ? ` s.d. ${formatMediumDate(report.end)}` : ""}*`,
    `_${report.plans} rencana • ${report.done} pekerjaan sebelumnya • ${report.blockers} kendala_`,
  ];

  if (report.groups.length === 0) {
    lines.push("", "Belum ada catatan pada rentang ini.");
  }

  report.groups.forEach((group) => {
    lines.push("", `*${group.title}*${group.subtitle ? ` — ${group.subtitle}` : ""}`);
    (["plan", "done", "blocker"] as const).forEach((kind) => {
      const items = group.lines
        .filter((line) => line.kind === kind)
        .map((line) => {
          const context = [
            report.groupBy === "project" ? line.memberName.split(" ")[0] : null,
            report.start === report.end ? null : formatMediumDate(line.date),
          ].filter(Boolean);
          return context.length > 0 ? `${line.text} (${context.join(", ")})` : line.text;
        });
      lines.push(...section(kind === "plan" ? "Rencana" : kind === "done" ? "Pekerjaan Sebelumnya" : "Kendala", items));
    });
  });

  if (report.missingMembers.length > 0) {
    lines.push("", "*Belum mengisi standup*");
    report.missingMembers.forEach((member) => lines.push(`• ${member.name} (${member.role})`));
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
