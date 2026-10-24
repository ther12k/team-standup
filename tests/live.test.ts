import test from "node:test";
import assert from "node:assert/strict";
import { applyLiveReport, createLiveSession, liveReportSnapshot, reduceLiveSession, suggestFromTranscript, type LiveActivity, type LiveSession } from "../src/lib/live";
import { buildReport } from "../src/lib/report";
import { roomActionSchema, roomCreateSchema } from "../src/lib/live-validation";

const seed = () => ({
  version: 1 as const,
  members: [
    { id: "m-raka", name: "Raka", role: "Software Engineer", accent: "teal" as const },
    { id: "m-bima", name: "Bima", role: "Software Engineer", accent: "violet" as const },
    { id: "m-sinta", name: "Sinta", role: "Software Engineer", accent: "sky" as const },
    { id: "m-galang", name: "Galang", role: "Implementation Engineer", accent: "amber" as const },
  ],
  tasks: [{
    id: "t-kasir",
    title: "Review dan rapikan modul kasir",
    assigneeIds: ["m-raka"],
    project: "Aplikasi Kasir",
    status: "dikerjakan" as const,
    createdAt: "2026-10-01T01:00:00.000Z",
    statusHistory: [{ id: "h1", status: "dikerjakan" as const, at: "2026-10-01T01:00:00.000Z" }],
  }],
  entries: [{
    id: "e-raka-1",
    date: "2026-10-13",
    memberId: "m-raka",
    plans: [{ id: "i-raka-1", text: "Rapikan laporan bug mingguan", taskId: "t-kasir" }],
    done: [], blockers: [],
    updatedAt: "2026-10-13T04:00:00.000Z",
    source: "manual" as const,
  }],
  imports: [],
});
function room(): LiveSession {
  const state = seed();
  return createLiveSession({ id: "session-test", title: "Standup tim", date: "2026-10-13", members: state.members, tasks: state.tasks, withDemo: true }, "2026-10-13T02:00:00.000Z");
}
const activity = (patch: Partial<LiveActivity> = {}): LiveActivity => ({ id: "a-1", memberId: "m-raka", text: "Memantau antrean tiket sisi klien", kind: "plan", createTask: false, taskId: "t-kasir", messageId: "sample-1", origin: "transcript", ...patch });
const select = (session: LiveSession, item: LiveActivity) => reduceLiveSession(session, { type: "upsert", activity: item });
function publish(session: LiveSession) {
  return reduceLiveSession(reduceLiveSession(session, { type: "phase", phase: "review" }), { type: "phase", phase: "published" }, "2026-10-13T03:00:00.000Z");
}

test("sesi contoh tidak otomatis mengubah percakapan menjadi laporan", () => {
  const session = room();
  assert.equal(session.messages.length, 4);
  assert.equal(session.activities.length, 0);
  assert.equal(session.phase, "active");
  assert.throws(() => publish(session), /minimal satu/);
});

test("saran demo tidak mengubah rencana, negasi, atau pertanyaan menjadi selesai", () => {
  for (const text of ["Besok saya akan menyelesaikan tugas.", "Saya belum selesai mengganti housing.", "Rencana saya akan selesai hari ini.", "Saya tidak sudah selesai mengganti kamera."]) {
    assert.ok(suggestFromTranscript(text).every(s => s.kind !== "done"), text);
  }
  assert.equal(suggestFromTranscript("Saya sudah selesai mengganti housing kamera.")[0]?.kind, "done");
  assert.equal(suggestFromTranscript("Kendala: menunggu kabel dari gudang.")[0]?.kind, "blocker");
  assert.equal(suggestFromTranscript("Ceritakan rencana hari ini.").length, 0);
  assert.equal(suggestFromTranscript("Apakah sudah selesai?").length, 0);
  assert.equal(suggestFromTranscript("Kemarin saya sudah selesai mengganti kamera.")[0]?.explicit, false);
});

test("memilih dan mengedit potongan transkrip mempertahankan teks asli", () => {
  const original = room();
  const picked = select(original, activity());
  const edited = select(picked, activity({ text: "Review modul kasir sisi struk", memberId: "m-sinta", kind: "blocker" }));
  assert.deepEqual(edited.messages, original.messages);
  assert.equal(edited.activities.length, 1);
  assert.equal(edited.activities[0].memberId, "m-sinta");
  assert.equal(edited.activities[0].kind, "blocker");
  assert.equal(original.activities.length, 0);
});

test("pesan idempotent dan pilihan transkrip identik tidak terduplikasi", () => {
  const message = { id: "msg-1", memberId: "m-raka", text: "Rencana cek jaringan", source: "typed" as const };
  const first = reduceLiveSession(room(), { type: "message", message });
  const repeated = reduceLiveSession(first, { type: "message", message });
  assert.equal(repeated.messages.length, first.messages.length);
  assert.equal(repeated.revision, first.revision);
  const picked = select(first, activity());
  const same = select(picked, activity({ id: "different-id" }));
  assert.equal(same.activities.length, 1);
  assert.equal(select(same, activity({ id: "another", text: "Cek log gerbang" })).activities.length, 2);
});

