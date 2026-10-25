import type { StandupEntry } from "@/lib/types";

/**
 * Keterangan tidak masuk kerja pada isi standup: teks anggota yang memuat
 * kata cuti/sakit/izin (atau ejaan "ijin"). Anggota dengan keterangan ini
 * tetap tampil di daftar dengan penanda oranye, tetapi tidak dihitung sebagai
 * "mengisi" pada kotak tanggal.
 */

export type AbsenceKind = "cuti" | "sakit" | "izin";

const ABSENCE_PATTERN = /\b(cuti|sakit|izin|ijin)\b/i;

export const ABSENCE_LABEL: Record<AbsenceKind, string> = {
  cuti: "Cuti",
  sakit: "Sakit",
  izin: "Izin",
};

/** Cari keterangan absen pertama pada kumpulan teks aktivitas; null bila tidak ada. */
export function detectAbsence(texts: string[]): AbsenceKind | null {
  for (const text of texts) {
    const match = ABSENCE_PATTERN.exec(text);
    if (match) {
      const word = match[1].toLowerCase();
      return word === "ijin" ? "izin" : (word as AbsenceKind);
    }
  }
  return null;
}

/** Keterangan absen sebuah catatan standup — dicek dari semua bagian (rencana/selesai/kendala). */
export function entryAbsence(entry: StandupEntry): AbsenceKind | null {
  return detectAbsence([...entry.plans, ...entry.done, ...entry.blockers].map((item) => item.text));
}
