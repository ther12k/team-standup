import test from "node:test";
import assert from "node:assert/strict";
import { contentFingerprint, parseWhatsAppReports } from "../src/lib/import-parser";
import { applyImport, type ImportDecision } from "../src/lib/import-apply";
import { buildReport, reportToCsv } from "../src/lib/report";
import { carryCandidates, isEntryEmpty } from "../src/lib/tasks";
import { formatStandupForWhatsApp } from "../src/lib/whatsapp";
import { parseDateFromText } from "../src/lib/date";
import type { AppState, Member, Task } from "../src/lib/types";

const MEMBERS: Member[] = [
  { id: "m-bima", name: "Bima Aditya", role: "Teknisi Lapangan", accent: "teal" },
  { id: "m-sinta", name: "Sinta Rahmawati", role: "Teknisi Lapangan", accent: "sky" },
];

const SAMPLE = [
  "💬 Report Daily Stand Up – 13/10/2026",
  "📅 Rencana Kerja Hari Ini",
  "👷 Bang Bima",
  "• review pull request diskon",
  "• rapikan dokumentasi api",
  "👷 Bang Sinta",
  "• tulis pengujian otomatis",
  "✅ Pekerjaan Selesai",
  "👷 Bang Sinta",
  "• perbaiki bug cetak struk",
  "⛔ Kendala",
  "👷 Bang Bima",
  "• lingkungan staging kadang lambat saat deploy",
].join("\n");

function baseState(): AppState {
  const task: Task = {
    id: "t-kasir",
    title: "Review dan rapikan modul kasir",
    assigneeIds: ["m-bima"],
    project: "Aplikasi Kasir",
    status: "dikerjakan",
    createdAt: "2026-10-01T01:00:00.000Z",
    statusHistory: [{ id: "h1", status: "dikerjakan", at: "2026-10-01T01:00:00.000Z" }],
  };
  return { version: 1, members: MEMBERS.map((m) => ({ ...m })), tasks: [task], entries: [], imports: [] };
}

test("parser mengenali tanggal, anggota, dan bagian rencana/selesai/kendala", () => {
  const result = parseWhatsAppReports(SAMPLE, MEMBERS);
  assert.equal(result.reports.length, 1);
  const report = result.reports[0];
  assert.equal(report.reportDate, "2026-10-13");

  const bima = report.members.find((member) => member.sourceName === "Bang Bima");
  const sinta = report.members.find((member) => member.sourceName === "Bang Sinta");
  assert.ok(bima && sinta);
  assert.equal(bima.matchedMemberId, "m-bima");
  assert.equal(sinta.matchedMemberId, "m-sinta");

  const bimaPlans = bima.activities.filter((activity) => activity.kind === "plan");
  assert.equal(bimaPlans.length, 2);
  assert.equal(bimaPlans[0].text, "review pull request diskon");
  // Aktivitas di bawah Rencana tidak boleh dianggap selesai.
  assert.equal(bima.activities.some((activity) => activity.kind === "done"), false);

  const sintaDone = sinta.activities.filter((activity) => activity.kind === "done");
  assert.equal(sintaDone.length, 1);
  assert.equal(sintaDone[0].text, "perbaiki bug cetak struk");

  const blocker = bima.activities.find((activity) => activity.kind === "blocker");
  assert.ok(blocker);
  assert.match(blocker.text, /lingkungan staging/i);
});

test("tanggal yang hilang dan nama tak dikenal ditandai untuk diperiksa", () => {
  const withoutDate = ["📅 Rencana Kerja Hari Ini", "👷 Bang Fajar", "• cek stok adapter"].join("\n");
  const result = parseWhatsAppReports(withoutDate, MEMBERS);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].reportDate, null);
  assert.ok(result.reports[0].flags.some((flag) => flag.level === "error" && /tanggal/i.test(flag.message)));

  const unknown = parseWhatsAppReports(
    ["💬 Report Daily Stand Up – 13/10/2026", "👷 Bang Fajar", "• cek stok adapter"].join("\n"),
    MEMBERS,
  );
  const member = unknown.reports[0].members[0];
  assert.equal(member.matchedMemberId, null);
  assert.ok(unknown.reports[0].flags.some((flag) => /belum terdaftar/i.test(flag.message)));
});

