import type { AppState, ItemKind, TaskStatus } from "@/lib/types";
import { ITEM_KIND_LABEL } from "@/lib/types";
import { formatShortDate, isValidISODate } from "@/lib/date";
import { isEntryEmpty } from "@/lib/tasks";

export type ReportGroupBy = "member" | "project";

export type ReportLine = {
  entryId: string;
  date: string;
  memberId: string;
  memberName: string;
  memberRole: string;
  project: string;
  kind: ItemKind;
  text: string;
  taskId?: string;
  taskTitle?: string;
  /** Status tugas SAAT INI — bukan status pada tanggal laporan. */
  taskStatus?: TaskStatus;
};

export type ReportGroup = {
  key: string;
  title: string;
  subtitle: string;
  lines: ReportLine[];
  dates: string[];
};

export type ReportResult = {
  start: string;
  end: string;
  groupBy: ReportGroupBy;
  groups: ReportGroup[];
  lines: ReportLine[];
  plans: number;
  done: number;
  blockers: number;
  entryCount: number;
  activeMembers: { id: string; name: string }[];
  missingMembers: { id: string; name: string; role: string }[];
  /** Denominator "X/Y anggota" — hanya anggota aktif. */
  activeMemberCount: number;
};

const NO_PROJECT = "Tanpa proyek / lokasi";

export function currentTaskStatus(state: AppState, taskId?: string): TaskStatus | undefined {
  if (!taskId) return undefined;
  return state.tasks.find((task) => task.id === taskId)?.status;
}

export function buildReport(
  state: AppState,
  start: string,
  end: string,
  groupBy: ReportGroupBy = "member",
): ReportResult {
  const safeStart = isValidISODate(start) ? start : end;
  const safeEnd = isValidISODate(end) ? end : safeStart;
  const entries = state.entries
    .filter((entry) => entry.date >= safeStart && entry.date <= safeEnd && !isEntryEmpty(entry))
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));

  const lines: ReportLine[] = [];
  entries.forEach((entry) => {
    const member = state.members.find((m) => m.id === entry.memberId);
    const push = (kind: ItemKind, items: typeof entry.plans) => {
      items.forEach((item) => {
        const task = item.taskId ? state.tasks.find((t) => t.id === item.taskId) : undefined;
        lines.push({
          entryId: entry.id,
          date: entry.date,
          memberId: entry.memberId,
          memberName: member?.name ?? "Anggota tidak dikenal",
          memberRole: member?.role ?? "",
          project: item.project?.trim() || item.projectSnapshot || task?.project?.trim() || NO_PROJECT,
          kind,
          text: item.text,
          taskId: item.taskId,
          taskTitle: task?.title,
          taskStatus: task?.status,
        });
      });
    };
    push("plan", entry.plans);
    push("done", entry.done);
    push("blocker", entry.blockers);
  });

  const groupMap = new Map<string, ReportGroup>();
  lines.forEach((line) => {
    const key = groupBy === "member" ? line.memberId : line.project;
    const title = groupBy === "member" ? line.memberName : line.project;
    let group = groupMap.get(key);
    if (!group) {
      group = {
        key,
        title,
        subtitle: groupBy === "member" ? line.memberRole : "",
        lines: [],
        dates: [],
      };
      groupMap.set(key, group);
    }
    group.lines.push(line);
    if (!group.dates.includes(line.date)) group.dates.push(line.date);
  });

  const kindRank: Record<ItemKind, number> = { plan: 0, done: 1, blocker: 2 };
  const groups = Array.from(groupMap.values()).map((group) => ({
    ...group,
    dates: [...group.dates].sort(),
    lines: group.lines.slice().sort((a, b) => {
      if (groupBy === "project" && a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (kindRank[a.kind] !== kindRank[b.kind]) return kindRank[a.kind] - kindRank[b.kind];
      // Dalam rentang multi-hari, urutkan menurut tanggal sebelum teks.
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.text.localeCompare(b.text, "id");
    }),
  }));
  groups.sort((a, b) => {
    if (a.title === NO_PROJECT) return 1;
    if (b.title === NO_PROJECT) return -1;
    return a.title.localeCompare(b.title, "id");
  });

  const activeMembers = Array.from(new Set(entries.map((entry) => entry.memberId)))
    .map((id) => state.members.find((member) => member.id === id))
    .filter((member): member is NonNullable<typeof member> => Boolean(member))
    .map((member) => ({ id: member.id, name: member.name }));

  const activeIds = new Set(activeMembers.map((member) => member.id));
  // Anggota non-aktif (resign) tidak dihitung "belum mengisi" — riwayatnya tetap ada di grup.
  const missingMembers = state.members
    .filter((member) => member.active !== false && !activeIds.has(member.id))
    .map((member) => ({ id: member.id, name: member.name, role: member.role }));

  const activeMemberCount = state.members.filter((member) => member.active !== false).length;

  return {
    start: safeStart,
    end: safeEnd,
    groupBy,
    groups,
    lines,
    plans: lines.filter((line) => line.kind === "plan").length,
    done: lines.filter((line) => line.kind === "done").length,
    blockers: lines.filter((line) => line.kind === "blocker").length,
    entryCount: entries.length,
    activeMembers,
    missingMembers,
    activeMemberCount,
  };
}

export function reportRangeLabel(report: Pick<ReportResult, "start" | "end">): string {
  if (report.start === report.end) return formatShortDate(report.start);
  return `${formatShortDate(report.start)} – ${formatShortDate(report.end)}`;
}

export function reportToCsv(report: ReportResult): string {
  const header = [
    "Tanggal",
    "Anggota",
    "Jenis",
    "Aktivitas",
    "Proyek / Lokasi",
    "Tugas Terkait",
    "Status Tugas Saat Ini",
  ];
  const rows = report.lines.map((line) => [
    line.date,
    line.memberName,
    ITEM_KIND_LABEL[line.kind],
    line.text,
    line.project,
    line.taskTitle ?? "",
    line.taskStatus ? line.taskStatus : "",
  ]);
  const missing = report.missingMembers.map((member) => [report.start, member.name, "Tanpa catatan", "", "", "", ""]);
  const escape = (value: string) => {
    const text = String(value ?? "");
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...rows, ...missing].map((row) => row.map(escape).join(",")).join("\r\n");
}
