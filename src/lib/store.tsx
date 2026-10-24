/* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi awal dengan localStorage / data tanggal Asia/Jakarta setelah mount. */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Accent, AppState, Member, StandupEntry, StandupItem, Task, TaskStatus } from "@/lib/types";
import { isValidISODate, todayInJakarta } from "@/lib/date";
import { DEFAULT_HOLIDAYS } from "@/lib/workdays";
import { applyImport, type ImportDecision, type ImportSummary } from "@/lib/import-apply";
import { normalizeForCompare } from "@/lib/tasks";
import { applyLiveReport, type LiveSession } from "@/lib/live";

const STORAGE_KEY = "team-standup-demo-v1";
const BACKUP_KEY = "team-standup-demo-v1-backup";
const REVISION_KEY = "team-standup-demo-server-revision";
const WORKSPACE_TOKEN_KEY = "team-standup-wst";
const ACCENTS: Accent[] = ["teal", "sky", "violet", "amber", "rose", "emerald", "indigo", "orange"];

const EMPTY_STATE: AppState = { version: 1, members: [], tasks: [], entries: [], imports: [] };

/**
 * Header autentikasi workspace. Bila server mengatur WORKSPACE_ACCESS_TOKEN, pengguna
 * membuka aplikasi dengan `#wst=<token>` pada URL sekali; token disimpan lokal dan
 * dikirim ke semua permintaan /api/workspace.
 */
function workspaceHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = window.localStorage.getItem(WORKSPACE_TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch { /* tanpa penyimpanan: permintaan tetap dikirim tanpa token */ }
  return headers;
}

export type DraftItem = { id?: string; text: string; taskId?: string; project?: string };

export type EntryDraft = {
  date: string;
  memberId: string;
  plans: DraftItem[];
  done: DraftItem[];
  blockers: DraftItem[];
};

export type NewTaskInput = {
  title: string;
  assigneeIds: string[];
  project?: string;
  dueDate?: string;
  notes?: string;
  status?: TaskStatus;
};

