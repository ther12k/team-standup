import test from "node:test";
import assert from "node:assert/strict";
import { detectAbsence, entryAbsence, ABSENCE_LABEL } from "../src/lib/absence";
import type { StandupEntry } from "../src/lib/types";

function entry(texts: string[]): StandupEntry {
  return {
    id: "e-1",
    date: "2026-10-23",
    memberId: "m-1",
    plans: texts.map((text, i) => ({ id: `i-${i}`, text })),
    done: [],
    blockers: [],
    updatedAt: "2026-10-23T08:00:00Z",
    source: "manual",
  };
}

test("kata cuti/sakit/izin/ijin terdeteksi pada teks aktivitas", () => {
  assert.equal(detectAbsence(["Cuti bersama"]),
 "cuti");
  assert.equal(detectAbsence(["sakit gigi"]), "sakit");
  assert.equal(detectAbsence(["izin terlambat"]), "izin");
  assert.equal(detectAbsence(["ijin pulang kampung"]), "izin");
  assert.equal(detectAbsence(["review pull request"]), null);
  assert.equal(detectAbsence([]), null);
});

test("frasa yang mengandung kata tetap terdeteksi, kata biasa tidak", () => {
  assert.equal(detectAbsence(["izin"]), "izin");
  assert.equal(detectAbsence(["minta izin ke HR"]), "izin");
});

test("kata di dalam kata lain tidak salah terdeteksi (word boundary)", () => {
  // "berizinan"? tidak umum; fokus: kata menyatu seperti "bersakit" tidak lazim,
  // tetapi "cuti" di dalam "cuticle" tidak boleh terdeteksi.
  assert.equal(detectAbsence(["memotret cuticle kuku"]), null);
  assert.equal(detectAbsence(["monitoring sakit line 6"]), "sakit");
});

test("entryAbsence membaca keterangan dari semua bagian", () => {
  assert.equal(entryAbsence(entry(["Cuti tahunan"])), "cuti");
  const doneEntry: StandupEntry = { ...entry([]), plans: [], done: [{ id: "d-1", text: "seminar (izin kantor)" }] };
  assert.equal(entryAbsence(doneEntry), "izin");
  const blockerEntry: StandupEntry = { ...entry([]), plans: [], blockers: [{ id: "b-1", text: "sakit demam" }] };
  assert.equal(entryAbsence(blockerEntry), "sakit");
  assert.equal(entryAbsence(entry(["deploy rilis v2"])), null);
});

test("ABSENCE_LABEL menyediakan label tampilan", () => {
  assert.equal(ABSENCE_LABEL.cuti, "Cuti");
  assert.equal(ABSENCE_LABEL.sakit, "Sakit");
  assert.equal(ABSENCE_LABEL.izin, "Izin");
});
