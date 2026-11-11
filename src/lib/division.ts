import type { AppState, Member } from "@/lib/types";

/** Divisi yang dikenal di ruang kerja (bisa disesuaikan untuk tim kamu). */
export const DIVISIONS = ["M2MPD", "RnD", "Product", "Maintenance", "PM Project"] as const;

export const DEFAULT_DIVISION = "M2MPD";

/** Divisi anggota — kartu lama tanpa divisi dianggap divisi bawaan. */
export function memberDivision(member: Member): string {
  return member.division ?? DEFAULT_DIVISION;
}

/**
 * State ruang kerja yang dipotong sesuai divisi: hanya anggota divisi itu yang
 * terlihat. Entri disaring ke anggota divisi tersebut, dan tugas mencakup tugas
 * tanpa penanggung jawab (milik umum) atau yang penanggung jawabnya ada di divisi ini.
 * Entri/tugas milik divisi lain tetap ada di data (tidak dihapus),
 * hanya disembunyikan dari tampilan divisi ini.
 */
export function scopedState(state: AppState, division: string): AppState {
  const members = state.members.filter(member => memberDivision(member) === division);
  const scopedMemberIds = new Set(members.map(member => member.id));
  const entries = state.entries.filter(entry => scopedMemberIds.has(entry.memberId));
  const tasks = state.tasks.filter(
    task => task.assigneeIds.length === 0 || task.assigneeIds.some(id => scopedMemberIds.has(id)),
  );
  return { ...state, members, entries, tasks };
}
