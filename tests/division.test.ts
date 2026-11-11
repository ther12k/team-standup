import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DIVISION, memberDivision, scopedState } from "../src/lib/division";
import { applyImport, type ImportDecision } from "../src/lib/import-apply";
import { buildReport, reportToCsv } from "../src/lib/report";
import { formatReportForWhatsApp, formatStandupForWhatsApp } from "../src/lib/whatsapp";
import { filterStateForRange } from "../src/lib/share";
import type { AppState, Member, Task } from "../src/lib/types";

const member = (id: string, name: string, division?: string): Member => ({
  id,
  name,
  role: "Teknisi",
  accent: "teal",
  ...(division ? { division } : {}),
});

const STATE: AppState = {
  version: 1,
  members: [
    member("m-isra", "Isra"), // kartu lama tanpa divisi -> M2MPD
    member("m-david", "David", "M2MPD"),
    member("m-hendra", "Hendra", "Maintenance"),
  ],
  tasks: [],
  entries: [
    { id: "e1", date: "2026-11-10", memberId: "m-isra", plans: [{ id: "i1", text: "susun API" }], done: [], blockers: [], updatedAt: "2026-11-10T02:00:00.000Z", source: "manual" },
    { id: "e2", date: "2026-11-10", memberId: "m-hendra", plans: [{ id: "i2", text: "cek pendingin server" }], done: [], blockers: [], updatedAt: "2026-11-10T02:00:00.000Z", source: "manual" },
  ],
  imports: [],
  divisionReports: [
    { id: "dr1", division: "Maintenance", date: "2026-11-10", text: "jadwal backup" },
    { id: "dr2", division: "Product", date: "2026-11-10", text: "rilis fitur" },
  ],
};

test("memberDivision: kartu tanpa divisi memakai divisi bawaan M2MPD", () => {
  assert.equal(memberDivision({ id: "m", name: "x", role: "r", accent: "teal" }), DEFAULT_DIVISION);
  assert.equal(memberDivision(member("m", "x", "Maintenance")), "Maintenance");
});

test("scopedState: hanya anggota divisi terpilih yang tampil", () => {
  assert.deepEqual(scopedState(STATE, "M2MPD").members.map((m) => m.id), ["m-isra", "m-david"]);
  assert.deepEqual(scopedState(STATE, "Maintenance").members.map((m) => m.id), ["m-hendra"]);
  assert.deepEqual(scopedState(STATE, "RnD").members, []);
  // Data asli tidak berubah — entri divisi lain tetap ada di workspace.
  assert.equal(STATE.members.length, 3);
});

test("buildReport mengikuti cakupan divisi: hitungan dan belum-mengisi per divisi", () => {
  const m2mpd = buildReport(scopedState(STATE, "M2MPD"), "2026-11-10", "2026-11-10");
  assert.equal(m2mpd.activeMemberCount, 2);
  assert.deepEqual(m2mpd.missingMembers.map((m) => m.id), ["m-david"]); // Isra sudah mengisi, Hendra bukan divisi ini

  const maintenance = buildReport(scopedState(STATE, "Maintenance"), "2026-11-10", "2026-11-10");
  assert.equal(maintenance.activeMemberCount, 1);
  assert.deepEqual(maintenance.missingMembers, []); // Hendra sudah mengisi
});

test("applyImport: anggota baru diberi divisi, nama cocok hanya dalam divisinya", () => {
  const decision: ImportDecision = {
    reportDate: "2026-11-10",
    originalText: "teks",
    members: [
      {
        sourceName: "Isra",
        memberId: null,
        createMember: { name: "Isra", role: "Teknisi", division: "Maintenance" },
        activities: [{ kind: "plan", text: "perbaikan AC ruang server" }],
      },
      {
        sourceName: "Hendra",
        memberId: null,
        createMember: { name: "Hendra", role: "Teknisi", division: "Maintenance" },
        activities: [{ kind: "plan", text: "ganti UPS" }],
      },
    ],
  };
  const { state, summary } = applyImport(STATE, decision);
  // "Isra" Maintenance adalah anggota baru — tidak menimpa Isra M2MPD.
  assert.equal(summary.membersCreated, 1);
  const israMaintenance = state.members.find((m) => m.name === "Isra" && m.division === "Maintenance");
  assert.ok(israMaintenance, "anggota Isra Maintenance dibuat");
  // "Hendra" sudah ada di Maintenance -> dipakai ulang, tidak dibuat lagi.
  assert.equal(state.members.filter((m) => m.name === "Hendra").length, 1);
  assert.equal(state.members.length, 4);
});

