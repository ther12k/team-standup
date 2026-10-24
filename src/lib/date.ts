export const JAKARTA_TZ = "Asia/Jakarta";

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayInJakarta(now: Date = new Date()): string {
  // en-CA yields YYYY-MM-DD, so the string is already in the Jakarta calendar.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidISODate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const date = toUtc(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

export function weekdayIndex(dateStr: string): number {
  return toUtc(dateStr).getUTCDay();
}

export function formatLongDate(dateStr: string): string {
  if (!isValidISODate(dateStr)) return dateStr;
  const date = toUtc(dateStr);
  return `${DAY_NAMES[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatMediumDate(dateStr: string | null | undefined): string {
  if (!dateStr || !isValidISODate(dateStr)) return "—";
  const date = toUtc(dateStr);
  return `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr || !isValidISODate(dateStr)) return "—";
  const date = toUtc(dateStr);
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export function formatWeekday(dateStr: string): string {
  if (!isValidISODate(dateStr)) return "";
  return DAY_NAMES[toUtc(dateStr).getUTCDay()];
}

export function formatMonthName(index: number): string {
  return MONTH_NAMES[index] ?? "";
}

/** Waktu input/aktivitas (timestamp) selalu ditampilkan dalam zona Asia/Jakarta. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}.${get("minute")} WIB`;
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function startOfWeek(dateStr: string): string {
  const offset = (weekdayIndex(dateStr) + 6) % 7; // Monday based
  return addDays(dateStr, -offset);
}

export function endOfWeek(dateStr: string): string {
  return addDays(startOfWeek(dateStr), 6);
}

export function eachDate(start: string, end: string): string[] {
  if (!isValidISODate(start) || !isValidISODate(end) || start > end) return [];
  const out: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 400) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

export function isWeekend(dateStr: string): boolean {
  const day = weekdayIndex(dateStr);
  return day === 0 || day === 6;
}

export function relativeDayLabel(dateStr: string, today: string): string {
  if (dateStr === today) return "Hari ini";
  if (dateStr === addDays(today, -1)) return "Kemarin";
  if (dateStr === addDays(today, 1)) return "Besok";
  const diff = Math.round((toUtc(dateStr).getTime() - toUtc(today).getTime()) / 86_400_000);
  if (diff < 0) return `${Math.abs(diff)} hari lalu`;
  return `${diff} hari lagi`;
}

const MONTH_LOOKUP: Record<string, number> = {};
MONTH_NAMES.forEach((name, i) => {
  MONTH_LOOKUP[name.toLowerCase()] = i + 1;
});
MONTH_SHORT.forEach((name, i) => {
  MONTH_LOOKUP[name.toLowerCase()] = i + 1;
});
MONTH_LOOKUP["sept"] = 9;
MONTH_LOOKUP["okt"] = 10;
MONTH_LOOKUP["des"] = 12;

/**
 * Membaca tanggal dari teks bebas (contoh: 13/10/2026, 13-10-2026, 2026-10-13,
 * "13 Oktober 2026", "Selasa, 13 Okt 2026"). Mengembalikan null bila ambigu.
 */
export function parseDateFromText(text: string): string | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const iso = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(cleaned);
  if (iso) {
    return buildIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const numeric = /(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2,4})/.exec(cleaned);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;
    return buildIso(year, month, day);
  }
  const spelled = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(cleaned);
  if (spelled) {
    const month = MONTH_LOOKUP[spelled[2].toLowerCase()];
    if (month) return buildIso(Number(spelled[3]), month, Number(spelled[1]));
  }
  return null;
}

function buildIso(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidISODate(iso) ? iso : null;
}

export function isoRangeLabel(start: string, end: string): string {
  if (start === end) return formatMediumDate(start);
  return `${formatMediumDate(start)} – ${formatMediumDate(end)}`;
}
