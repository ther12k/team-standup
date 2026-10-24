import type { ItemKind, Member } from "@/lib/types";
import { normalizeForCompare } from "@/lib/tasks";
import { parseDateFromText } from "@/lib/date";

export type ParseFlag = { level: "error" | "warning" | "info"; message: string };

export type ParsedActivity = {
  id: string;
  kind: ItemKind;
  text: string;
  review?: string;
};

export type ParsedMember = {
  id: string;
  sourceName: string;
  matchedMemberId: string | null;
  activities: ParsedActivity[];
  review?: string;
};

export type ParsedReport = {
  id: string;
  reportDate: string | null;
  dateText: string | null;
  originalText: string;
  /** Waktu pesan sumber (ISO) bila berasal dari ekspor chat — dipakai sebagai waktu catatan. */
  sourceAt?: string;
  members: ParsedMember[];
  flags: ParseFlag[];
  fingerprint: string;
};

export type ParseResult = {
  reports: ParsedReport[];
  ignoredLines: string[];
};

const HEADER_KEYWORD = /(stand\s*up|standup|laporan\s*(harian|daily|kerja)|daily\s*report|report\s*daily)/i;
const BULLET = /^(?:[•·▪◦‣●○*–—-]|\d{1,2}[.)])\s*/u;
const SECTION_PLAN = /(rencana|planning|to\s*do|todo|akan\s+dikerjakan|pekerjaan\s+hari\s+ini)/i;
const SECTION_DONE = /(selesai|completed?|done|sudah\s+dikerjakan|realisasi)/i;
const SECTION_BLOCKER = /(kendala|hambatan|blocker|issue|bantuan|pending|kebutuhan)/i;
const HONORIFICS = /^(bang|mas|mbak|mba|pak|bapak|bu|ibu|kak|saudara|sdr|teh|kang|aa|om|tante|bg|big)\.?\s+/i;
const SECTION_LABEL = /^(rencana(\s+kerja)?(\s+hari\s+ini)?|pekerjaan\s+hari\s+ini|selesai(\s+hari\s+ini)?|pekerjaan\s+selesai|kendala|hambatan)\s*:?\s*/i;
/** Frasa yang mirip nama orang tetapi bukan anggota — jangan dijadikan nama. */
const NAME_STOP_WORDS = /^(tindak|lanjut|solusi|kendala|rencana|selesai|pekerjaan|tanggal|catatan|dokumentasi|monitoring|noted|note|link|progres|progress|status|update)\b/i;

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function stripEmoji(value: string): string {
  return value
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu, "")
    .replace(/[\u200b-\u200f\u2060\u202a-\u202e\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSection(line: string): ItemKind | null {
  const text = line.toLowerCase();
  if (SECTION_PLAN.test(text)) return "plan";
  if (SECTION_BLOCKER.test(text)) return "blocker";
  if (SECTION_DONE.test(text)) return "done";
  return null;
}

function cleanMemberName(line: string): string {
  return stripEmoji(line)
    .replace(/^(nama|anggota)\s*[:\-]\s*/i, "")
    .replace(/[:\-–—]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMemberName(name: string): string {
  return normalizeForCompare(name.replace(HONORIFICS, ""));
}

/** Saran nama anggota baru: buang sapaan (Bang/Mas/Mbak/Pak/Bu) di depan. */
export function suggestMemberName(name: string): string {
  const cleaned = cleanMemberName(name);
  const withoutHonorific = cleaned.replace(HONORIFICS, "").trim();
  return withoutHonorific || cleaned;
}

/** Pencocokan nama eksplisit: sama persis, atau nama depan unik dari anggota terdaftar. */
export function matchMemberByName(members: Member[], sourceName: string): string | null {
  const needle = normalizeMemberName(sourceName);
  if (!needle) return null;
  const exact = members.find((member) => normalizeMemberName(member.name) === needle);
  if (exact) return exact.id;
  const candidates = members.filter((member) => {
    const normalized = normalizeMemberName(member.name);
    return normalized.startsWith(`${needle} `) || needle.startsWith(`${normalized} `);
  });
  return candidates.length === 1 ? candidates[0].id : null;
}

export function hashString(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`;
}

export function contentFingerprint(
  reportDate: string | null,
  groups: { key: string; activities: { kind: ItemKind; text: string }[] }[],
): string {
  const payload = [
    reportDate ?? "tanpa-tanggal",
    ...groups
      .map((group) => {
        const items = group.activities
          .map((activity) => `${activity.kind}:${normalizeForCompare(activity.text)}`)
          .sort()
          .join("|");
        return `${normalizeForCompare(group.key)}=>${items}`;
      })
      .sort(),
  ].join("::");
  return hashString(payload);
}

type Block = { lines: string[]; headerDate: string | null; dateText: string | null; hasHeader: boolean };

function splitBlocks(text: string): Block[] {
  const rawLines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let current: Block | null = null;
  let preamble: string[] = [];

  rawLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const date = parseDateFromText(trimmed);
    const isHeader = Boolean(date && HEADER_KEYWORD.test(trimmed)) && trimmed.length <= 140;
    if (isHeader) {
      if (current) blocks.push(current);
      current = { lines: [trimmed], headerDate: date, dateText: trimmed, hasHeader: true };
      return;
    }
    if (!current) {
      preamble.push(trimmed);
      return;
    }
    current.lines.push(trimmed);
  });

  if (current) blocks.push(current);
  if (preamble.length > 0 && blocks.length === 0) {
    const date = parseDateFromText(preamble.join(" "));
    blocks.push({ lines: preamble, headerDate: date, dateText: preamble[0] ?? null, hasHeader: false });
  } else if (preamble.length > 0 && blocks.length > 0) {
    // Baris sebelum header pertama tetap dipertahankan sebagai bagian laporan pertama.
    blocks[0] = { ...blocks[0], lines: [...preamble, ...blocks[0].lines] };
  }
  return blocks;
}

function looksLikeName(line: string, nextLine: string | undefined): boolean {
  const stripped = cleanMemberName(line);
  if (!stripped || stripped.length > 48) return false;
  if (/\d/.test(stripped)) return false;
  if (/[:•·]/.test(stripped)) return false;
  if (NAME_STOP_WORDS.test(stripped)) return false;
  if (!/^\p{Lu}/u.test(stripped)) return false;
  const words = stripped.split(/\s+/);
  if (words.length > 4) return false;
  if (!nextLine) return false;
  return BULLET.test(stripEmoji(nextLine)) || /^(?:[•·▪◦‣●○*–—-]|\d{1,2}[.)])\s*/.test(nextLine.trim());
}

export function parseWhatsAppReports(text: string, members: Member[] = []): ParseResult {
  const blocks = splitBlocks(text);
  const ignoredLines: string[] = [];
  const reports: ParsedReport[] = [];

  blocks.forEach((block, blockIndex) => {
    const flags: ParseFlag[] = [];
    const parsedMembers: ParsedMember[] = [];
    let currentMember: ParsedMember | null = null;
    let currentActivity: ParsedActivity | null = null;
    let currentSection: ItemKind | null = null;
    let unknownSectionFlagged = false;

    const pushFlag = (level: ParseFlag["level"], message: string) => {
      if (!flags.some((flag) => flag.message === message)) flags.push({ level, message });
    };

    // Nama yang muncul di beberapa bagian (Rencana/Selesai/Kendala) digabung
    // menjadi satu blok anggota agar tidak dobel di pratinjau.
    const resolveMember = (name: string): ParsedMember => {
      const matchedMemberId = matchMemberByName(members, name);
      const normalized = normalizeMemberName(name);
      const existing = parsedMembers.find(
        (member) =>
          (matchedMemberId && member.matchedMemberId === matchedMemberId) ||
          normalizeMemberName(member.sourceName) === normalized,
      );
      if (existing) return existing;
      const created: ParsedMember = {
        id: uid("pm"),
        sourceName: name,
        matchedMemberId,
        activities: [],
      };
      if (!matchedMemberId) {
        created.review = `Nama "${name}" belum cocok dengan anggota terdaftar. Petakan manual.`;
        pushFlag("warning", `Anggota "${name}" belum terdaftar — perlu dipetakan.`);
      }
      parsedMembers.push(created);
      return created;
    };

    if (!block.headerDate) {
      pushFlag("error", "Tanggal laporan tidak ditemukan. Isi tanggal laporan sebelum menyimpan.");
    }

    block.lines.forEach((line, lineIndex) => {
      const isHeaderLine = lineIndex === 0 && block.hasHeader;
      if (isHeaderLine) return;
      const raw = line.trim();
      if (!raw) return;
      const withoutEmoji = stripEmoji(raw);
      const isBullet = BULLET.test(withoutEmoji) || BULLET.test(raw);

      // 1. Penanda anggota eksplisit (👷 / 👨‍💻 / Nama:)
      const explicitMember = /👷|👨‍💻/u.test(raw) || /^(nama|anggota)\s*[:\-]/i.test(withoutEmoji);
      if (explicitMember && !isBullet) {
        const name = cleanMemberName(withoutEmoji);
        if (name) {
          currentMember = resolveMember(name);
          currentActivity = null;
          return;
        }
      }

      // 2. Header bagian (Rencana / Selesai / Kendala)
      const sectionGuess = detectSection(withoutEmoji);
      const hasColonContent = /:\s*\S/.test(withoutEmoji);
      if (!isBullet && sectionGuess && !hasColonContent && withoutEmoji.length <= 70) {
        currentSection = sectionGuess;
        currentActivity = null;
        return;
      }

      // 3. Aktivitas dengan penanda bullet / "Kendala: ..."
      const bulletText = withoutEmoji.replace(BULLET, "").trim();
      const inlineSectionText = SECTION_LABEL.test(withoutEmoji) && hasColonContent
        ? withoutEmoji.replace(SECTION_LABEL, "").trim()
        : null;

      if (isBullet || inlineSectionText) {
        // Judul bagian yang eksplisit menang atas kata kunci di teks aktivitas:
        // butir di bawah "Rencana" tetap rencana walau menyebut "selesai"/"bantuan".
        // Tanpa judul bagian, kata kunci berlaku tetapi negasi di depan ("belum selesai…")
        // tidak boleh dianggap selesai/kendala.
        let kind: ItemKind;
        if (inlineSectionText) {
          kind = detectSection(withoutEmoji) ?? currentSection ?? "plan";
        } else if (currentSection) {
          kind = currentSection;
        } else {
          kind = sectionGuess ?? "plan";
          if (kind !== "plan" && /^(?:belum|tidak|nggak|gak|jangan|bukan)\b/i.test(bulletText)) kind = "plan";
        }
        const activityText = (inlineSectionText ?? bulletText).trim();
        if (!activityText) return;

        if (!currentMember) {
          if (parsedMembers.length === 0) {
            const unknown: ParsedMember = {
              id: uid("pm"),
              sourceName: "Tanpa nama",
              matchedMemberId: null,
              activities: [],
              review: "Aktivitas ditemukan sebelum nama anggota. Lengkapi nama pada pratinjau.",
            };
            parsedMembers.push(unknown);
            pushFlag("error", "Ada aktivitas tanpa nama anggota — periksa pratinjau.");
          }
          currentMember = parsedMembers[parsedMembers.length - 1];
        }

        const kindIsGuessed = !sectionGuess && !currentSection;
        if (kindIsGuessed && !unknownSectionFlagged) {
          unknownSectionFlagged = true;
          pushFlag("warning", "Sebagian aktivitas tidak berada di bawah judul bagian. Diperiksa sebagai rencana.");
        }

        const activity: ParsedActivity = {
          id: uid("pa"),
          kind,
          text: activityText,
          review: kindIsGuessed ? "Bagian tidak dikenali — diperiksa sebagai rencana." : undefined,
        };
        currentMember.activities.push(activity);
        currentActivity = activity;
        return;
      }

      // 4. Nama anggota tanpa penanda 👷 (hanya bila baris berikutnya berupa bullet)
      if (!isBullet && looksLikeName(raw, block.lines[lineIndex + 1])) {
        const name = cleanMemberName(raw);
        currentMember = resolveMember(name);
        currentMember.review =
          currentMember.matchedMemberId
            ? "Nama terdeteksi tanpa penanda 👷. Dipetakan ke anggota terdaftar."
            : `Nama "${name}" terdeteksi tanpa penanda 👷 dan belum terdaftar.`;
        if (currentMember.matchedMemberId) {
          pushFlag("info", "Beberapa nama terdeteksi tanpa emoji 👷 — sudah dicocokkan otomatis.");
        }
        currentActivity = null;
        return;
      }

      // 5. Label bagian tambahan ("Tindak Lanjut:", "Solusi:") — pengantar butir, bukan aktivitas.
      if (!isBullet && /:\s*$/.test(withoutEmoji) && withoutEmoji.length <= 48) {
        if (/(tindak\s*lanjut|solusi|follow\s*up)/i.test(withoutEmoji)) {
          currentSection = "plan";
        }
        currentActivity = null;
        return;
      }

      // 6. Baris bebas di bawah anggota: sambungan aktivitas sebelumnya, atau aktivitas baru
      //    (laporan nyata sering menulis aktivitas tanpa bullet).
      if (currentMember) {
        if (currentActivity) {
          currentActivity.text = `${currentActivity.text} ${withoutEmoji}`.trim();
        } else {
          const activity: ParsedActivity = { id: uid("pa"), kind: currentSection ?? "plan", text: withoutEmoji };
          currentMember.activities.push(activity);
          currentActivity = activity;
        }
        return;
      }

      // Kendala/lanjutan teks bebas sebelum nama anggota pertama (bagian tim):
      // hanya saat sudah berada di bawah judul bagian yang dikenal, dan baris cukup berisi.
      if (currentSection && /[a-z]/i.test(withoutEmoji) && withoutEmoji.length >= 8) {
        if (parsedMembers.length === 0 || parsedMembers[parsedMembers.length - 1].matchedMemberId !== null) {
          const unknown: ParsedMember = {
            id: uid("pm"),
            sourceName: "Tanpa nama",
            matchedMemberId: null,
            activities: [],
            review: "Aktivitas bagian tim sebelum nama anggota. Petakan atau abaikan pada pratinjau.",
          };
          parsedMembers.push(unknown);
          pushFlag("error", "Ada aktivitas tanpa nama anggota — periksa pratinjau.");
        }
        const fallback = parsedMembers[parsedMembers.length - 1];
        const activity: ParsedActivity = { id: uid("pa"), kind: currentSection, text: withoutEmoji };
        fallback.activities.push(activity);
        currentMember = fallback;
        currentActivity = activity;
        return;
      }

      ignoredLines.push(raw);
    });

    parsedMembers.forEach((member) => {
      if (member.activities.length === 0) {
        pushFlag("warning", `Anggota "${member.sourceName}" tidak memiliki aktivitas terbaca.`);
      }
    });

    const activityCount = parsedMembers.reduce((total, member) => total + member.activities.length, 0);
    if (activityCount === 0) {
      pushFlag("error", "Tidak ada aktivitas yang bisa dibaca dari teks ini.");
    }

    const fingerprint = contentFingerprint(
      block.headerDate,
      parsedMembers.map((member) => ({
        key: member.matchedMemberId ?? member.sourceName,
        activities: member.activities,
      })),
    );

    reports.push({
      id: `report-${blockIndex + 1}-${hashString(block.lines.join("\n")).slice(0, 6)}`,
      reportDate: block.headerDate,
      dateText: block.dateText,
      originalText: block.lines.join("\n"),
      members: parsedMembers,
      flags,
      fingerprint,
    });
  });

  return { reports, ignoredLines };
}
