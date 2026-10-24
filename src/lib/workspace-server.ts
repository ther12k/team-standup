import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { workspace } from "@/db/schema";
import type { AppState, TaskStatus } from "@/lib/types";
import { isValidISODate } from "@/lib/date";
import baseSeedJson from "@/lib/seed-base.json";
import divisionSeedJson from "@/lib/seed-divisions.json";

/**
 * Penyimpanan sisi server untuk satu workspace standup tim (PostgreSQL).
 * Model data tetap AppState utuh — kontrak tipe domain tidak berubah.
 * Revisi naik setiap tulis; klien yang menulis dengan revisi lawas ditolak (409)
 * agar perubahan dua perangkat tidak saling menimpa tanpa sepengetahuan.
 * Akses data kini lewat sesi login (lihat lib/auth); env WORKSPACE_ACCESS_TOKEN
 * masih diterima sebagai Bearer untuk skrip/otomasi bila diatur.
 */

export const WORKSPACE_ID = "default";
export const WORKSPACE_MAX_BYTES = 3_000_000;
const BASE_SEED = baseSeedJson as AppState;
const DIVISION_SEED = divisionSeedJson as AppState["divisionReports"];

const TASK_STATUSES: TaskStatus[] = ["belum", "dikerjakan", "terhambat", "selesai"];

export class WorkspaceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

let coreTablesReady: Promise<void> | null = null;