type StoreValue = {
  state: AppState;
  hydrated: boolean;
  today: string;
  storageError: string | null;
  saveEntry: (draft: EntryDraft) => void;
  addMember: (name: string, role: string) => Member | null;
  createTask: (input: NewTaskInput) => Task | null;
  updateTask: (id: string, patch: Partial<Omit<Task, "id" | "statusHistory">>, note?: string) => void;
  changeTaskStatus: (id: string, status: TaskStatus, note?: string) => void;
  carryOver: (date: string, picks: { memberId: string; taskId: string }[]) => number;
  runImport: (decision: ImportDecision) => ImportSummary;
  syncLiveReport: (session: LiveSession) => void;
  resetDemo: () => void;
  addHoliday: (date: string, label: string) => void;
  removeHoliday: (date: string) => void;
  setMemberActive: (id: string, active: boolean) => void;
  dismissStorageError: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function cleanItems(items: DraftItem[]): StandupItem[] {
  return items
    .map((item) => ({ ...item, text: item.text.trim() }))
    .filter((item) => item.text.length > 0)
    .map((item) => ({
      id: item.id ?? uid("i"),
      text: item.text,
      taskId: item.taskId || undefined,
      project: item.project?.trim() || undefined,
    }));
}

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppState>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.members) &&
    Array.isArray(candidate.tasks) &&
    Array.isArray(candidate.entries) &&
    Array.isArray(candidate.imports)
  );
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [today, setToday] = useState("");
  const [storageError, setStorageError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const stateRef = useRef<AppState | null>(null);
  /** Revisi server terakhir yang diketahui peramban ini (tersimpan agar edit luring tidak tertimpa). */
  const serverRevisionRef = useRef(0);
  const serverReadyRef = useRef(false);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingPushRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);

  const persistCache = useCallback((next: AppState, revision: number) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.localStorage.setItem(REVISION_KEY, String(revision));
    } catch {
      /* salinan lokal bersifat best-effort; server tetap sumber utama */
    }
  }, []);

  const adoptServerState = useCallback((next: AppState, revision: number) => {
    // Data lama mungkin belum punya daftar libur — materialkan tanpa menandai kotor.
    const withHolidays: AppState = next.holidays?.length ? next : { ...next, holidays: [...DEFAULT_HOLIDAYS] };
    serverRevisionRef.current = revision;
    dirtyRef.current = false;
    stateRef.current = withHolidays;
    setState(withHolidays);
    persistCache(withHolidays, revision);
  }, [persistCache]);

  const doPushRef = useRef<() => void>(() => {});
  const doPush = useCallback(() => {
    // Simpan hanya setelah revisi dasar diketahui; satu permintaan PUT pada satu waktu.
    if (!serverReadyRef.current) {
      pendingPushRef.current = true;
      return;
    }
    if (inFlightRef.current) {
      pendingPushRef.current = true;
      return;
    }
    const current = stateRef.current;
    if (!current) return;
    inFlightRef.current = true;
    fetch("/api/workspace", {
      method: "PUT",
      headers: workspaceHeaders(),
      body: JSON.stringify({ state: current, baseRevision: serverRevisionRef.current }),
    })
      .then(async (response) => {
        inFlightRef.current = false;
        if (response.status === 401) {
          // Sesi login habis — kembali ke halaman masuk (data lokal tetap aman di cache).
          window.location.assign("/login");
          return;
        }
        if (response.status === 409) {
          // Perangkat lain menulis lebih dulu (tulis-terakhir-menang lintas perangkat, terdokumentasi).
          const fresh = await fetch("/api/workspace", { cache: "no-store", headers: workspaceHeaders() });
          if (fresh.status === 401) {
            window.location.assign("/login");
            return;
          }
          if (!fresh.ok) return;
          const body = await fresh.json();
          if (body && typeof body === "object" && isAppState(body.state)) {
            adoptServerState(body.state, body.revision);
            setStorageError("Ada perubahan dari perangkat lain — data dimuat ulang dari server.");
          }
          return;
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? "gagal menyimpan");
        serverRevisionRef.current = body.revision;
        persistCache(current, body.revision);
        if (pendingPushRef.current) {
          pendingPushRef.current = false;
          doPushRef.current();
        }
      })
      .catch(() => {
        inFlightRef.current = false;
        pendingPushRef.current = true;
        setStorageError("Perubahan tersimpan di peramban ini, tetapi gagal sinkron ke server. Akan dicoba lagi otomatis.");
      });
  }, [adoptServerState, persistCache]);
  useEffect(() => { doPushRef.current = doPush; }, [doPush]);

  const pushToServer = useCallback(() => {
    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      doPush();
    }, 900);
  }, [doPush]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const currentToday = todayInJakarta();
    setToday(currentToday);
    // Token akses workspace opsional datang dari fragment URL (#wst=...) sekali saja.
    try {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const token = hash.get("wst");
      if (token) {
        window.localStorage.setItem(WORKSPACE_TOKEN_KEY, token);
        hash.delete("wst");
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash.toString() ? `#${hash}` : ""}`);
      }
    } catch { /* tanpa penyimpanan: token tetap dipakai dari URL selama sesi ini */ }
    const setLocal = (next: AppState) => {
      const withHolidays: AppState = next.holidays?.length ? next : { ...next, holidays: [...DEFAULT_HOLIDAYS] };
      stateRef.current = withHolidays;
      setState(withHolidays);
    };
    let localState: AppState = EMPTY_STATE;
    let localRevision = 0;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isAppState(parsed)) localState = parsed;
      }
      localRevision = Number(window.localStorage.getItem(REVISION_KEY)) || 0;
      serverRevisionRef.current = localRevision;
      setLocal(localState);
    } catch {
      setStorageError("Penyimpanan lokal tidak dapat diakses. Perubahan tetap tersinkron ke server bila terjangkau.");
      setLocal(EMPTY_STATE);
    }
    // Coba ulang sinkronisasi tertunda saat kembali daring.
    const onOnline = () => { if (pendingPushRef.current) doPush(); };
    window.addEventListener("online", onOnline);
    // Workspace server adalah sumber kebenaran lintas perangkat; riwayat dasar hanya ada di server.
    fetch("/api/workspace", { cache: "no-store", headers: workspaceHeaders() })
      .then((response) => {
        if (response.status === 401) {
          window.location.assign("/login");
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((body) => {
        serverReadyRef.current = true;
        if (!body || typeof body !== "object" || !isAppState(body.state)) return;
        const serverState = JSON.stringify(body.state);
        const localDiffers = serverState !== JSON.stringify(stateRef.current);
        const unsyncedLocal = dirtyRef.current || (localDiffers && body.revision === localRevision && localRevision > 0);
        if (unsyncedLocal && localDiffers) {
          // Peramban ini punya edit yang belum tersinkron — baik dibuat sesi ini maupun
          // saat luring (revisi server sama dengan catatan sinkron terakhir). Pertahankan
          // dan dorong dengan revisi server saat ini sebagai dasar.
          serverRevisionRef.current = body.revision;
          dirtyRef.current = true;
          doPush();
          return;
        }
        adoptServerState(body.state, body.revision);
      })
      .catch(() => {
        serverReadyRef.current = true;
        if (!localState.members.length && !localState.entries.length) {
          setStorageError("Server workspace tidak terjangkau dan belum ada data lokal. Periksa koneksi lalu muat ulang.");
        }
      });
    return () => window.removeEventListener("online", onOnline);
  }, [adoptServerState, doPush]);

  const persist = useCallback((next: AppState) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setStorageError("Gagal menyimpan ke penyimpanan lokal (kuota penuh?). Data mungkin hilang setelah muat ulang.");
    }
  }, []);

  const applyState = useCallback(
    (next: AppState) => {
      dirtyRef.current = true;
      stateRef.current = next;
      setState(next);
      persist(next);
      pushToServer();
    },
    [persist, pushToServer],
  );

  const update = useCallback(
    (producer: (current: AppState) => AppState) => {
      const current = stateRef.current;
      if (!current) return;
      applyState(producer(current));
    },
    [applyState],
  );

  const saveEntry = useCallback(
    (draft: EntryDraft) => {
      if (!isValidISODate(draft.date) || !draft.memberId) return;
      update((current) => {
        const existing = current.entries.find((e) => e.date === draft.date && e.memberId === draft.memberId);
        const originalItems = [...(existing?.plans ?? []), ...(existing?.done ?? []), ...(existing?.blockers ?? [])];
        const withSource = (items: DraftItem[]) => cleanItems(items).map(item => {
          const original = originalItems.find(old => old.id === item.id);
          return { ...original, ...item };
        });
        const nextEntry: StandupEntry = {
          id: existing?.id ?? uid("e"),
          date: draft.date,
          memberId: draft.memberId,
          plans: withSource(draft.plans),
          done: withSource(draft.done),
          blockers: withSource(draft.blockers),
          updatedAt: new Date().toISOString(),
          source: existing?.source ?? "manual",
          importId: existing?.importId,
        };
        const others = current.entries.filter((e) => !(e.date === draft.date && e.memberId === draft.memberId));
        return { ...current, entries: [...others, nextEntry] };
      });
    },
    [update],
  );

  const addMember = useCallback(
    (name: string, role: string): Member | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = state?.members.find((m) => normalizeForCompare(m.name) === normalizeForCompare(trimmed));
      if (existing) return existing;
      const member: Member = {
        id: uid("m"),
        name: trimmed,
        role: role.trim() || "Anggota tim",
        accent: ACCENTS[(state?.members.length ?? 0) % ACCENTS.length],
      };
      update((current) => ({ ...current, members: [...current.members, member] }));
      return member;
    },
    [state, update],
  );

  const createTask = useCallback(
    (input: NewTaskInput): Task | null => {
      const title = input.title.trim();
      if (!title || input.assigneeIds.length === 0) return null;
      const now = new Date().toISOString();
      const status = input.status ?? "belum";
      const task: Task = {
        id: uid("t"),
        title,
        assigneeIds: input.assigneeIds,
        project: input.project?.trim() || undefined,
        dueDate: input.dueDate && isValidISODate(input.dueDate) ? input.dueDate : undefined,
        notes: input.notes?.trim() || undefined,
        status,
        createdAt: now,
        statusHistory: [{ id: uid("h"), status, at: now, note: "Tugas dibuat" }],
      };
      update((current) => ({ ...current, tasks: [task, ...current.tasks] }));
      return task;
    },
    [update],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Omit<Task, "id" | "statusHistory">>, note?: string) => {
      update((current) => ({
        ...current,
        tasks: current.tasks.map((task) => {
          if (task.id !== id) return task;
          const nextStatus = patch.status ?? task.status;
          const statusChanged = nextStatus !== task.status;
          return {
            ...task,
            ...patch,
            status: nextStatus,
            dueDate: patch.dueDate && isValidISODate(patch.dueDate) ? patch.dueDate : patch.dueDate === "" ? undefined : task.dueDate,
            statusHistory: statusChanged
              ? [
                  ...task.statusHistory,
                  { id: uid("h"), status: nextStatus, at: new Date().toISOString(), note: note?.trim() || undefined },
                ]
              : task.statusHistory,
          };
        }),
      }));
    },
    [update],
  );

  const changeTaskStatus = useCallback(
    (id: string, status: TaskStatus, note?: string) => {
      updateTask(id, { status }, note);
    },
    [updateTask],
  );

  const carryOver = useCallback(
    (date: string, picks: { memberId: string; taskId: string }[]): number => {
      if (!isValidISODate(date)) return 0;
      let added = 0;
      update((current) => {
        const nextEntries = current.entries.map((entry) => ({
          ...entry,
          plans: [...entry.plans],
          done: [...entry.done],
          blockers: [...entry.blockers],
        }));
        picks.forEach((pick) => {
          const task = current.tasks.find((t) => t.id === pick.taskId);
          if (!task || task.status === "selesai") return;
          let entry = nextEntries.find((e) => e.date === date && e.memberId === pick.memberId);
          if (!entry) {
            entry = {
              id: uid("e"),
              date,
              memberId: pick.memberId,
              plans: [],
              done: [],
              blockers: [],
              updatedAt: new Date().toISOString(),
              source: "manual",
            };
            nextEntries.push(entry);
          }
          const exists = entry.plans.some(
            (item) => item.taskId === task.id || normalizeForCompare(item.text) === normalizeForCompare(task.title),
          );
          if (exists) return;
          entry.plans.push({ id: uid("i"), text: task.title, taskId: task.id });
          entry.updatedAt = new Date().toISOString();
          added += 1;
        });
        return { ...current, entries: nextEntries };
      });
      return added;
    },
    [update],
  );

  const runImport = useCallback(
    (decision: ImportDecision): ImportSummary => {
      let summary: ImportSummary = {
        importId: null,
        entriesTouched: 0,
        itemsAdded: 0,
        itemsSkipped: 0,
        tasksCreated: 0,
        membersCreated: 0,
        duplicateReport: false,
        saved: false,
      };
      update((current) => {
        const result = applyImport(current, decision);
        summary = result.summary;
        return result.state;
      });
      return summary;
    },
    [update],
  );

  const syncLiveReport = useCallback((session: LiveSession) => {
    const current = stateRef.current;
    if (!current || session.phase !== "published") return;
    const next = applyLiveReport(current, session);
    if (JSON.stringify(next) !== JSON.stringify(current)) applyState(next);
  }, [applyState]);

  const resetDemo = useCallback(() => {
    const current = stateRef.current;
    if (current) {
      try { window.localStorage.setItem(BACKUP_KEY, JSON.stringify(current)); } catch { /* abaikan */ }
    }
    setToday(todayInJakarta());
    // Data contoh hanya ada di server — pulihkan lewat endpoint reset agar
    // teks percakapan tim tidak pernah dibundel ke berkas klien yang publik.
    fetch("/api/workspace/reset", { method: "POST", headers: workspaceHeaders() })
      .then((response) => {
        if (response.status === 401) {
          window.location.assign("/login");
          return null;
        }
        if (response.status === 403) {
          setStorageError("Memuat ulang riwayat hanya untuk koordinator.");
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((body) => {
        if (body && typeof body === "object" && isAppState(body.state)) {
          adoptServerState(body.state, body.revision);
        } else {
          setStorageError("Gagal memuat ulang riwayat dari server. Coba lagi.");
        }
      })
      .catch(() => setStorageError("Gagal memuat ulang riwayat dari server. Coba lagi."));
  }, [adoptServerState]);

  const addHoliday = useCallback(
    (date: string, label: string) => {
      if (!isValidISODate(date)) return;
      update((current) => {
        if ((current.holidays ?? []).some((holiday) => holiday.date === date)) return current;
        const holidays = [...(current.holidays ?? []), { date, label: label.trim() || undefined }].sort((a, b) =>
          a.date < b.date ? -1 : 1,
        );
        return { ...current, holidays };
      });
    },
    [update],
  );

  const removeHoliday = useCallback(
    (date: string) => {
      update((current) => ({ ...current, holidays: (current.holidays ?? []).filter((holiday) => holiday.date !== date) }));
    },
    [update],
  );

  const setMemberActive = useCallback(
    (id: string, active: boolean) => {
      update((current) => ({
        ...current,
        members: current.members.map((member) => (member.id === id ? { ...member, active } : member)),
      }));
    },
    [update],
  );

  const value = useMemo<StoreValue>(
    () => ({
      state: state ?? { version: 1, members: [], tasks: [], entries: [], imports: [] },
      hydrated: Boolean(state),
      today,
      storageError,
      saveEntry,
      addMember,
      createTask,
      updateTask,
      changeTaskStatus,
      carryOver,
      runImport,
      syncLiveReport,
      resetDemo,
      addHoliday,
      removeHoliday,
      setMemberActive,
      dismissStorageError: () => setStorageError(null),
    }),
    [state, today, storageError, saveEntry, addMember, createTask, updateTask, changeTaskStatus, carryOver, runImport, syncLiveReport, resetDemo, addHoliday, removeHoliday, setMemberActive],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore harus dipakai di dalam StoreProvider");
  return context;
}
