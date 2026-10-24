import type { Member } from "@/lib/types";
import { formatMediumDate, isValidISODate, parseDateFromText } from "@/lib/date";
import { parseWhatsAppReports, type ParseResult } from "@/lib/import-parser";

/**
 * Ekstraksi laporan standup langsung dari berkas ekspor chat WhatsApp.
 *
 * Ekspor berisi seluruh percakapan grup — bukan hanya laporan — sehingga teks
 * mentahnya TIDAK boleh diberikan langsung ke pengurai laporan (stempel waktu
 * chat berformat AS seperti "8/28/25, 2:58 PM - " akan tertukar sebagai judul
 * laporan). Modul ini memisahkan pesan, memilih pesan yang benar-benar laporan,
 * menormalkan variasi format tim, lalu memakai pengurai laporan yang sama.
 */

export type ChatMessage = {
  /** Baris pertama pesan apa adanya, termasuk stempel waktu dan pengirim. */
  rawHeader: string;
  /** Isi pesan tanpa stempel waktu; baris pengirim sudah dibuang. */
  text: string;
  sender: string | null;
  system: boolean;
  /** Tanggal pesan dari stempel waktu ekspor (ISO), setelah gaya format berkas dideteksi. */
  dateIso: string | null;
  /** Jam pesan dari stempel waktu ekspor ("HH:MM" 24 jam, waktu lokal pengirim). */
  timeIso: string | null;
};

export type ChatExtractSummary = {
  mode: "chat-export";
  messageCount: number;
  reportCount: number;
  skippedMedia: number;
  /** Judul laporan lawas/nyasar — tanggal dikoreksi ke waktu pesan. */
  dateCorrected: number;
  /** Judul satu hari sebelum waktu kirim (kirim terlambat) — tanggal judul dipertahankan, ditandai. */
  dateLatePost: number;
};

export type StandupParseResult = ParseResult & { chat?: ChatExtractSummary };

/** Stempel waktu ekspor WhatsApp: 12 jam AS ("8/28/25, 2:58 PM") maupun 24 jam ("28/08/2025, 14:58"). */
const TIMESTAMP =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}), (\d{1,2}:\d{2}(?::\d{2})?)(?:\s([AP]M))?\s*-\s?(.*)$/;

const SYSTEM_HINTS =
  /(messages and calls are end-to-end encrypted|created group|added you|joined using this group|left the group|removed |pinned a message|changed the (group|subject|icon|description)|this message was (deleted|edited)|missed (voice|video) call|<media omitted>|security code changed|disappearing messages)/i;

/** Baris judul laporan pada pesan nyata: cukup pendek, menyebut laporan, dan bertanggal. */
const REPORT_TITLE = /(report|laporan)[^\n]{0,40}(stand\s*up|daily|harian|scrum)/i;

export function splitChatMessages(text: string): ChatMessage[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const messages: ChatMessage[] = [];
  let current: { rawHeader: string; bodyLines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const headerMatch = TIMESTAMP.exec(current.rawHeader);
    const rest = headerMatch ? headerMatch[4] : current.rawHeader;
    const separator = rest.indexOf(": ");
    const systemGuess = separator === -1 || SYSTEM_HINTS.test(rest);
    // Pesan sistem ( "... created group", "This message was deleted" ) bukan laporan;
    // jangan salah baca "Pengirim: teks" pada pesan biasa. Baris lanjutan tanpa
    // stempel waktu tetap bagian pesan ini.
    const sender = systemGuess ? null : rest.slice(0, separator).trim() || null;
    const firstBodyLine = systemGuess ? rest : rest.slice(separator + 2);
    const text = [firstBodyLine, ...current.bodyLines].join("\n");
    messages.push({ rawHeader: current.rawHeader, text, sender, system: systemGuess, dateIso: null, timeIso: null });
    current = null;
  };

  lines.forEach((line) => {
    if (TIMESTAMP.test(line)) {
      flush();
      current = { rawHeader: line, bodyLines: [] };
      return;
    }
    if (current) current.bodyLines.push(line);
  });
  flush();

  // Gaya tanggal ekspor konsisten dalam satu berkas: "10/22/26" (AS, bulan dulu)
  // atau "22/10/26" (internasional, hari dulu). Tentukan lewat sampel tak ambigu
  // (komponen > 12 pasti hari). Bila semua sampel ambigu (kedua komponen ≤ 12),
  // gaya tidak dapat dipastikan — tanggal pesan dibiarkan null dan koreksi
  // judul-vs-waktu-kirim dilewati agar laporan tidak dipindah ke bulan yang salah.
  const samples: { a: number; b: number }[] = [];
  messages.forEach((message) => {
    const match = TIMESTAMP.exec(message.rawHeader);
    if (!match) return;
    const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(match[1]);
    if (parts) samples.push({ a: Number(parts[1]), b: Number(parts[2]) });
  });
  const dayFirst = samples.some((sample) => sample.a > 12);
  const monthFirst = samples.some((sample) => sample.b > 12);
  const localeKnown = dayFirst || monthFirst;
  messages.forEach((message) => {
    const match = TIMESTAMP.exec(message.rawHeader);
    if (!match) return;
    // Jam pesan selalu terbaca (lokal pengirim, tanpa zona) — dipakai sebagai
    // waktu catatan standup hasil impor, jauh lebih jujur daripada waktu impor.
    const time = /^(\d{1,2}):(\d{2})/.exec(match[2]);
    if (time) {
      let hour = Number(time[1]);
      const meridiem = match[3]?.toUpperCase();
      if (meridiem === "PM" && hour < 12) hour += 12;
      if (meridiem === "AM" && hour === 12) hour = 0;
      if (hour >= 0 && hour <= 23) message.timeIso = `${String(hour).padStart(2, "0")}:${time[2]}`;
    }
    if (!localeKnown) return;
    const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(match[1]);
    if (!parts) return;
    const a = Number(parts[1]);
    const b = Number(parts[2]);
    const year = Number(parts[3]) < 100 ? 2000 + Number(parts[3]) : Number(parts[3]);
    const day = dayFirst ? a : b;
    const month = dayFirst ? b : a;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isValidISODate(iso)) message.dateIso = iso;
  });
  return messages;
}

