import test from "node:test";
import assert from "node:assert/strict";
import { extractDivisionReports } from "../src/lib/division-extract";

// Arsip contoh dengan format ekspor per gelembung pesan (nama & isi fiktif).
const ARCHIVE = [
  "============================================================",
  "[1]",
  "Bagas Wicaksana",
  "RnD 20261005",
  "Kendala: tidak ada",
  "",
  "Rencana:",
  "1. Uji coba model deteksi objek ( Rani )",
  "9:18",
  "============================================================",
  "[2]",
  "Bagas Wicaksana",
  "RnD 20261005",
  "Kendala: tidak ada",
  "",
  "Rencana:",
  "1. Uji coba model deteksi objek ( Rani ) — kutipan/pos ulang",
  "edited",
  "10:20",
  "============================================================",
  "[3]",
  "Dewi Anggraini",
  "Daily Standup Team PM Project 14 September2026",
  "",
  "Kendala: tidak ada",
  "",
  "Rencana Hari ini;",
  "Tono Prasetyo:",
  "- Melengkapi data analisa perbandingan transaksi",
  "12:58",
  "============================================================",
  "[4]",
  "Farhan Lubis",
  "Report Daily Stand Up Tanggal 23/10/2026",
  "Kendala : Tidak ada",
  "Rencana kerja hari ini :",
  "- Nadia: penyaringan umpan balik pengguna",
  "- Rio: perbaikan formulir pendaftaran",
  "11:21",
  "============================================================",
  "[5]",
  "Yusuf Maulana",
  "📋 Daily Report Stand Up – 05/10/2026",
  "👨‍💻 Raka:",
  "- Menyusun laporan mingguan",
  "08:45",
  "============================================================",
  "[6]",
  "Yusuf Maulana",
  "Rakor singkat tim — besok rilis versi 2.1, jangan lupa update tiket.",
  "13:02",
  "============================================================",
  "[7]",
  "Hendra Saputra",
  "REPORT DAILY STANDUP MAINTENANCE DEPT",
  "Tanggal 22 JULI 2026",
  "Kendala : Tidak ada",
  "Rencana :",
  "1. Pemeliharaan rutin server kantor",
  "2. Penggantian UPS ruang server",
  "07:45",
  "============================================================",
  "[8]",
  "Bagas Wicaksana",
  "Tim RnD besok ada sharing session internal, jangan lupa siapkan bahan.",
  "16:40",
].join("\n");

test("empat divisi dikenali dari judulnya dengan tanggal yang benar", () => {
  const byDivision = new Map(extractDivisionReports(ARCHIVE).map(r => [r.division, r]));
  assert.equal(byDivision.get("RnD")?.date, "2026-10-05");
  assert.equal(byDivision.get("PM Project")?.date, "2026-09-14");
  assert.equal(byDivision.get("Product")?.date, "2026-10-23");
  assert.equal(byDivision.get("Maintenance")?.date, "2026-07-22");
});

test("laporan tim sendiri dan obrolan santai dibuang", () => {
  const reports = extractDivisionReports(ARCHIVE);
  assert.equal(reports.some(r => r.text.includes("Menyusun laporan mingguan")), false);
  assert.equal(reports.some(r => r.text.includes("Rakor")), false);
  assert.equal(reports.some(r => r.division.startsWith("__")), false);
});

test("duplikat per divisi per hari digabung — kandidat dengan judul di baris pertama menang", () => {
  const reports = extractDivisionReports(ARCHIVE);
  const rnd = reports.filter(r => r.division === "RnD");
  assert.equal(rnd.length, 1);
  assert.equal(rnd[0].text.includes("Uji coba model deteksi objek"), true);
});

test("jam dan penulis asli disimpan pada laporan", () => {
  const reports = extractDivisionReports(ARCHIVE);
  const rnd = reports.find(r => r.division === "RnD");
  assert.equal(rnd?.time, "09:18");
  assert.equal(rnd?.author, "Bagas Wicaksana");
});

test("pesan tanpa judul laporan dibuang", () => {
  const reports = extractDivisionReports(ARCHIVE);
  assert.equal(reports.some(r => r.text.includes("sharing session internal")), false);
});
