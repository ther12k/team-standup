export type TaskStatus = "belum" | "dikerjakan" | "terhambat" | "selesai";

export type Accent = "teal" | "amber" | "violet" | "sky" | "rose" | "emerald" | "indigo" | "orange";

export type Member = {
  id: string;
  name: string;
  role: string;
  accent: Accent;
  /** Anggota non-aktif (resign/cuti panjang): riwayat lama tetap terlihat, tidak dihitung sebagai "belum mengisi". */
  active?: boolean;
};

export type StatusEvent = {
  id: string;
  status: TaskStatus;
  at: string;
  note?: string;
};

export type Task = {
  id: string;
  title: string;
  assigneeIds: string[];
  /** Proyek atau lokasi kerja, mis. "Aplikasi Kasir". */
  project?: string;
  /** ISO date (YYYY-MM-DD). Tidak pernah diisi otomatis dari tanggal standup. */
  dueDate?: string;
  notes?: string;
  status: TaskStatus;
  createdAt: string;
  statusHistory: StatusEvent[];
};

export type StandupItem = {
  id: string;
  text: string;
  taskId?: string;
  /** Proyek/lokasi opsional yang diisi langsung saat input standup; kosong berarti tanpa proyek. */
  project?: string;
  /** Stable provenance for idempotent Live report corrections. */
  sourceSessionId?: string;
  projectSnapshot?: string;
};

export type StandupEntry = {
  id: string;
  /** Tanggal laporan, terpisah dari waktu input. */
  date: string;
  memberId: string;
  plans: StandupItem[];
  done: StandupItem[];
  blockers: StandupItem[];
  updatedAt: string;
  source: "manual" | "import" | "live";
  importId?: string;
};

export type ImportRecord = {
  id: string;
  reportDate: string | null;
  importedAt: string;
  originalText: string;
  fingerprint: string;
  memberNames: string[];
  activityCount: number;
};

/** Hari libur nasional/cuti bersama (ISO). Dikelola tim; Sabtu–Minggu otomatis non-kerja. */
export type Holiday = { date: string; label?: string };

/**
 * Laporan harian DIVISI LAIN (mis. RnD, Product) hasil
 * ekstraksi arsip chat divisi — referensi saja, bukan bagian standup tim.
 */
export type DivisionReport = {
  id: string;
  division: string;
  /** Tanggal laporan (ISO) dari judul laporan sumber. */
  date: string;
  /** Penulis asli di chat (mis. "Bagas Wicaksana"). */
  author?: string;
  /** Jam kirim pesan ("HH:MM" 24 jam, waktu lokal chat). */
  time?: string;
  /** Teks laporan lengkap, tanpa baris penulis/stempel. */
  text: string;
};

export type AppState = {
  version: 1;
  members: Member[];
  tasks: Task[];
  entries: StandupEntry[];
  imports: ImportRecord[];
  /** Opsional untuk kompatibilitas data lama; bila kosong dipakai daftar bawaan. */
  holidays?: Holiday[];
  /** Laporan divisi lain (referensi); dimuat dari seed server saat pertama kali. */
  divisionReports?: DivisionReport[];
};

/** Akun login aplikasi (tabel standup_users). Koordinator = admin. */
export type AuthRole = "admin" | "member";
export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: AuthRole;
  /** Divisi/departemen akun, mis. "Engineering". */
  division: string;
  /** Anggota tim yang diwakili akun ini (untuk identitas standup/Live). */
  memberId: string | null;
  /** False hanya untuk akun bawaan yang belum pernah mengganti kata sandi. */
  passwordChanged: boolean;
  /** Akun nonaktif tidak bisa masuk; riwayatnya tetap ada. */
  active: boolean;
};

export type ItemKind = "plan" | "done" | "blocker";

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  plan: "Rencana",
  done: "Pekerjaan Sebelumnya",
  blocker: "Kendala",
};

export const TASK_STATUSES: TaskStatus[] = ["belum", "dikerjakan", "terhambat", "selesai"];
