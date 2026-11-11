import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DIVISION, memberDivision, scopedState } from "../src/lib/division";
import { applyImport, type ImportDecision } from "../src/lib/import-apply";
import { buildReport } from "../src/lib/report";
import { filterStateForRange } from "../src/lib/share";
import type { AppState, Member } from "../src/lib/types";

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

test("filterStateForRange: tautan berbagi hanya memuat divisi pembuatnya", () => {
  const shared = filterStateForRange(STATE, "2026-11-10", "2026-11-10", "Maintenance");
  assert.deepEqual(shared.members.map((m) => m.id), ["m-hendra"]);
  assert.deepEqual(shared.entries.map((e) => e.memberId), ["m-hendra"]); // entri Isra tidak ikut bocor
  // Laporan divisi sendiri tidak tampil sebagai "divisi lain" bagi pembaca.
  assert.deepEqual(shared.divisionReports?.map((r) => r.division), ["Product"]);

  // Tanpa divisi (tautan lama) perilaku tidak berubah: semua anggota ikut.
  const legacy = filterStateForRange(STATE, "2026-11-10", "2026-11-10");
  assert.equal(legacy.members.length, 3);
});
