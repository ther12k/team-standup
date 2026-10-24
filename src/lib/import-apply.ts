import type { Accent, AppState, ItemKind, Member, StandupEntry, StandupItem, Task } from "@/lib/types";
import { isValidISODate } from "@/lib/date";
import { normalizeForCompare } from "@/lib/tasks";
import { contentFingerprint, normalizeMemberName } from "@/lib/import-parser";

export type ImportItemDecision = {
  kind: ItemKind;
  text: string;
  taskId?: string;
  /** Bila diisi, aktivitas ini juga membuat tugas baru (status Belum Mulai). */
  createTask?: { title: string; project?: string; dueDate?: string };
};

export type ImportMemberDecision = {
  sourceName: string;
  memberId: string | null;
  createMember?: { name: string; role: string };
  activities: ImportItemDecision[];
};

export type ImportDecision = {
  reportDate: string;
  originalText: string;
  /** Waktu pesan sumber (mis. ekspor chat) — dipakai sebagai waktu catatan, bukan waktu impor. */
  sourceAt?: string;
  members: ImportMemberDecision[];
};

export type ImportSummary = {
  importId: string | null;
  entriesTouched: number;
  itemsAdded: number;
  itemsSkipped: number;
  tasksCreated: number;
  membersCreated: number;
  duplicateReport: boolean;
  saved: boolean;
};

export type ApplyImportResult = {
  state: AppState;
  summary: ImportSummary;
};

const ACCENTS: Accent[] = ["teal", "sky", "violet", "amber", "rose", "emerald", "indigo", "orange"];

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneState(state: AppState): AppState {
  return {
    version: 1,
    members: state.members.map((member) => ({ ...member })),
    tasks: state.tasks.map((task) => ({
      ...task,
      assigneeIds: [...task.assigneeIds],
      statusHistory: task.statusHistory.map((event) => ({ ...event })),
    })),
    entries: state.entries.map((entry) => ({
      ...entry,
      plans: entry.plans.map((item) => ({ ...item })),
      done: entry.done.map((item) => ({ ...item })),
      blockers: entry.blockers.map((item) => ({ ...item })),
    })),
    imports: state.imports.map((record) => ({ ...record, memberNames: [...record.memberNames] })),
    // Daftar libur adalah bagian workspace — jangan hilangkan saat mengimpor.
    ...(state.holidays ? { holidays: state.holidays.map((holiday) => ({ ...holiday })) } : {}),
  };
}

function itemList(entry: StandupEntry, kind: ItemKind): StandupItem[] {
  if (kind === "plan") return entry.plans;
  if (kind === "done") return entry.done;
  return entry.blockers;
}

/**
 * Menyimpan hasil impor secara idempoten:
 * - aktivitas dengan teks sama pada tanggal & anggota sama tidak diduplikasi,
 * - tugas yang sudah tertaut tidak ditautkan dua kali pada hari yang sama,
 * - laporan identik (fingerprint sama) tidak membuat catatan impor baru,
 * - tanggal standup tidak pernah dipakai sebagai tenggat tugas.
 */
