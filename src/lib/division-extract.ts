import type { DivisionReport } from "@/lib/types";

/**
 * Ekstraksi laporan harian DIVISI LAIN dari arsip chat manajemen yang
 * diekspor per gelembung pesan. Laporan tim sendiri sengaja DIKECUALIKAN —
 * laporan kita sudah ada di workspace standup.
 *
 * Format arsip: pesan dipisah baris "====", nomor [N], baris penulis,
 * isi pesan, dan stempel jam saja ("9:50") tanpa tanggal per gelembung.
 * Tanggal laporan diambil dari judul laporan masing-masing divisi:
 *   RnD 20261001                              → RnD
 *   Daily Standup Team PM Project 14 September2026 → PM Project
 *   Report Daily Stand Up Tanggal 23/10/2026  → Product
 *   REPORT DAILY STANDUP MAINTENANCE DEPT / Tanggal 22 JULI 2026 → Maintenance
 *   📋 Daily Report Stand Up – DD/MM/YYYY     → tim sendiri — DILEWATI
 */

const MONTHS_ID: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

/**
 * Penanda laporan tim sendiri di arsip divisi — pesan yang menyebut penanda
 * ini adalah repost laporan kita dan dilewati. Sesuaikan dengan kebiasaan tim.
 */
const OWN_TEAM_MARKERS = ["👨‍💻", "laporan tim ini"];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isoFromDmy(day: number, month: number, year: number): string | null {
  if (year < 100) year += 2000;
  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && month >= 1 && month <= 12 && day >= 1 && day <= 31 ? iso : null;
}

/** "14 September2026" / "18 Agustus 2026" / "22 JULI 2026" → ISO. */
function parseIndonesianDate(text: string): string | null {
  const match = /(\d{1,2})\s*([A-Za-z]+)\s*(\d{4})/.exec(text);
  if (!match) return null;
  const month = MONTHS_ID[match[2].toLowerCase()];
  if (!month) return null;
  return isoFromDmy(Number(match[1]), month, Number(match[3]));
}

type Classified = { division: string; date: string | null; author: string };

function classify(firstLines: string[]): Classified | null {
  // Gabungkan beberapa baris pertama agar header multi-baris (Maintenance) ikut terbaca.
  const head = firstLines.slice(0, 4).join("\n");
  if (/^\s*📋?\s*Daily Report Stand Up\b/i.test(head)) return { division: "__OWN__", date: null, author: "Tim sendiri" };
  const rnd = /^\s*RnD\s*(\d{8})\b/.exec(head);
  if (rnd) {
    const iso = `${rnd[1].slice(0, 4)}-${rnd[1].slice(4, 6)}-${rnd[1].slice(6, 8)}`;
    return { division: "RnD", date: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null, author: "Tim RnD" };
  }
  if (/^\s*Daily Standup Team PM Project\b/i.test(head)) {
    return { division: "PM Project", date: parseIndonesianDate(head), author: "Tim PM Project" };
  }
  if (/^\s*Report Daily Stand Up Tanggal\b/i.test(head)) {
    const dmy = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(head);
    return { division: "Product", date: dmy ? isoFromDmy(Number(dmy[1]), Number(dmy[2]), Number(dmy[3])) : null, author: "Tim Product" };
  }
  if (/MAINTENANCE DEPT/i.test(head)) {
    return { division: "Maintenance", date: parseIndonesianDate(head), author: "Maintenance Dept" };
  }
  return null;
}