test("tanggal laporan disimpan terpisah dari waktu impor", () => {
  const state = baseState();
  const decision: ImportDecision = {
    reportDate: "2026-10-13",
    originalText: SAMPLE,
    members: [
      {
        sourceName: "Bang Bima",
        memberId: "m-bima",
        activities: [{ kind: "plan", text: "review pull request diskon", taskId: "t-kasir" }],
      },
    ],
  };
  const now = "2026-10-20T02:30:00.000Z";
  const { state: next, summary } = applyImport(state, decision, now);
  assert.equal(summary.saved, true);
  assert.equal(next.entries.length, 1);
  assert.equal(next.entries[0].date, "2026-10-13");
  assert.equal(next.imports[0].reportDate, "2026-10-13");
  assert.equal(next.imports[0].importedAt, now);
  assert.equal(next.imports[0].originalText, SAMPLE);
});

test("impor identik tidak membuat catatan ganda dan tidak menggandakan tugas", () => {
  const state = baseState();
  const decision: ImportDecision = {
    reportDate: "2026-10-13",
    originalText: SAMPLE,
    members: [
      {
        sourceName: "Bang Bima",
        memberId: "m-bima",
        activities: [
          { kind: "plan", text: "review pull request diskon", taskId: "t-kasir" },
          { kind: "plan", text: "cek log akses gerbang timur" },
        ],
      },
      {
        sourceName: "Bang Sinta",
        memberId: null,
        createMember: { name: "David Simbolon", role: "Teknisi" },
        activities: [
          { kind: "plan", text: "tulis pengujian otomatis", createTask: { title: "Tulis pengujian otomatis" } },
        ],
      },
    ],
  };

  const first = applyImport(state, decision, "2026-10-14T01:00:00.000Z");
  assert.equal(first.summary.itemsAdded, 3);
  assert.equal(first.summary.tasksCreated, 1);
  assert.equal(first.state.entries.length, 2);
  assert.equal(first.state.imports.length, 1);

  const second = applyImport(first.state, decision, "2026-10-14T02:00:00.000Z");
  assert.equal(second.summary.itemsAdded, 0);
  assert.equal(second.summary.itemsSkipped, 3);
  assert.equal(second.summary.tasksCreated, 0);
  assert.equal(second.summary.duplicateReport, true);
  assert.equal(second.summary.saved, false);
  assert.equal(second.state.entries.length, 2);
  assert.equal(second.state.imports.length, 1);
  assert.equal(second.state.tasks.length, first.state.tasks.length);
  assert.equal(
    second.state.entries.reduce((total, entry) => total + entry.plans.length, 0),
    first.state.entries.reduce((total, entry) => total + entry.plans.length, 0),
  );
});

test("kata yang mirip tidak otomatis digabungkan sebagai tugas atau catatan sama", () => {
  const first = applyImport(baseState(), {
    reportDate: "2026-10-13",
    originalText: "review pull request diskon",
    members: [{ sourceName: "Bang Bima", memberId: "m-bima", activities: [{ kind: "plan", text: "review pull request diskon" }] }],
  });
  const second = applyImport(first.state, {
    reportDate: "2026-10-13",
    originalText: "review pull request lama",
    members: [
      { sourceName: "Bang Bima", memberId: "m-bima", activities: [{ kind: "plan", text: "review pull request lama" }] },
    ],
  });
  assert.equal(second.summary.itemsAdded, 1);
  assert.equal(second.state.entries.length, 1);
  assert.equal(second.state.entries[0].plans.length, 2);
  assert.notEqual(
    contentFingerprint("2026-10-13", [{ key: "m-bima", activities: [{ kind: "plan", text: "review pull request diskon" }] }]),
    contentFingerprint("2026-10-13", [{ key: "m-bima", activities: [{ kind: "plan", text: "review pull request lama" }] }]),
  );
});

