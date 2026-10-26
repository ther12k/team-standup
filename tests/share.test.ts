import test from "node:test";
import assert from "node:assert/strict";
import { filterStateForRange, isValidShareId, shareCreateSchema, shareModeFor, shareWindowEnd, shareWindowStart } from "../src/lib/share";
import type { AppState } from "../src/lib/types";

function makeState(): AppState {
  return {
    version: 1,
    members: [
      { id: "m-a", name: "Alpha", role: "Dev", accent: "teal" },
      { id: "m-b", name: "Beta", role: "Dev", accent: "sky" },
    ],
    tasks: [
      { id: "t-1", title: "Tugas dipakai", assigneeIds: ["m-a"], status: "belum", createdAt: "2026-10-01T00:00:00Z", statusHistory: [] },
      { id: "t-2", title: "Tugas di luar rentang", assigneeIds: ["m-b"], status: "belum", createdAt: "2026-10-01T00:00:00Z", statusHistory: [] },
    ],
    entries: [
      {
        id: "e-1", date: "2026-10-22", memberId: "m-a", updatedAt: "2026-10-22T09:00:00Z", source: "manual",
        plans: [{ id: "i-1", text: "Kerja A", taskId: "t-1" }], done: [], blockers: [],
      },
      {
        id: "e-2", date: "2026-10-20", memberId: "m-b", updatedAt: "2026-10-20T09:00:00Z", source: "manual",
        plans: [{ id: "i-2", text: "Kerja lama", taskId: "t-2" }], done: [], blockers: [],
      },
    ],
    imports: [{ id: "im-1", reportDate: null, importedAt: "2026-10-22T00:00:00Z", originalText: "x", fingerprint: "0".repeat(64), memberNames: [], activityCount: 1 }],
    divisionReports: [
      { id: "dv-1", division: "RnD", date: "2026-10-22", text: "RnD laporan" },
      { id: "dv-2", division: "Product", date: "2026-10-01", text: "Product lama" },
    ],
  };
}

test("filterStateForRange: hanya entri dan tugas terkait rentang yang ikut", () => {
  const filtered = filterStateForRange(makeState(), "2026-10-22", "2026-10-23");
  assert.deepEqual(filtered.entries.map(e => e.id), ["e-1"]);
  assert.deepEqual(filtered.tasks.map(t => t.id), ["t-1"]);
  assert.deepEqual(filtered.imports, []);
  // Anggota tetap utuh (diperlukan untuk nama pelapor), imports dibuang.
  assert.equal(filtered.members.length, 2);
  // Laporan divisi hanya yang jatuh di rentang jendela.
  assert.deepEqual(filtered.divisionReports?.map(r => r.id), ["dv-1"]);
});

test("filterStateForRange: batas rentang inklusif", () => {
  const filtered = filterStateForRange(makeState(), "2026-10-20", "2026-10-20");
  assert.deepEqual(filtered.entries.map(e => e.id), ["e-2"]);
});

test("skema berbagi: rentang sah diterima dengan default groupBy member", () => {
  const parsed = shareCreateSchema.parse({ start: "2026-10-20", end: "2026-10-22" });
  assert.equal(parsed.groupBy, "member");
  assert.equal(shareCreateSchema.parse({ start: "2026-10-20", end: "2026-10-22", groupBy: "project" }).groupBy, "project");
});

test("skema berbagi: start>end, tanggal rusak, dan rentang >62 hari ditolak", () => {
  assert.equal(shareCreateSchema.safeParse({ start: "2026-10-22", end: "2026-10-20" }).success, false);
  assert.equal(shareCreateSchema.safeParse({ start: "22/10/2026", end: "2026-10-23" }).success, false);
  assert.equal(shareCreateSchema.safeParse({ start: "2026-01-01", end: "2026-03-15" }).success, false);
  // 62 hari tepat masih boleh, 63 hari tidak.
  assert.equal(shareCreateSchema.safeParse({ start: "2026-01-01", end: "2026-03-03" }).success, true);
  assert.equal(shareCreateSchema.safeParse({ start: "2026-01-01", end: "2026-03-04" }).success, false);
});

test("ID tautan: 8 karakter alfanumerik diterima", () => {
  assert.equal(isValidShareId("aB3xY9zQ"), true);
  assert.equal(isValidShareId("7Kd0mPq2"), true);
});

test("ID tautan: UUID lama tetap sah agar tautan yang telah tersebar tidak mati", () => {
  assert.equal(isValidShareId("1b671a64-40d5-491e-99f0-c2d8d6ec42f2"), true);
});

test("ID tautan: format lain ditolak", () => {
  assert.equal(isValidShareId("aB3xY9z"), false); // terlalu pendek
  assert.equal(isValidShareId("aB3xY9zQ1"), false); // terlalu panjang
  assert.equal(isValidShareId("aB3xY9z-"), false); // simbol
  assert.equal(isValidShareId(""), false);
  assert.equal(isValidShareId("%3Cscript%3E"), false);
  assert.equal(isValidShareId("1b671a64-40d5-491e-99f0-c2d8d6ec42z"), false); // UUID rusak
});

test("mode tautan: satu hari = harian, rentang = mingguan", () => {
  assert.equal(shareModeFor("2026-10-23", "2026-10-23"), "day");
  assert.equal(shareModeFor("2026-10-19", "2026-10-25"), "week");
});

test("jendela tautan: Senin minggu sebelumnya sampai akhir minggu yang dibagikan", () => {
  // Tautan hari (Jumat 23 Okt): jendela = Senin 12 Okt s.d. Min 25 Okt.
  assert.equal(shareWindowStart("2026-10-23"), "2026-10-12");
  assert.equal(shareWindowEnd("2026-10-23", "2026-10-23"), "2026-10-25");
  // Tautan minggu (19–25 Okt): jendela sama.
  assert.equal(shareWindowStart("2026-10-19"), "2026-10-12");
  assert.equal(shareWindowEnd("2026-10-19", "2026-10-25"), "2026-10-25");
  // Lintasi bulan tetap akurat (Senin 2 Nov anchoring → minggu sebelumnya Senin 26 Okt).
  assert.equal(shareWindowStart("2026-11-03"), "2026-10-26");
  assert.equal(shareWindowEnd("2026-11-03", "2026-11-03"), "2026-11-08");
});