export function applyImport(
  state: AppState,
  decision: ImportDecision,
  now: string = new Date().toISOString(),
): ApplyImportResult {
  const next = cloneState(state);
  const summary: ImportSummary = {
    importId: null,
    entriesTouched: 0,
    itemsAdded: 0,
    itemsSkipped: 0,
    tasksCreated: 0,
    membersCreated: 0,
    duplicateReport: false,
    saved: false,
  };

  if (!isValidISODate(decision.reportDate)) {
    return { state, summary };
  }
  // Waktu catatan: waktu pesan sumber bila ada (ekspor chat), jika tidak waktu impor.
  const stampedAt = decision.sourceAt && !Number.isNaN(Date.parse(decision.sourceAt)) ? decision.sourceAt : now;

  const resolvedGroups: { key: string; activities: { kind: ItemKind; text: string }[] }[] = [];
  const touchedEntryIds = new Set<string>();
  let resolvedAny = false;

  decision.members.forEach((memberDecision) => {
    const activities = memberDecision.activities.filter((activity) => activity.text.trim().length > 0);
    if (activities.length === 0) return;

    let member: Member | undefined = next.members.find((m) => m.id === memberDecision.memberId);
    if (!member && memberDecision.createMember?.name.trim()) {
      const wanted = normalizeMemberName(memberDecision.createMember.name);
      member = next.members.find((m) => normalizeMemberName(m.name) === wanted);
      if (!member) {
        member = {
          id: makeId("m"),
          name: memberDecision.createMember.name.trim(),
          role: memberDecision.createMember.role.trim() || "Anggota tim",
          accent: ACCENTS[next.members.length % ACCENTS.length],
        };
        next.members.push(member);
        summary.membersCreated += 1;
      }
    }
    if (!member) return;

    const resolvedMember = member;
    resolvedAny = true;
    resolvedGroups.push({
      key: resolvedMember.id,
      activities: activities.map((activity) => ({ kind: activity.kind, text: activity.text })),
    });

    let entry = next.entries.find((e) => e.date === decision.reportDate && e.memberId === resolvedMember.id);
    if (!entry) {
      entry = {
        id: makeId("e"),
        date: decision.reportDate,
        memberId: resolvedMember.id,
        plans: [],
        done: [],
        blockers: [],
        updatedAt: stampedAt,
        source: "import",
      };
      next.entries.push(entry);
    }

    activities.forEach((activity) => {
      const text = activity.text.trim();

      let taskId = activity.taskId && next.tasks.some((task) => task.id === activity.taskId)
        ? activity.taskId
        : undefined;
      if (!taskId && activity.createTask) {
        const title = (activity.createTask.title || text).trim();
        const existing = next.tasks.find(
          (task) =>
            normalizeForCompare(task.title) === normalizeForCompare(title) &&
            task.assigneeIds.includes(resolvedMember.id),
        );
        if (existing) {
          taskId = existing.id;
        } else {
          const task: Task = {
            id: makeId("t"),
            title,
            assigneeIds: [resolvedMember.id],
            project: activity.createTask.project?.trim() || undefined,
            dueDate: activity.createTask.dueDate && isValidISODate(activity.createTask.dueDate)
              ? activity.createTask.dueDate
              : undefined,
            status: "belum",
            createdAt: now,
            statusHistory: [
              { id: makeId("h"), status: "belum", at: now, note: "Dibuat dari impor standup" },
            ],
          };
          next.tasks.push(task);
          taskId = task.id;
          summary.tasksCreated += 1;
        }
      }

      const list = itemList(entry as StandupEntry, activity.kind);
      const normalized = normalizeForCompare(text);
      const duplicate = list.some((item) =>
        taskId ? item.taskId === taskId || normalizeForCompare(item.text) === normalized : normalizeForCompare(item.text) === normalized,
      );
      if (duplicate) {
        summary.itemsSkipped += 1;
        return;
      }
      list.push({ id: makeId("i"), text, taskId });
      summary.itemsAdded += 1;
      touchedEntryIds.add((entry as StandupEntry).id);
    });
  });

  if (!resolvedAny) {
    return { state, summary };
  }

  const fingerprint = contentFingerprint(decision.reportDate, resolvedGroups);
  summary.duplicateReport = next.imports.some((record) => record.fingerprint === fingerprint);

  if (summary.itemsAdded > 0) {
    const importId = makeId("im");
    next.imports.push({
      id: importId,
      reportDate: decision.reportDate,
      importedAt: now,
      originalText: decision.originalText,
      fingerprint,
      memberNames: resolvedGroups.map((group) => {
        const original = decision.members.find(
          (member) =>
            member.memberId === group.key ||
            (member.createMember && next.members.find((m) => m.id === group.key)?.name === member.createMember.name),
        );
        return original?.sourceName ?? next.members.find((m) => m.id === group.key)?.name ?? "Anggota";
      }),
      activityCount: summary.itemsAdded,
    });
    summary.importId = importId;
    summary.saved = true;
    next.entries.forEach((entry) => {
      if (touchedEntryIds.has(entry.id)) {
        entry.importId = importId;
        entry.updatedAt = stampedAt;
      }
    });
  }

  summary.entriesTouched = touchedEntryIds.size;
  return { state: next, summary };
}