export function splitArchiveMessages(text: string): { index: number; authorLines: string[]; lines: string[] }[] {
  const rawMessages = text.replace(/\r\n?/g, "\n").split(/^={4,}$/m);
  const messages: { index: number; authorLines: string[]; lines: string[] }[] = [];
  rawMessages.forEach((chunk) => {
    const lines = chunk.split("\n").filter((line) => line.trim() !== "");
    if (lines.length === 0) return;
    let cursor = 0;
    // Baris "[123]" nomor pesan.
    if (/^\[\d+\]$/.test(lines[cursor]?.trim() ?? "")) cursor += 1;
    // Penulis: 1-2 baris nama pendek sebelum isi (balasan kutipan pun menyalin penulis).
    const authorLines: string[] = [];
    while (cursor < lines.length) {
      const candidate = lines[cursor].trim();
      // Jangan telan judul laporan sebagai nama penulis — mis. baris
      // "REPORT DAILY STANDUP MAINTENANCE DEPT" juga tampak seperti nama.
      if (classify(lines.slice(cursor, cursor + 4)) !== null) break;
      if (
        authorLines.length < 2 &&
        candidate.length > 0 &&
        candidate.length <= 40 &&
        !/^\d{1,2}:\d{2}$/.test(candidate) &&
        !/^\[/.test(candidate) &&
        /^[\p{L} .@_-]+$/u.test(candidate)
      ) {
        authorLines.push(candidate);
        cursor += 1;
      } else break;
    }
    messages.push({ index: messages.length + 1, authorLines, lines: lines.slice(cursor) });
  });
  return messages;
}

function hashish(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Ekstrak laporan divisi lain dari arsip chat. Duplikat (kutipan/balasan/repos)
 * digabung per (divisi, tanggal): kandidat dengan judul di baris pertama dipilih
 * dulu; sisanya yang terpanjang. Laporan tim sendiri dibuang.
 */
export function extractDivisionReports(archiveText: string): DivisionReport[] {
  const byDay = new Map<string, DivisionReport & { headerFirst: boolean }>();
  for (const message of splitArchiveMessages(archiveText)) {
    // Stempel jam ada di baris terakhir; buang penanda "edited" di atasnya.
    let lines = [...message.lines];
    let time: string | null = null;
    const last = lines[lines.length - 1]?.trim() ?? "";
    if (/^\d{1,2}:\d{2}$/.test(last)) {
      time = `${pad2(Number(last.split(":")[0]))}:${last.split(":")[1]}`;
      lines = lines.slice(0, -1);
    }
    if (lines.length && /^edited$/i.test(lines[lines.length - 1].trim())) lines = lines.slice(0, -1);
    if (lines.length === 0) continue;

    const classified = classify(lines);
    if (!classified || classified.division === "__OWN__") continue;
    // Pengaman tambahan: konten bergaya laporan tim sendiri (penanda khusus) dibuang.
    const bodyLower = lines.join("\n").toLowerCase();
    if (OWN_TEAM_MARKERS.some((marker) => bodyLower.includes(marker))) continue;

    // Buang baris penulis kutipan yang ikut tersalin di awal isi.
    let contentLines = lines;
    while (
      contentLines.length > 1 &&
      message.authorLines.includes(contentLines[0].trim())
    ) {
      contentLines = contentLines.slice(1);
    }
    const text = contentLines.join("\n").trim();
    if (text.length < 20) continue;

    const date = classified.date ?? "";
    const key = `${classified.division}|${date}`;
    const headerFirst = classify(lines.slice(0, 1)) !== null;
    const candidate: DivisionReport & { headerFirst: boolean } = {
      id: `div-${hashish(classified.division + date + text.slice(0, 120))}`,
      division: classified.division,
      date: classified.date ?? "",
      author: message.authorLines[0] ?? classified.author,
      time: time ?? undefined,
      text,
      headerFirst,
    };
    // Prioritas kandidat per (divisi, tanggal): judul di baris pertama (pos asli,
    // bukan kutipan) → jam kirim paling pagi (laporan aslinya) → teks terpanjang.
    const existing = byDay.get(key);
    const better = !existing
      || (candidate.headerFirst && !existing.headerFirst)
      || (candidate.headerFirst === existing.headerFirst && (!existing.time || (candidate.time && candidate.time < existing.time)))
      || (candidate.headerFirst === existing.headerFirst && candidate.time === existing.time && candidate.text.length > existing.text.length);
    if (better) byDay.set(key, candidate);
  }
  return [...byDay.values()]
    .map(({ headerFirst: _headerFirst, ...report }) => report)
    .filter((report) => report.date) // tanpa tanggal tidak bisa dirujuk harian — buang
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : a.division.localeCompare(b.division)));
}