test("validasi menolak pemilik, sumber, atau tugas yang tidak tersedia", () => {
  assert.throws(() => select(room(), activity({ memberId: "tidak-ada" })), /Pemilik/);
  assert.throws(() => select(room(), activity({ taskId: "tidak-ada" })), /Tugas/);
  assert.throws(() => select(room(), activity({ messageId: "tidak-ada" })), /transkrip/);
  assert.throws(() => select(room(), activity({ createTask: true })), /bukan keduanya/);
  assert.equal(roomCreateSchema.safeParse({ title: "Tes", date: "2026-02-30", members: seed().members, tasks: [], withDemo: false }).success, false);
  assert.equal(roomActionSchema.safeParse({ revision: 0, action: { type: "upsert", activity: activity({ text: "" }) } }).success, false);
});

test("manual entry didukung tanpa transkrip dan publikasi memerlukan tahap tinjauan", () => {
  const manual = select(room(), activity({ messageId: undefined, origin: "manual", taskId: undefined, createTask: true }));
  assert.throws(() => reduceLiveSession(manual, { type: "phase", phase: "published" }), /Tinjau/);
  const published = publish(manual);
  assert.equal(published.phase, "published");
  assert.throws(() => select(published, activity()), /Ubah laporan/);
  assert.throws(() => reduceLiveSession(published, { type: "message", message: { id: "x", memberId: "m-raka", text: "test", source: "typed" } }), /dijeda/);
});

test("publikasi ulang tidak menduplikasi laporan atau tugas dan tidak menghapus catatan lain", () => {
  const original = seed();
  const session = publish(select(room(), activity({ taskId: undefined, createTask: true })));
  const first = applyLiveReport(original, session);
  const second = applyLiveReport(first, session);
  assert.deepEqual(second, first);
  assert.equal(first.tasks.length, original.tasks.length + 1);
  const newTask = first.tasks.find(t => t.id === "t-live-a-1");
  assert.equal(newTask?.status, "belum");
  assert.equal(newTask?.dueDate, undefined);
  const oldItems = original.entries.find(e => e.date === session.date && e.memberId === "m-raka")!.plans;
  const newItems = second.entries.find(e => e.date === session.date && e.memberId === "m-raka")!.plans;
  assert.equal(newItems.length, oldItems.length + 1);
  assert.ok(oldItems.every(item => newItems.some(n => n.id === item.id)));
});

test("koreksi pascapublikasi hanya mengganti item sesi terkait", () => {
  const firstSession = publish(select(room(), activity()));
  const firstState = applyLiveReport(seed(), firstSession);
  const review = reduceLiveSession(firstSession, { type: "phase", phase: "review" });
  const revised = publish(select(review, activity({ text: "Penggantian sensor selesai", kind: "done" })));
  const next = applyLiveReport(firstState, revised);
  const entry = next.entries.find(e => e.date === revised.date && e.memberId === "m-raka")!;
  assert.equal(entry.plans.some(i => i.sourceSessionId === revised.id), false);
  assert.equal(entry.done.filter(i => i.sourceSessionId === revised.id).length, 1);
  assert.equal(entry.done.find(i => i.sourceSessionId === revised.id)?.text, "Penggantian sensor selesai");
  assert.equal(next.tasks.find(t => t.id === "t-kasir")?.status, "dikerjakan");
  assert.equal(buildReport(next, revised.date, revised.date).done, buildReport(seed(), revised.date, revised.date).done + 1);
});

test("snapshot laporan hanya berisi aktivitas dipilih, bukan transkrip", () => {
  const session = publish(select(room(), activity()));
  const snapshot = liveReportSnapshot(session);
  assert.equal(snapshot.state.entries.length, 1);
  assert.equal(snapshot.state.entries[0].plans.length, 1);
  assert.equal(snapshot.date, session.date);
  assert.equal("messages" in snapshot, false);
  assert.equal(JSON.stringify(snapshot).includes("Selamat pagi, tim"), false);
  const restored = JSON.parse(JSON.stringify(snapshot));
  assert.equal(restored.state.entries[0].plans[0].sourceSessionId, session.id);
  assert.deepEqual(buildReport(restored.state, session.date, session.date), buildReport(snapshot.state, session.date, session.date));
});

test("status aktif anggota bertahan melewati validasi ruang dan snapshot laporan", () => {
  const resigned = [
    { id: "m-raka", name: "Raka", role: "Teknisi", accent: "teal" as const, active: false },
    { id: "m-sinta", name: "Sinta", role: "Teknisi", accent: "sky" as const },
  ];
  const parsed = roomCreateSchema.parse({ title: "Uji anggota non-aktif", date: "2026-10-13", members: resigned, tasks: [], withDemo: false });
  assert.equal(parsed.members[0].active, false);
});
