import type { AppState, ItemKind, Member, StandupEntry, StandupItem, Task } from "@/lib/types";
import { isValidISODate } from "@/lib/date";

export type LivePhase = "active" | "review" | "published";
export type LiveMessage = {
  id: string;
  memberId: string;
  text: string;
  at: string;
  source: "typed" | "voice" | "demo";
};
export type LiveActivity = {
  id: string;
  memberId: string;
  text: string;
  kind: ItemKind;
  taskId?: string;
  createTask: boolean;
  messageId?: string;
  origin: "transcript" | "manual";
};
export type LiveSession = {
  id: string;
  title: string;
  date: string;
  phase: LivePhase;
  startedAt: string;
  endedAt?: string;
  publishedAt?: string;
  members: Member[];
  tasks: Task[];
  messages: LiveMessage[];
  activities: LiveActivity[];
  revision: number;
};
export type LiveAction =
  | { type: "message"; message: Omit<LiveMessage, "at"> }
  | { type: "upsert"; activity: LiveActivity }
  | { type: "remove"; activityId: string }
  | { type: "phase"; phase: LivePhase };
export type PublishedReport = { state: AppState; date: string; title: string; publishedAt: string };
export type RoomCredentials = { id: string; key: string; viewKey: string };
export type LiveSuggestion = { text: string; kind: ItemKind; note: string; explicit: boolean };

export function newLiveId(prefix = "live"): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

/** Conservative, deterministic demo suggestions. Never presented as an external AI service. */
export function suggestFromTranscript(text: string): LiveSuggestion[] {
  const chunks = text.trim().split(/\n+|(?<=[.!?])\s+/u).filter(Boolean);
  return chunks.slice(0, 8).flatMap((chunk): LiveSuggestion[] => {
    if (/^(selamat|halo|terima kasih|ceritakan|apa|bagaimana|silakan|kita mulai)\b/i.test(chunk) || chunk.endsWith("?")) return [];
    if (!/\b(akan|rencana|selesai|sudah|kendala|menunggu|terhambat|butuh|cek|pantau|monitoring|ganti|rekap|serah|perbaiki)\b/i.test(chunk)) return [];
    const negation = /\b(belum|tidak|nggak|gak|jangan|bukan)\b/i.test(chunk);
    const future = /\b(akan|rencana|nanti|besok|target|ingin)\b/i.test(chunk);
    const blocker = /\b(kendala|menunggu|terhambat|butuh bantuan|belum tersedia|belum datang)\b/i.test(chunk);
    const done = !negation && !future && /\b(sudah|telah)\s+(?:saya\s+)?(?:selesai|beres|diganti|diperbaiki|dikirim|diserahkan)|\bselesai\s+(?:saya\s+)?(?:mengganti|memperbaiki|rekap|dikerjakan)|^selesai\s*:/i.test(chunk);
    const kind: ItemKind = blocker ? "blocker" : done ? "done" : "plan";
    const otherDate = /\b(kemarin|besok|minggu lalu)\b/i.test(chunk);
    return [{
      text: chunk.replace(/^(?:hari ini[,]?\s+)?(?:saya\s+)?(?:akan\s+|rencana saya\s+)/i, "").replace(/[.!]$/, "").trim(),
      kind,
      explicit: (done || blocker || future) && !otherDate,
      note: otherDate
        ? "Ada keterangan tanggal lain. Periksa tanggal laporan dan jenis aktivitas."
        : done ? "Penyelesaian disebut secara eksplisit. Tetap periksa sebelum menambahkan."
          : blocker ? "Ada hambatan yang disebutkan. Periksa penanggung jawabnya."
            : "Draf rencana, bukan pekerjaan selesai. Konfirmasi jenis dan pemilik aktivitas.",
    }];
  });
}

export function createLiveSession(input: {
  id: string; title: string; date: string; members: Member[]; tasks: Task[]; withDemo: boolean;
}, now = new Date().toISOString()): LiveSession {
  if (!isValidISODate(input.date) || !input.members.length) throw new Error("Tanggal dan anggota sesi wajib diisi.");
  const examples = [
    ["m-raka", "Selamat pagi, tim! Kita mulai standup hari ini. Ceritakan rencana, yang sudah selesai, dan kendala masing-masing."],
    ["m-bima", "Hari ini saya lanjutkan penyempurnaan modul laporan penjualan dan review pull request kemarin."],
    ["m-sinta", "Saya sudah selesai menulis pengujian otomatis untuk alur pendaftaran. Tinggal rapikan dokumentasinya."],
    ["m-galang", "Kendala: perangkat demo di pelanggan masih menunggu penggantian adapter. Butuh bantuan tim gudang cek stok."],
  ];
  return {
    id: input.id, title: input.title.trim(), date: input.date, phase: "active", startedAt: now,
    members: input.members, tasks: input.tasks, activities: [], revision: 0,
    messages: input.withDemo ? examples.filter(([id]) => input.members.some(m => m.id === id)).map(([memberId, text], i) => ({
      id: `sample-${i}`, memberId, text, at: new Date(new Date(now).getTime() - (4 - i) * 40_000).toISOString(), source: "demo",
    })) : [],
  };
}