const FORMAT_CHARS = /[\u200b-\u200f\u2060\u202a-\u202e\ufeff]/g;
const SECTION_WORDS =
  /^(kendala|rencana|selesai|pekerjaan|solusi|tindak( lanjut)?|tanggal|catatan|note|link|progress|progres|status)\b/i;

function cleanFormatting(text: string): string {
  return text
    .replace(/\[\/?(b|i|u|s)\]/gi, "")
    .replace(FORMAT_CHARS, "")
    .replace(/\u202f/g, " ")
    .replace(/<this message was edited>/gi, "")
    .replace(/<media omitted>/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+$/g, "");
}

/** Variasi penanda anggota pada laporan nyata → bentuk kanonik "👷 Nama". */
function normalizeReportBody(lines: string[]): string[] {
  const result: string[] = [];
  lines.forEach((originalLine) => {
    const line = cleanFormatting(originalLine);
    const trimmed = line.trim();
    if (!trimmed) {
      result.push("");
      return;
    }
    // Baris meta ("*Tanggal:* 30/09/2025", "Nama: X") bukan aktivitas:
    // tanggal sudah dipindahkan ke judul; nama menjadi penanda anggota.
    const meta = /^\*?\s*(tanggal|date|nama|anggota)\s*\*?\s*:\s*(.*)$/i.exec(trimmed);
    if (meta) {
      const [, label, value] = meta;
      if (/^(tanggal|date)$/i.test(label) || !value.trim()) {
        result.push("");
      } else {
        result.push(`👷 ${value.trim()}`);
      }
      return;
    }
    // "* *Bang Bima*" / "- *Mas Jodi*" — nama tebal sebagai butir daftar.
    const markdownMember = /^[•*\-]\s*\*(.+?)\*\s*:?\s*$/.exec(trimmed);
    if (markdownMember && !SECTION_WORDS.test(markdownMember[1])) {
      result.push(`👷 ${markdownMember[1]}`);
      return;
    }
    // "*Kendala, Solusi, dan Tindak Lanjut:*" — label tebal menjadi label biasa.
    const boldLabel = /^\*(.+?)\*\s*:?\s*$/.exec(trimmed);
    if (boldLabel) {
      result.push(boldLabel[1].trim());
      return;
    }
    // "Bima:" / "Mas Jodi:" / "Bang Galang:" — nama di baris sendiri diakhiri titik dua.
    if (/^[A-Z][\w.' -]{1,32}:$/.test(trimmed) && !SECTION_WORDS.test(trimmed)) {
      result.push(`👷 ${trimmed.replace(/:$/, "")}`);
      return;
    }
    result.push(trimmed);
  });
  return result;
}

function looksLikeReport(message: ChatMessage): boolean {
  if (message.system || !message.sender) return false;
  const firstLine = cleanFormatting(message.text.split("\n")[0] ?? "").trim();
  if (!firstLine || firstLine.length > 90) return false;
  if (/^<media omitted>$/i.test(firstLine)) return false;
  const hasDate = Boolean(parseDateFromText(firstLine));
  const hasBodyDate = /\btanggal\b[^0-9]{0,12}\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(message.text);
  return REPORT_TITLE.test(firstLine) && (hasDate || hasBodyDate);
}

/** Tanggal pada isi laporan ("*Tanggal:* 30/09/2025") bila judul tidak bertanggal. */
function dateFromBody(text: string): string | null {
  const match = /\btanggal\b[^0-9]{0,12}(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(text);
  return match ? parseDateFromText(match[1]) : null;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/** Ganti tanggal pada judul dengan tanggal koreksi (token d/m/y atau ISO). */
function withReplacedDate(line: string, iso: string): string {
  const dmy = `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  return /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(line)
    ? line.replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, dmy)
    : `${line.replace(/\s*$/, "")} – ${dmy}`;
}

/** true bila teks didominasi baris berstempel waktu ekspor WhatsApp. */
export function looksLikeChatExport(text: string): boolean {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const stamped = lines.filter((line) => TIMESTAMP.test(line)).length;
  return lines.length >= 8 && stamped >= 5;
}

/**
 * Ekstrak laporan dari ekspor chat. Setiap pesan laporan diperbaiki formatnya
 * (tag [b], teks tebal, "•⁠ ⁠", nama dengan titik dua) sebelum masuk ke
 * pengurai yang sama dengan tempelan manual, lalu teks asli pesan dipulihkan
 * agar riwayat impor tetap memuat sumber sebenarnya.
 */
export function extractFromChatExport(text: string, members: Member[] = []): StandupParseResult {
  const messages = splitChatMessages(text);
  const reportParts: string[] = [];
  const sourceMessages: ChatMessage[] = [];
  const dateNotes: { corrected: boolean; message: string }[] = [];
  let skippedMedia = 0;
  let dateCorrected = 0;
  let dateLatePost = 0;

  messages.forEach((message) => {
    if (!looksLikeReport(message)) {
      if (/<media omitted>/i.test(message.rawHeader)) skippedMedia += 1;
      return;
    }
    const normalized = normalizeReportBody(message.text.split("\n"));
    const firstLine = normalized[0] ?? "";
    const titleDate = parseDateFromText(firstLine) ?? dateFromBody(message.text);
    if (!titleDate) return;

    // Bandingkan tanggal judul dengan waktu pesan. Judul bisa jadi templat lawas
    // yang lalai diganti; waktu kirim mesin selalu benar. Kirim terlambat satu
    // hari masih wajar (laporan kemarin) — dipertahankan tapi ditandai.
    let header = firstLine;
    let note: { corrected: boolean; message: string } | null = null;
    const hasTitleDate = Boolean(parseDateFromText(firstLine));
    if (!hasTitleDate) {
      header = `${firstLine.replace(/\s*$/, "")} – ${titleDate}`;
    }
    if (message.dateIso && message.dateIso !== titleDate) {
      const diff = daysBetween(titleDate, message.dateIso); // negatif = judul lebih lawas
      if (diff === -1) {
        dateLatePost += 1;
        note = {
          corrected: false,
          message: `Judul ${formatMediumDate(titleDate)} tetapi pesan dikirim ${formatMediumDate(message.dateIso)} — dianggap laporan ${formatMediumDate(titleDate)} yang dikirim terlambat. Ubah tanggal bila keliru.`,
        };
      } else {
        dateCorrected += 1;
        header = withReplacedDate(header, message.dateIso);
        note = {
          corrected: true,
          message: `Judul laporan menulis ${formatMediumDate(titleDate)} tetapi pesan dikirim ${formatMediumDate(message.dateIso)} — tanggal diatur ke ${formatMediumDate(message.dateIso)}. Ubah bila memang untuk ${formatMediumDate(titleDate)}.`,
        };
      }
    }

    reportParts.push([header, ...normalized.slice(1)].join("\n"));
    sourceMessages.push(message);
    dateNotes.push(note ?? { corrected: false, message: "" });
  });

  const result = parseWhatsAppReports(reportParts.join("\n\n"), members);
  // Simpan teks asli pesan apa adanya (stempel waktu + isi mentah, termasuk tag [b]
  // dan tebal) sebagai sumber audit; koreksi tanggal dicatat sebagai bendera pratinjau.
  // Waktu kirim pesan menjadi "sourceAt" agar waktu catatan hasil impor realistis.
  result.reports.forEach((report, index) => {
    const source = sourceMessages[index];
    if (source) {
      report.originalText = `${source.rawHeader}\n${source.text}`;
      // Waktu dinding pengirim diperlakukan sebagai WIB untuk tampilan yang konsisten.
      if (source.dateIso && source.timeIso) report.sourceAt = `${source.dateIso}T${source.timeIso}:00+07:00`;
    }
    const note = dateNotes[index];
    if (note?.message) {
      report.flags.push({ level: "warning", message: note.message });
    }
  });
  return {
    ...result,
    chat: {
      mode: "chat-export",
      messageCount: messages.length,
      reportCount: result.reports.length,
      skippedMedia,
      dateCorrected,
      dateLatePost,
    },
  };
}

/** Titik masuk tunggal untuk layar impor: otomatis membedakan ekspor chat dari laporan tempelan. */
export function parseStandupText(text: string, members: Member[] = []): StandupParseResult {
  return looksLikeChatExport(text) ? extractFromChatExport(text, members) : parseWhatsAppReports(text, members);
}
