import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HOLIDAYS, isDateSelectable, isNonWorkingDay, latestWorkingDayOnOrBefore, nextWorkingDay, nonWorkingReason, prevWorkingDay } from "../src/lib/workdays";

test("akhir pekan Sabtu–Minggu dikenali sebagai bukan hari kerja", () => {
  assert.equal(isNonWorkingDay("2026-10-24", DEFAULT_HOLIDAYS), true); // Sabtu
  assert.equal(isNonWorkingDay("2026-10-25", DEFAULT_HOLIDAYS), true); // Minggu
  assert.equal(isNonWorkingDay("2026-10-23", DEFAULT_HOLIDAYS), false); // Jumat
  assert.equal(nonWorkingReason(DEFAULT_HOLIDAYS, "2026-10-24"), "akhir pekan");
});

test("hari libur nasional dikenali dengan alasannya", () => {
  assert.equal(isNonWorkingDay("2026-03-20", DEFAULT_HOLIDAYS), true); // cuti bersama Idul Fitri, Jumat
  assert.equal(nonWorkingReason(DEFAULT_HOLIDAYS, "2026-03-20"), "libur (Cuti bersama Idul Fitri 1447 H)");
  assert.equal(nonWorkingReason(DEFAULT_HOLIDAYS, "2026-03-19"), "libur (Hari Suci Nyepi)"); // Kamis, hari libur nasional
  assert.equal(isNonWorkingDay("2026-08-17", DEFAULT_HOLIDAYS), true); // Kemerdekaan, Senin
});

test("tanggal dengan data tetap terbuka meski bukan hari kerja", () => {
  assert.equal(isDateSelectable("2026-02-01", DEFAULT_HOLIDAYS, true), true); // Minggu dengan catatan lama
  assert.equal(isDateSelectable("2026-02-01", DEFAULT_HOLIDAYS, false), false);
  assert.equal(isDateSelectable("2026-10-23", DEFAULT_HOLIDAYS, false), true);
});

test("navigasi melewati akhir pekan dan rangkaian libur", () => {
  assert.equal(nextWorkingDay("2026-10-23", DEFAULT_HOLIDAYS), "2026-10-26"); // Jumat → Senin (lewati Sabtu-Minggu)
  assert.equal(prevWorkingDay("2026-10-26", DEFAULT_HOLIDAYS), "2026-10-23"); // Senin → Jumat
  // Rangkaian Maret 2026 sesuai SKB: cuti 18, Nyepi 19, cuti 20, Idul Fitri 21-22 (akhir pekan),
  // cuti 23-24 → hari kerja berikutnya setelah Selasa 17 adalah Rabu 25.
  assert.equal(nextWorkingDay("2026-03-17", DEFAULT_HOLIDAYS), "2026-03-25");
  assert.equal(prevWorkingDay("2026-03-25", DEFAULT_HOLIDAYS), "2026-03-17");
});

test("hari ini yang bukan hari kerja jatuh ke hari kerja terakhir sebelumnya", () => {
  assert.equal(latestWorkingDayOnOrBefore("2026-10-24", DEFAULT_HOLIDAYS), "2026-10-23"); // Sabtu → Jumat
  assert.equal(latestWorkingDayOnOrBefore("2026-10-23", DEFAULT_HOLIDAYS), "2026-10-23");
  // Rangkaian Idul Fitri 2026 (18–24 Mar libur) → jatuh ke Selasa 17 Mar.
  assert.equal(latestWorkingDayOnOrBefore("2026-03-20", DEFAULT_HOLIDAYS), "2026-03-17");
  assert.equal(latestWorkingDayOnOrBefore("2026-03-24", DEFAULT_HOLIDAYS), "2026-03-17");
});

test("daftar libur kustom tim dihormati", () => {
  const custom = [{ date: "2026-10-22", label: "Cuti bersama tim" }];
  assert.equal(isNonWorkingDay("2026-10-22", custom), true);
  assert.equal(nonWorkingReason(custom, "2026-10-22"), "libur (Cuti bersama tim)");
});

test("libur tanpa nama tetap memblokir tanggal (label opsional)", () => {
  const custom = [{ date: "2026-10-22" }];
  assert.equal(isNonWorkingDay("2026-10-22", custom), true);
  assert.equal(nonWorkingReason(custom, "2026-10-22"), "libur");
  assert.equal(isDateSelectable("2026-10-22", custom, false), false);
});
