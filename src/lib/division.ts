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
 * terlihat. Entri/tugas milik divisi lain tetap ada di data (tidak dihapus),
 * hanya disembunyikan dari tampilan divisi ini.
 */
export function scopedState(state: AppState, division: string): AppState {
  return { ...state, members: state.members.filter(member => memberDivision(member) === division) };
}