/** Immutable room operations; the API serializes these inside a database transaction. */
export function reduceLiveSession(session: LiveSession, action: LiveAction, now = new Date().toISOString()): LiveSession {
  const memberExists = (id: string) => session.members.some(m => m.id === id);
  if (action.type === "message") {
    if (session.phase !== "active") throw new Error("Percakapan sudah dijeda. Lanjutkan sesi untuk mengirim pesan.");
    if (!memberExists(action.message.memberId) || !action.message.text.trim()) throw new Error("Anggota atau pesan tidak valid.");
    if (session.messages.some(m => m.id === action.message.id)) return session;
    if (session.messages.length >= 500) throw new Error("Batas 500 pesan tercapai. Terbitkan laporan dan mulai sesi baru.");
    return { ...session, messages: [...session.messages, { ...action.message, text: action.message.text.trim(), at: now }], revision: session.revision + 1 };
  }
  if (action.type === "phase") {
    if (action.phase === session.phase) return session;
    if (action.phase === "published") {
      if (session.phase !== "review") throw new Error("Tinjau laporan sebelum menerbitkan.");
      if (!session.activities.length) throw new Error("Tambahkan minimal satu aktivitas sebelum menerbitkan.");
    }
    return { ...session, phase: action.phase, endedAt: action.phase === "active" ? undefined : session.endedAt ?? now,
      publishedAt: action.phase === "published" ? now : session.publishedAt, revision: session.revision + 1 };
  }
  if (session.phase === "published") throw new Error("Pilih Ubah laporan untuk mengedit laporan yang sudah diterbitkan.");
  if (action.type === "remove") {
    return { ...session, activities: session.activities.filter(a => a.id !== action.activityId), revision: session.revision + 1 };
  }
  const activity = { ...action.activity, text: action.activity.text.trim() };
  if (!memberExists(activity.memberId) || !activity.text) throw new Error("Pemilik dan teks aktivitas wajib diisi.");
  if (activity.taskId && !session.tasks.some(t => t.id === activity.taskId)) throw new Error("Tugas terkait tidak ditemukan.");
  if (activity.taskId && activity.createTask) throw new Error("Pilih tugas yang ada atau buat baru, bukan keduanya.");
  if (activity.messageId && !session.messages.some(m => m.id === activity.messageId)) throw new Error("Sumber transkrip tidak ditemukan.");
  const exists = session.activities.some(a => a.id === activity.id);
  if (!exists && activity.messageId && session.activities.some(a => a.messageId === activity.messageId && a.memberId === activity.memberId && a.kind === activity.kind && a.text === activity.text)) return session;
  if (!exists && session.activities.length >= 200) throw new Error("Batas 200 aktivitas tercapai.");
  return { ...session, activities: exists ? session.activities.map(a => a.id === activity.id ? activity : a) : [...session.activities, activity], revision: session.revision + 1 };
}

const sectionKey = { plan: "plans", done: "done", blocker: "blockers" } as const;

/** Re-publishing replaces ONLY this session's rows. Unrelated standups and tasks are untouched. */
export function applyLiveReport(state: AppState, session: LiveSession): AppState {
  if (session.phase !== "published" || !session.publishedAt) return state;
  const next: AppState = {
    ...state,
    members: [...state.members], tasks: [...state.tasks],
    entries: state.entries.map(entry => ({ ...entry,
      plans: entry.plans.filter(i => i.sourceSessionId !== session.id),
      done: entry.done.filter(i => i.sourceSessionId !== session.id),
      blockers: entry.blockers.filter(i => i.sourceSessionId !== session.id),
    })),
  };
  for (const member of session.members) {
    if (!next.members.some(m => m.id === member.id)) next.members.push(member);
  }
  for (const activity of session.activities) {
    let taskId = activity.taskId;
    if (taskId && !next.tasks.some(t => t.id === taskId)) {
      const linked = session.tasks.find(t => t.id === taskId);
      if (linked) next.tasks.push(linked);
    }
    if (activity.createTask) {
      taskId = `t-live-${activity.id}`;
      if (!next.tasks.some(t => t.id === taskId)) next.tasks.push({
        id: taskId, title: activity.text, assigneeIds: [activity.memberId], status: "belum",
        createdAt: session.publishedAt,
        statusHistory: [{ id: `h-${activity.id}`, status: "belum", at: session.publishedAt, note: "Dibuat dari Standup Live. Status dikonfirmasi terpisah." }],
      });
    }
    let entry = next.entries.find(e => e.date === session.date && e.memberId === activity.memberId);
    if (!entry) {
      entry = { id: `e-live-${session.id}-${activity.memberId}`, date: session.date, memberId: activity.memberId,
        plans: [], done: [], blockers: [], updatedAt: session.publishedAt, source: "live" } satisfies StandupEntry;
      next.entries.push(entry);
    }
    const item: StandupItem = {
      id: `i-live-${activity.id}`, text: activity.text, taskId, sourceSessionId: session.id,
      projectSnapshot: taskId ? next.tasks.find(t => t.id === taskId)?.project : undefined,
    };
    entry[sectionKey[activity.kind]].push(item);
    entry.updatedAt = session.publishedAt;
  }
  next.entries = next.entries.filter(e => e.plans.length + e.done.length + e.blockers.length > 0);
  return next;
}

export function liveReportSnapshot(session: LiveSession): PublishedReport {
  const state = applyLiveReport({ version: 1, members: session.members, tasks: [], entries: [], imports: [] }, session);
  // Reader tokens never expose task notes/status-history or private conversation data.
  state.tasks = state.tasks.map(task => ({
    id: task.id, title: task.title, assigneeIds: task.assigneeIds, project: task.project,
    status: task.status, createdAt: task.createdAt, statusHistory: [],
  }));
  return { state, date: session.date, title: session.title, publishedAt: session.publishedAt ?? session.startedAt };
}
