import type { AppState, ItemKind, Member, StandupEntry, StandupItem, Task, TaskStatus } from "@/lib/types";
import { TASK_STATUSES } from "@/lib/types";

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; short: string; chip: string; dot: string; soft: string; order: number }
> = {
  belum: {
    label: "Belum Mulai",
    short: "Belum",
    chip: "border-slate-200 bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
    soft: "bg-slate-50",
    order: 0,
  },
  dikerjakan: {
    label: "Dikerjakan",
    short: "Dikerjakan",
    chip: "border-sky-200 bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
    soft: "bg-sky-50/70",
    order: 1,
  },
  terhambat: {
    label: "Terhambat",
    short: "Terhambat",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
    soft: "bg-amber-50/70",
    order: 2,
  },
  selesai: {
    label: "Selesai",
    short: "Selesai",
    chip: "border-teal-200 bg-teal-50 text-teal-700",
    dot: "bg-teal-600",
    soft: "bg-teal-50/70",
    order: 3,
  },
};

export function statusMeta(status: TaskStatus) {
  return TASK_STATUS_META[status] ?? TASK_STATUS_META.belum;
}

export function isTaskOverdue(task: Task, today: string): boolean {
  return Boolean(task.dueDate) && task.status !== "selesai" && (task.dueDate as string) < today;
}

export function entryItemCount(entry: StandupEntry): number {
  return entry.plans.length + entry.done.length + entry.blockers.length;
}

export function isEntryEmpty(entry: StandupEntry): boolean {
  return entryItemCount(entry) === 0;
}

export function findEntry(state: AppState, date: string, memberId: string): StandupEntry | undefined {
  return state.entries.find((entry) => entry.date === date && entry.memberId === memberId);
}

export function membersForEntry(state: AppState, entry: StandupEntry): Member | undefined {
  return state.members.find((member) => member.id === entry.memberId);
}

export function membersWithoutEntry(state: AppState, date: string): Member[] {
  return state.members.filter(
    (member) =>
      member.active !== false &&
      !state.entries.some((entry) => entry.date === date && entry.memberId === member.id && !isEntryEmpty(entry)),
  );
}

export type TaskStandupUpdate = {
  entry: StandupEntry;
  member?: Member;
  kind: ItemKind;
  item: StandupItem;
};

/** Riwayat standup sebuah tugas, diambil dari tautan item → tugas (snapshot teks). */
export function taskStandupUpdates(state: AppState, taskId: string): TaskStandupUpdate[] {
  const updates: TaskStandupUpdate[] = [];
  for (const entry of state.entries) {
    const member = state.members.find((m) => m.id === entry.memberId);
    (["plan", "done", "blocker"] as ItemKind[]).forEach((kind) => {
      const items = kind === "plan" ? entry.plans : kind === "done" ? entry.done : entry.blockers;
      items
        .filter((item) => item.taskId === taskId)
        .forEach((item) => updates.push({ entry, member, kind, item }));
    });
  }
  return updates.sort((a, b) => (a.entry.date < b.entry.date ? 1 : a.entry.date > b.entry.date ? -1 : 0));
}

export function taskStandupDates(state: AppState, taskId: string): string[] {
  return Array.from(new Set(taskStandupUpdates(state, taskId).map((update) => update.entry.date)));
}

export function lastStandupDate(state: AppState, taskId: string): string | undefined {
  return taskStandupDates(state, taskId)[0];
}

export type CarryCandidate = {
  task: Task;
  member: Member;
  lastDate?: string;
  /** true bila tugas sudah ada di rencana tanggal terpilih (tidak boleh diduplikasi). */
  alreadyPlanned: boolean;
};

/**
 * Kandidat "bawa tugas belum selesai": status bukan Selesai dan belum ada di rencana
 * tanggal terpilih untuk anggota yang sama.
 */
export function carryCandidates(state: AppState, date: string): CarryCandidate[] {
  const out: CarryCandidate[] = [];
  for (const task of state.tasks) {
    if (task.status === "selesai") continue;
    for (const assigneeId of task.assigneeIds) {
      const member = state.members.find((m) => m.id === assigneeId);
      if (!member || member.active === false) continue;
      const entry = findEntry(state, date, member.id);
      const alreadyPlanned = Boolean(entry?.plans.some((item) => item.taskId === task.id));
      out.push({
        task,
        member,
        lastDate: lastStandupDate(state, task.id),
        alreadyPlanned,
      });
    }
  }
  const rank = (status: TaskStatus) => TASK_STATUSES.indexOf(status);
  return out.sort((a, b) => {
    if (a.alreadyPlanned !== b.alreadyPlanned) return a.alreadyPlanned ? 1 : -1;
    if (rank(a.task.status) !== rank(b.task.status)) return rank(a.task.status) - rank(b.task.status);
    const aDue = a.task.dueDate ?? "9999-12-31";
    const bDue = b.task.dueDate ?? "9999-12-31";
    return aDue.localeCompare(bDue);
  });
}

export function taskCurrentStatus(state: AppState, taskId?: string): TaskStatus | undefined {
  if (!taskId) return undefined;
  return state.tasks.find((task) => task.id === taskId)?.status;
}

export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function shortId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
