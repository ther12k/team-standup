import type { Holiday } from "@/lib/types";
import { addDays, isValidISODate, weekdayIndex } from "@/lib/date";

/**
 * Hari kerja tim: Senin–Jumat dikurangi daftar hari libur.
 * Sabtu/Minggu serta tanggal libur tidak bisa dipilih untuk standup baru —
 * KECUALI sudah ada catatan pada tanggal itu (riwayat tetap terbuka).
 */

export const DEFAULT_HOLIDAYS: Holiday[] = [
  // 2025 — libur nasional & cuti bersama sesuai SKB 3 Menteri (label cuti bersama diberi awalan "Cuti bersama").
  { date: "2025-01-01", label: "Tahun Baru" },
  { date: "2025-01-27", label: "Isra Mikraj Nabi" },
  { date: "2025-01-29", label: "Tahun Baru Imlek" },
  { date: "2025-03-28", label: "Hari Suci Nyepi" },
  { date: "2025-03-31", label: "Cuti bersama Idul Fitri 1446 H" },
  { date: "2025-04-01", label: "Idul Fitri 1446 H" },
  { date: "2025-04-18", label: "Wafat Isa Almasih" },
  { date: "2025-05-01", label: "Hari Buruh" },
  { date: "2025-05-12", label: "Hari Raya Waisak" },
  { date: "2025-05-29", label: "Kenaikan Isa Almasih" },
  { date: "2025-06-01", label: "Hari Lahir Pancasila" },
  { date: "2025-06-06", label: "Idul Adha 1446 H" },
  { date: "2025-06-27", label: "Tahun Baru Islam 1447 H" },
  { date: "2025-08-17", label: "Hari Kemerdekaan RI" },
  { date: "2025-09-05", label: "Maulid Nabi Muhammad" },
  { date: "2025-12-25", label: "Hari Raya Natal" },
  // 2026 — sesuai SKB resmi: Idul Fitri 21–22 Maret (21 Sabtu, 22 Minggu), cuti bersama 18, 20, 23, 24 Maret.
  { date: "2026-01-01", label: "Tahun Baru" },
  { date: "2026-01-16", label: "Isra Mikraj Nabi" },
  { date: "2026-02-16", label: "Cuti bersama Tahun Baru Imlek" },
  { date: "2026-02-17", label: "Tahun Baru Imlek" },
  { date: "2026-03-18", label: "Cuti bersama Hari Suci Nyepi" },
  { date: "2026-03-19", label: "Hari Suci Nyepi" },
  { date: "2026-03-20", label: "Cuti bersama Idul Fitri 1447 H" },
  { date: "2026-03-21", label: "Idul Fitri 1447 H" },
  { date: "2026-03-22", label: "Idul Fitri 1447 H" },
  { date: "2026-03-23", label: "Cuti bersama Idul Fitri 1447 H" },
  { date: "2026-03-24", label: "Cuti bersama Idul Fitri 1447 H" },
  { date: "2026-04-03", label: "Wafat Isa Almasih" },
  { date: "2026-04-05", label: "Hari Raya Paskah" },
  { date: "2026-05-01", label: "Hari Buruh" },
  { date: "2026-05-14", label: "Kenaikan Isa Almasih" },
  { date: "2026-05-15", label: "Cuti bersama Kenaikan Isa Almasih" },
  { date: "2026-05-27", label: "Idul Adha 1447 H" },
  { date: "2026-05-28", label: "Cuti bersama Idul Adha 1447 H" },
  { date: "2026-05-31", label: "Hari Raya Waisak" },
  { date: "2026-06-01", label: "Hari Lahir Pancasila" },
  { date: "2026-06-16", label: "Tahun Baru Islam 1448 H" },
  { date: "2026-08-17", label: "Hari Kemerdekaan RI" },
  { date: "2026-08-25", label: "Maulid Nabi Muhammad" },
  { date: "2026-12-24", label: "Cuti bersama Hari Raya Natal" },
  { date: "2026-12-25", label: "Hari Raya Natal" },
];

export function holidayLabel(holidays: Holiday[], iso: string): string | null {
  return holidays.find((holiday) => holiday.date === iso)?.label ?? null;
}

/** Alasan hari ini bukan hari kerja: tanggal terdaftar sebagai libur (label opsional), atau "akhir pekan". */
export function nonWorkingReason(holidays: Holiday[], iso: string): string | null {
  if (!isValidISODate(iso)) return null;
  const weekday = weekdayIndex(iso); // 0 = Minggu, 6 = Sabtu
  if (weekday === 0 || weekday === 6) return "akhir pekan";
  const entry = holidays.find((holiday) => holiday.date === iso);
  if (!entry) return null;
  return entry.label ? `libur (${entry.label})` : "libur";
}

export function isNonWorkingDay(iso: string, holidays: Holiday[]): boolean {
  return nonWorkingReason(holidays, iso) !== null;
}

/** Bisa dipilih bila hari kerja, ATAU sudah ada catatan pada tanggal itu (riwayat tetap terbuka). */
export function isDateSelectable(iso: string, holidays: Holiday[], hasData: boolean): boolean {
  if (!isValidISODate(iso)) return false;
  return !isNonWorkingDay(iso, holidays) || hasData;
}

export function prevWorkingDay(iso: string, holidays: Holiday[]): string {
  let current = addDays(iso, -1);
  while (isNonWorkingDay(current, holidays)) current = addDays(current, -1);
  return current;
}

export function nextWorkingDay(iso: string, holidays: Holiday[]): string {
  let current = addDays(iso, 1);
  while (isNonWorkingDay(current, holidays)) current = addDays(current, 1);
  return current;
}

/** Tanggal standup yang wajar dilihat dari `iso`: harinya sendiri bila hari kerja, jika tidak hari kerja terakhir sebelumnya. */
export function latestWorkingDayOnOrBefore(iso: string, holidays: Holiday[]): string {
  return isNonWorkingDay(iso, holidays) ? prevWorkingDay(iso, holidays) : iso;
}