/** Ciptakan tabel inti saat pertama kali dibutuhkan — deploy baru cukup jalankan. */
export function ensureCoreTables(): Promise<void> {
  coreTablesReady ??= (async () => {
    await pool.query(`
      create table if not exists standup_workspace (
        id text primary key,
        revision integer not null,
        state jsonb not null,
        updated_at timestamptz not null default now()
      )`);
    await pool.query(`
      create table if not exists standup_live_rooms (
        id uuid primary key,
        token_hash text not null,
        view_token text not null,
        session jsonb not null,
        report jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
  })().catch(error => {
    coreTablesReady = null;
    throw error;
  });
  return coreTablesReady;
}

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && value.length <= 40;
}

/**
 * Validasi bentuk penuh (bukan sekadar array ada): setiap anggota/tugas/catatan/impor/libur
 * diperiksa, ID anggota pada catatan harus terdaftar, dan batas jumlah ditegakkan supaya
 * state rusak tidak bisa tersimpan lalu merusak tampilan semua perangkat.
 */
function isWorkspaceState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppState> & Record<string, unknown>;
  if (candidate.version !== 1) return false;
  const array = (input: unknown): unknown[] => (Array.isArray(input) ? input : []);
  const members = array(candidate.members);
  const tasks = array(candidate.tasks);
  const entries = array(candidate.entries);
  const imports = array(candidate.imports);
  if (!Array.isArray(candidate.members) || !Array.isArray(candidate.tasks) ||
      !Array.isArray(candidate.entries) || !Array.isArray(candidate.imports)) return false;
  if (members.length > 100 || tasks.length > 5000 || entries.length > 10000 || imports.length > 5000) return false;

  const memberIds = new Set<string>();
  if (!members.every((member): member is AppState["members"][number] => {
    const m = member as Record<string, unknown>;
    if (!m || !isNonEmptyString(m.id, 100) || !isNonEmptyString(m.name, 100) ||
        typeof m.role !== "string" || m.role.length > 120 || typeof m.accent !== "string") return false;
    if (m.active !== undefined && typeof m.active !== "boolean") return false;
    memberIds.add(m.id);
    return true;
  })) return false;

  if (!tasks.every((task) => {
    const t = task as Record<string, unknown>;
    if (!t || !isNonEmptyString(t.id, 100) || !isNonEmptyString(t.title, 3000)) return false;
    if (!Array.isArray(t.assigneeIds) || t.assigneeIds.length === 0 || t.assigneeIds.length > 40) return false;
    if (!t.assigneeIds.every((id: unknown) => typeof id === "string")) return false;
    if (typeof t.status !== "string" || !TASK_STATUSES.includes(t.status as TaskStatus)) return false;
    if (!isIsoDateTime(t.createdAt)) return false;
    if (t.dueDate !== undefined && !isValidISODate(t.dueDate as string)) return false;
    if (t.notes !== undefined && typeof t.notes !== "string") return false;
    if (t.project !== undefined && typeof t.project !== "string") return false;
    return Array.isArray(t.statusHistory) && t.statusHistory.length <= 200;
  })) return false;

  const itemOk = (item: unknown): boolean => {
    const i = item as Record<string, unknown>;
    if (!i || !isNonEmptyString(i.id, 100) || !isNonEmptyString(i.text, 3000)) return false;
    if (i.taskId !== undefined && typeof i.taskId !== "string") return false;
    if (i.project !== undefined && typeof i.project !== "string") return false;
    return true;
  };
  if (!entries.every((entry) => {
    const e = entry as Record<string, unknown>;
    if (!e || !isNonEmptyString(e.id, 100) || !isValidISODate(e.date as string) ||
        !isNonEmptyString(e.memberId, 100) || !memberIds.has(e.memberId as string)) return false;
    if (!isIsoDateTime(e.updatedAt)) return false;
    if (e.source !== "manual" && e.source !== "import" && e.source !== "live") return false;
    for (const key of ["plans", "done", "blockers"] as const) {
      const list = array(e[key]);
      if (list.length > 500 || !list.every(itemOk)) return false;
    }
    return true;
  })) return false;

  if (!imports.every((record) => {
    const r = record as Record<string, unknown>;
    if (!r || !isNonEmptyString(r.id, 100) || typeof r.originalText !== "string" || r.originalText.length > 300_000) return false;
    if (r.reportDate !== null && r.reportDate !== undefined && !isValidISODate(r.reportDate as string)) return false;
    if (!isIsoDateTime(r.importedAt) || !isNonEmptyString(r.fingerprint, 64)) return false;
    if (!Array.isArray(r.memberNames) || r.memberNames.length > 60) return false;
    return typeof r.activityCount === "number" && Number.isInteger(r.activityCount) && r.activityCount >= 0;
  })) return false;

  if (candidate.holidays !== undefined) {
    if (!Array.isArray(candidate.holidays) || candidate.holidays.length > 400) return false;
    if (!candidate.holidays.every((holiday) => {
      const h = holiday as Record<string, unknown>;
      if (!h || !isValidISODate(h.date as string)) return false;
      return h.label === undefined || (typeof h.label === "string" && h.label.length <= 120);
    })) return false;
  }
  if (candidate.divisionReports !== undefined) {
    if (!Array.isArray(candidate.divisionReports) || candidate.divisionReports.length > 2000) return false;
    if (!candidate.divisionReports.every((report) => {
      const r = report as Record<string, unknown>;
      if (!r || !isNonEmptyString(r.id, 100) || !isNonEmptyString(r.division, 60) || !isValidISODate(r.date as string)) return false;
      if (typeof r.text !== "string" || r.text.length === 0 || r.text.length > 50_000) return false;
      if (r.author !== undefined && typeof r.author !== "string") return false;
      if (r.time !== undefined && !/^\d{2}:\d{2}$/.test(r.time as string)) return false;
      return true;
    })) return false;
  }
  return true;
}

export async function readWorkspaceBody(request: Request): Promise<{ state: unknown; baseRevision: number }> {
  const body = await request.text();
  if (body.length > WORKSPACE_MAX_BYTES) throw new WorkspaceError("Data workspace terlalu besar (maksimal 3 MB).", 413);
  let parsed: { state?: unknown; baseRevision?: unknown };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new WorkspaceError("Format permintaan tidak valid.");
  }
  if (!isWorkspaceState(parsed.state)) throw new WorkspaceError("Struktur data workspace tidak dikenali.");
  if (typeof parsed.baseRevision !== "number" || !Number.isInteger(parsed.baseRevision) || parsed.baseRevision < 0) {
    throw new WorkspaceError("Revisi dasar tidak valid.");
  }
  return { state: parsed.state, baseRevision: parsed.baseRevision };
}

export async function getWorkspace(): Promise<{ state: AppState; revision: number }> {
  await ensureCoreTables();
  const [row] = await db.select().from(workspace).where(eq(workspace.id, WORKSPACE_ID)).limit(1);
  if (row) {
    // Materialisasi satu kali: baris lama belum punya laporan divisi lain —
    // gabungkan seed (referensi) tanpa menaikkan revisi.
    if (!row.state.divisionReports?.length) {
      const merged = { ...row.state, divisionReports: DIVISION_SEED };
      await db.update(workspace).set({ state: merged }).where(eq(workspace.id, WORKSPACE_ID));
      return { state: merged, revision: row.revision };
    }
    return { state: row.state, revision: row.revision };
  }
  // Bootstrap pertama kali: workspace diisi data contoh bawaan + laporan divisi
  // lain agar perangkat baru langsung melihat semuanya — data ini hanya di server.
  const seeded: AppState = { ...BASE_SEED, divisionReports: DIVISION_SEED };
  await db.insert(workspace).values({ id: WORKSPACE_ID, revision: 1, state: seeded }).onConflictDoNothing();
  const [created] = await db.select().from(workspace).where(eq(workspace.id, WORKSPACE_ID)).limit(1);
  return created ? { state: created.state, revision: created.revision } : { state: seeded, revision: 1 };
}

/** Kembalikan workspace ke data contoh (tombol "Muat ulang data contoh"). */
export async function resetWorkspace(): Promise<{ state: AppState; revision: number }> {
  await ensureCoreTables();
  const seeded: AppState = { ...BASE_SEED, divisionReports: DIVISION_SEED };
  return db.transaction(async (tx) => {
    await tx.delete(workspace).where(eq(workspace.id, WORKSPACE_ID));
    await tx.insert(workspace).values({ id: WORKSPACE_ID, revision: 1, state: seeded });
    return { state: seeded, revision: 1 };
  });
}

export async function saveWorkspace(input: { state: unknown; baseRevision: number }): Promise<{ state: AppState; revision: number }> {
  await ensureCoreTables();
  const state = input.state as AppState;
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(workspace).where(eq(workspace.id, WORKSPACE_ID)).limit(1).for("update");
    // Klien luring lama mungkin tidak membawa laporan divisi — jangan biarkan
    // tulisannya menghapus referensi divisi yang sudah ada di server.
    const withDivisions = row && !state.divisionReports?.length && row.state.divisionReports?.length
      ? { ...state, divisionReports: row.state.divisionReports }
      : state;
    if (!row) {
      if (input.baseRevision !== 0) throw new WorkspaceError("Workspace belum ada di server. Muat ulang halaman dulu.", 409);
      const inserted = { id: WORKSPACE_ID, revision: 1, state: withDivisions };
      await tx.insert(workspace).values(inserted).onConflictDoNothing();
      return { state: inserted.state, revision: inserted.revision };
    }
    if (row.revision !== input.baseRevision) {
      throw new WorkspaceError("Ada perubahan dari perangkat lain. Data dimuat ulang dari server.", 409);
    }
    const revision = row.revision + 1;
    await tx.update(workspace).set({ state: withDivisions, revision, updatedAt: new Date() }).where(eq(workspace.id, WORKSPACE_ID));
    return { state: withDivisions, revision };
  });
}

export function workspaceResponse(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function workspaceError(error: unknown) {
  if (error instanceof WorkspaceError) return workspaceResponse({ error: error.message }, error.status);
  console.error("Workspace:", error instanceof Error ? error.message : "Unknown error");
  return workspaceResponse({ error: "Server workspace tidak dapat dihubungi. Coba lagi." }, 503);
}
