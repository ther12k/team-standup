import { z } from "zod";
import { addDays, endOfWeek, isValidISODate, startOfWeek } from "@/lib/date";
import type { AppState } from "@/lib/types";

/** Berbagi laporan: maksimal 62 hari per tautan agar payload tetap terkendali. */
export const SHARE_MAX_DAYS = 62;

export type ShareMode = "day" | "week";

/** Tautan satu hari = harian; rentang (minggu Sen–Min) = mingguan. */
export function shareModeFor(start: string, end: string): ShareMode {
  return start === end ? "day" : "week";
}

/**
 * Jendela navigasi pembaca tautan: minggu yang dibagikan + satu minggu
 * sebelumnya. Data yang dikirim server dibatasi ke jendela ini — tanggal
 * yang lebih tua tetap privat.
 */
export function shareWindowStart(start: string): string {
  return addDays(startOfWeek(start), -7);
}

export function shareWindowEnd(start: string, end: string): string {
  const weekEnd = endOfWeek(start);
  return end > weekEnd ? end : weekEnd;
}

/**
 * Jendela pratinjau: tanggal di luar jendela berbagi tetap dikirim (±35 hari)
 * agar kartu tanggal menunjukkan ada isinya dan isinya bisa dikaburkan —
 * pengunjung diminta minta tautan baru untuk membukanya.
 */
export const SHARE_PREVIEW_DAYS = 35;

export function sharePreviewStart(start: string): string {
  return addDays(shareWindowStart(start), -SHARE_PREVIEW_DAYS);
}

export function sharePreviewEnd(start: string, end: string): string {
  return addDays(shareWindowEnd(start, end), SHARE_PREVIEW_DAYS);
}

/** Panjang ID tautan berbagi: 8 karakter alfanumerik (62^8 ≈ 218 triliun kombinasi). */
export const SHARE_ID_LENGTH = 8;
const SHARE_ID_PATTERN = new RegExp(`^[A-Za-z0-9]{${SHARE_ID_LENGTH}}$`);
/** Tautan lama memakai UUID 36 karakter — tetap sah agar tautan yang sudah tersebar tidak mati. */
const LEGACY_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidShareId(id: string): boolean {
  return SHARE_ID_PATTERN.test(id) || LEGACY_UUID_PATTERN.test(id);
}

export const shareCreateSchema = z
  .object({
    start: z.string().refine(isValidISODate, "Tanggal awal tidak valid."),
    end: z.string().refine(isValidISODate, "Tanggal akhir tidak valid."),
    groupBy: z.enum(["member", "project"]).default("member"),
  })
  .refine(value => value.start <= value.end, "Tanggal awal harus sebelum atau sama dengan tanggal akhir.")
  .refine(
    value => Math.round((Date.parse(value.end) - Date.parse(value.start)) / 86_400_000) < SHARE_MAX_DAYS,
    `Rentang berbagi maksimal ${SHARE_MAX_DAYS} hari.`,
  );

/**
 * Saring state workspace agar tautan berbagi hanya memuat entri pada rentang
 * yang dibagikan — anggota & tugas lain tidak ikut bocor. Laporan divisi
 * referensi ikut untuk rentang jendela (chip "Divisi lain" tetap tampil),
 * riwayat impor tidak. Laporan mengikuti data terkini setiap kali tautan
 * dibuka (bukan snapshot beku).
 */
export function filterStateForRange(state: AppState, start: string, end: string): AppState {
  const entries = state.entries.filter(entry => entry.date >= start && entry.date <= end);
  const taskIds = new Set<string>();
  for (const entry of entries) {
    for (const item of [...entry.plans, ...entry.done, ...entry.blockers]) {
      if (item.taskId) taskIds.add(item.taskId);
    }
  }
  const tasks = state.tasks.filter(task => taskIds.has(task.id));
  return {
    version: 1,
    members: state.members,
    tasks,
    entries,
    imports: [],
    holidays: state.holidays,
    divisionReports: (state.divisionReports ?? []).filter(report => report.date >= start && report.date <= end),
  };
}