test("tautan tugas menyimpan riwayat standup tanpa mengubah status atau tenggat tugas", () => {
  const state = baseState();
  const { state: next } = applyImport(state, {
    reportDate: "2026-10-13",
    originalText: "review pull request diskon",
    members: [
      {
        sourceName: "Bang Bima",
        memberId: "m-bima",
        activities: [{ kind: "plan", text: "review pull request diskon", taskId: "t-kasir" }],
      },
    ],
  });
  const task = next.tasks.find((item) => item.id === "t-kasir");
  assert.equal(task?.status, "dikerjakan");
  assert.equal(task?.dueDate, undefined);
  assert.equal(next.entries[0].plans[0].taskId, "t-kasir");
  assert.equal(next.entries[0].date, "2026-10-13");

  const candidates = carryCandidates(next, "2026-10-13");
  assert.equal(candidates[0].alreadyPlanned, true);
  const otherDay = carryCandidates(next, "2026-10-14");
  assert.equal(otherDay[0].alreadyPlanned, false);
  // Membawa tugas ke hari lain tidak menandai selesai.
  assert.equal(next.tasks[0].status, "dikerjakan");
});

test("proyek opsional: proyek item menang, lalu proyek tugas, lalu tanpa proyek", () => {
  const state = baseState();
  state.entries.push({
    id: "e-project",
    date: "2026-10-13",
    memberId: "m-bima",
    plans: [
      { id: "i-explicit", text: "patroli halaman", project: "Keamanan" },
      { id: "i-from-task", text: "review pull request diskon", taskId: "t-kasir" },
      { id: "i-none", text: "rapat koordinasi" },
      { id: "i-override", text: "cek ulang modul kasir", taskId: "t-kasir", project: "Audit" },
    ],
    done: [],
    blockers: [],
    updatedAt: "2026-10-13T01:00:00.000Z",
    source: "manual",
  });

  const report = buildReport(state, "2026-10-13", "2026-10-13", "project");
  const titles = report.groups.map((group) => group.title);
  // Proyek eksplisit pada item menang atas proyek tugas; tanpa proyek diurutkan terakhir.
  assert.deepEqual(titles, ["Aplikasi Kasir", "Audit", "Keamanan", "Tanpa proyek / lokasi"]);
  assert.equal(titles.at(-1), "Tanpa proyek / lokasi");
  assert.equal(report.groups.at(-1)?.lines[0].text, "rapat koordinasi");
  assert.ok(reportToCsv(report).includes("Keamanan"));
});

test("laporan historis memakai catatan pada tanggal tersebut dan status tugas diberi label terpisah", () => {
  const seed = baseState();
  const imported = applyImport(seed, {
    reportDate: "2026-10-13",
    originalText: "review pull request diskon",
    members: [
      {
        sourceName: "Bang Bima",
        memberId: "m-bima",
        activities: [{ kind: "plan", text: "review pull request diskon", taskId: "t-kasir" }],
      },
    ],
  }).state;

  // Tugas diubah menjadi selesai SETELAH tanggal laporan.
  const updated: AppState = {
    ...imported,
    tasks: imported.tasks.map((task) => (task.id === "t-kasir" ? { ...task, status: "selesai" } : task)),
  };

  const report = buildReport(updated, "2026-10-13", "2026-10-13", "member");
  assert.equal(report.plans, 1);
  const line = report.lines[0];
  assert.equal(line.text, "review pull request diskon");
  assert.equal(line.kind, "plan");
  assert.equal(line.taskStatus, "selesai");

  const csv = reportToCsv(report);
  assert.match(csv, /Rencana/);
  assert.match(csv, /review pull request diskon/);
  assert.match(csv, /selesai/);

  const wa = formatStandupForWhatsApp(updated, "2026-10-13");
  assert.match(wa, /Rencana/);
  assert.match(wa, /review pull request diskon/);
  // Bagian kosong tidak ditampilkan (tidak ada kendala pada tanggal ini).
  assert.equal(wa.includes("Kendala"), false);
});

test("parser membaca format tanggal lain dan tidak menebak tanggal", () => {
  assert.equal(parseDateFromText("Report 2026-10-13"), "2026-10-13");
  assert.equal(parseDateFromText("13/10/2026"), "2026-10-13");
  assert.equal(parseDateFromText("13 Oktober 2026"), "2026-10-13");
  assert.equal(parseDateFromText("tanpa tanggal"), null);
});

test("standup kosong dianggap belum mengisi", () => {
  const state = baseState();
  state.entries.push({
    id: "e1",
    date: "2026-10-13",
    memberId: "m-bima",
    plans: [],
    done: [],
    blockers: [],
    updatedAt: "2026-10-13T01:00:00.000Z",
    source: "manual",
  });
  assert.equal(isEntryEmpty(state.entries[0]), true);
  const report = buildReport(state, "2026-10-13", "2026-10-13");
  assert.equal(report.missingMembers.length, 2);
});