test("applyImport: tanpa divisi, nama cocok dengan anggota divisi bawaan", () => {
  const decision: ImportDecision = {
    reportDate: "2026-11-10",
    originalText: "teks",
    members: [
      {
        sourceName: "Isra",
        memberId: null,
        createMember: { name: "Isra", role: "Teknisi" },
        activities: [{ kind: "plan", text: "review" }],
      },
    ],
  };
  const { state, summary } = applyImport(STATE, decision);
  assert.equal(summary.membersCreated, 0);
  assert.equal(state.members.length, 3);
});

test("scopedState: entri dan tugas disaring sesuai divisi anggota", () => {
  const stateWithTasks: AppState = {
    ...STATE,
    tasks: [
      { id: "t-unassigned", title: "Tugas Umum", assigneeIds: [], status: "belum", createdAt: "2026-11-10T00:00:00Z", statusHistory: [] },
      { id: "t-m2m", title: "Tugas M2MPD", assigneeIds: ["m-isra"], status: "belum", createdAt: "2026-11-10T00:00:00Z", statusHistory: [] },
      { id: "t-maint", title: "Tugas Maintenance", assigneeIds: ["m-hendra"], status: "belum", createdAt: "2026-11-10T00:00:00Z", statusHistory: [] },
    ],
  };

  const m2mpd = scopedState(stateWithTasks, "M2MPD");
  assert.deepEqual(m2mpd.entries.map((e) => e.id), ["e1"]);
  assert.deepEqual(m2mpd.tasks.map((t) => t.id), ["t-unassigned", "t-m2m"]);

  const maint = scopedState(stateWithTasks, "Maintenance");
  assert.deepEqual(maint.entries.map((e) => e.id), ["e2"]);
  assert.deepEqual(maint.tasks.map((t) => t.id), ["t-unassigned", "t-maint"]);
});

test("laporan, ringkasan WA, dan ekspor CSV tidak membocorkan data divisi lain", () => {
  const maintScoped = scopedState(STATE, "Maintenance");
  const report = buildReport(maintScoped, "2026-11-10", "2026-11-10");

  assert.equal(report.entryCount, 1);
  assert.equal(report.plans, 1);
  assert.equal(report.lines[0].text, "cek pendingin server");
  assert.equal(report.lines[0].memberName, "Hendra");

  const csv = reportToCsv(report);
  assert.equal(csv.includes("susun API"), false);
  assert.equal(csv.includes("Anggota tidak dikenal"), false);

  const waRingkasan = formatReportForWhatsApp(report);
  assert.equal(waRingkasan.includes("susun API"), false);
  assert.equal(waRingkasan.includes("Anggota tidak dikenal"), false);

  const waBoard = formatStandupForWhatsApp(maintScoped, "2026-11-10");
  assert.equal(waBoard.includes("susun API"), false);
});

test("filterStateForRange: menyamarkan teks pada tanggal pratinjau yang terkunci", () => {
  const shared = filterStateForRange(
    STATE,
    "2026-11-01",
    "2026-11-20",
    "Maintenance",
    { start: "2026-11-15", end: "2026-11-20" }, // 2026-11-10 berada di luar jendela terbuka (terkunci)
  );

  assert.equal(shared.entries.length, 1);
  assert.equal(shared.entries[0].plans[0].text, "Aktivitas terkunci");
  assert.equal(shared.tasks.length, 0); // tugas pada tanggal terkunci tidak disertakan
});