test("anggota non-aktif tidak dihitung belum mengisi tetapi riwayatnya tetap di laporan", () => {
  const seed = baseState();
  // Damar non-aktif (resign) dengan catatan historis; anggota lain aktif tanpa catatan.
  seed.members = [
    { id: "m-damar", name: "Damar", role: "Software Engineer", accent: "teal", active: false },
    { id: "m-kirana", name: "Kirana", role: "Software Engineer", accent: "violet" },
  ];
  seed.entries = [
    { id: "e1", date: "2026-10-19", memberId: "m-damar", plans: [{ id: "i1", text: "input data master produk" }], done: [], blockers: [], updatedAt: "2026-10-19T04:00:00.000Z", source: "import" },
  ];
  const report = buildReport(seed, "2026-10-20", "2026-10-20");
  assert.equal(report.missingMembers.length, 1);
  assert.equal(report.missingMembers[0].name, "Kirana"); // Damar tidak dihitung
  assert.equal(report.activeMemberCount, 1); // denominator hanya anggota aktif
  // Riwayat tanggal lampau tetap terbaca.
  const history = buildReport(seed, "2026-10-19", "2026-10-19");
  assert.equal(history.groups[0].title, "Damar");
  assert.equal(history.missingMembers.length, 1); // Kirana saja yang dianggap belum mengisi
});

test("judul bagian menang: butir Rencana tetap rencana walau menyebut selesai/bantuan", () => {
  const text = [
    "💬 Report Daily Stand Up – 13/10/2026",
    "📅 Rencana Kerja Hari Ini",
    "👷 Bang Bima",
    "• belum selesai memperbaiki validasi",
    "• Cek bantuan vendor",
  ].join("\n");
  const result = parseWhatsAppReports(text, MEMBERS);
  const activities = result.reports[0].members[0].activities;
  assert.equal(activities.length, 2);
  assert.ok(activities.every((activity) => activity.kind === "plan"));
});

test("butir tanpa judul bagian: negasi tidak dianggap selesai", () => {
  const text = [
    "💬 Report Daily Stand Up – 13/10/2026",
    "👷 Bang Bima",
    "• belum selesai memperbaiki validasi",
  ].join("\n");
  const result = parseWhatsAppReports(text, MEMBERS);
  assert.equal(result.reports[0].members[0].activities[0].kind, "plan");
});

test("impor mempertahankan daftar hari libur workspace", () => {
  const state = baseState();
  state.holidays = [{ date: "2026-10-26", label: "Cuti bersama tim" }];
  const { state: next } = applyImport(state, {
    reportDate: "2026-10-13",
    originalText: "review pull request diskon",
    members: [{ sourceName: "Bang Bima", memberId: "m-bima", activities: [{ kind: "plan", text: "review pull request diskon" }] }],
  });
  assert.equal(next.holidays?.length, 1);
  assert.equal(next.holidays?.[0].date, "2026-10-26");
});

test("impor memakai waktu pesan sumber sebagai waktu catatan, bukan waktu impor", () => {
  const state = baseState();
  const { state: next } = applyImport(
    state,
    {
      reportDate: "2026-10-13",
      originalText: "review pull request diskon",
      sourceAt: "2026-10-13T10:58:00+07:00",
      members: [{ sourceName: "Bang Bima", memberId: "m-bima", activities: [{ kind: "plan", text: "review pull request diskon" }] }],
    },
    "2026-10-24T09:00:00.000Z",
  );
  assert.equal(next.entries[0].updatedAt, "2026-10-13T10:58:00+07:00");
  // Tanpa sourceAt, jatuh ke waktu impor.
  const { state: fallback } = applyImport(state, {
    reportDate: "2026-10-14",
    originalText: "cek kabel",
    members: [{ sourceName: "Bang Bima", memberId: "m-bima", activities: [{ kind: "plan", text: "cek kabel" }] }],
  }, "2026-10-24T09:00:00.000Z");
  assert.equal(fallback.entries[0].updatedAt, "2026-10-24T09:00:00.000Z");
});
