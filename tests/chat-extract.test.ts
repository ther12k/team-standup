import test from "node:test";
import assert from "node:assert/strict";
import { extractFromChatExport, looksLikeChatExport, parseStandupText, splitChatMessages } from "../src/lib/chat-extract";
import type { Member } from "../src/lib/types";

const MEMBERS: Member[] = [
  { id: "m-bima", name: "Bima Aditya", role: "Teknisi", accent: "teal" },
  { id: "m-sinta", name: "Sinta Rahmawati", role: "Teknisi", accent: "sky" },
  { id: "m-galang", name: "Galang Prasetya", role: "Developer", accent: "violet" },
];

// Cuplikan fiktif bergaya ekspor grup chat (nama, isi, dan nomor semuanya dummy).

const CHAT = [
  "8/28/25, 11:47 AM - Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them. *Learn more*",
  "8/28/25, 11:47 AM - Damar@kantor created group \"Tim Operasional\"",
  "8/28/25, 12:22 PM - Pandu Wibisono: jangan lupa catat progress di sini ya",
  "8/28/25, 2:56 PM - Galang@kantor: iya, tapi datanya masih campur antar tim sih",
  "8/28/25, 2:58 PM - Pandu Wibisono: 💬 [b]Report Daily Stand Up – 28/08/2025[/b]",
  "[b]Kendala, Solusi, dan Tindak Lanjut:[/b]",
  "",
  "Kendala: ",
  "- menunggu laporan insiden jalur 6 dari vendor",
  "- masih ada kasus sesi kadaluarsa saat masuk aplikasi",
  "",
  "Tindak Lanjut: ",
  "- memantau terus transaksi yang kadaluarsa jika ada",
  "",
  "[b]Rencana Kerja Hari Ini:[/b]",
  "",
  "[b]Galang:[/b]",
  "",
  "Memeriksa bug modul notifikasi penjualan",
  "",
  "[b]Mas Bima:[/b]",
  "",
  "rapat vendor parkir, memantau kasus transaksi gagal jalur 6",
  "",
  "[b]Sinta:[/b]",
  "",
  "menyusun dokumentasi rencana pemulihan bencana",
  "8/28/25, 2:58 PM - Pandu Wibisono: nanti kita pisahin per tim pelan-pelan",
  "8/29/25, 11:26 AM - Sinta@kantor: 💬 Report Daily Stand Up – 29/08/2025",
  "Kendala, Solusi, dan Tindak Lanjut:",
  "",
  "Kendala:",
  "",
  "Kunjungan pelanggan sepi, pak Rudi sedang luar kota.",
  "",
  "Rencana Kerja Hari Ini:",
  "",
  "Big Galang:",
  "",
  "memperbaiki bug cetak struk, diskon, dan modul laporan",
  "",
  "Mas Bima:",
  "",
  "memantau kerusakan perangkat demo, minta data ke pak Rudi",
  "",
  "Sinta:",
  "",
  "menyusun dokumentasi rencana pemulihan bencana",
  "8/29/25, 3:06 PM - Pandu Wibisono: nanti bagian laporan mingguan dibagikan di sini ya",
  "9/1/25, 11:15 AM - Pandu Wibisono: @\u2068Sinta@kantor\u2069 ditunggu laporan hariannya ya",
  "9/30/25, 12:26 PM - Sinta@kantor: \u{1F4D1} Report Daily Stand Up",
  "",
  "*Tanggal:* 30/09/2025",
  "",
  "Kendala",
  "",
  "* Tidak ada kendala yang dilaporkan.",
  "",
  "Rencana Kerja Hari Ini",
  "",
  "* *Bg Galang*",
  "  * Proyek aplikasi kasir klien baru dengan RFID, QR, keypad (95%).",
  "",
  "* *Mas Bima*",
  "  * Rapat mingguan manajemen gudang.",
  "  * Penjadwal backup otomatis server.",
  "",
  "* *Sinta*",
  "  * Monitoring portal pelanggan dan mitra.",
  "9/30/25, 1:36 PM - Galang@kantor: Sudah bang",
  "10/21/26, 10:23 AM - Bima@Kantor: This message was deleted",
  "10/21/26, 10:43 AM - +62 812-3456-7890: <Media omitted>",
  "10/21/26, 11:04 AM - Bima@Kantor: 💬 Report Daily Stand Up – 21/10/2026",
  "",
  "\u{1F5D3}\uFE0F Rencana Kerja Hari Ini",
  "",
  "\u{1F468}\u200D\u{1F4BB}Bang Galang",
  "* perbarui konten portal",
  "",
  "\u{1F468}\u200D\u{1F4BB}Bang Bima",
  "* pantau antrean tiket",
  "* rapat masalah teknis aliran data integrasi pembayaran",
  "",
  "\u{1F468}\u200D\u{1F4BB}Bang Sinta",
  "* monitoring portal",
].join("\n");

test("pesan chat terpisah dengan benar: pengirim, baris lanjutan, pesan sistem", () => {
  const messages = splitChatMessages(CHAT);
  assert.equal(messages.length, 14);
  assert.equal(messages[0].system, true);
  assert.equal(messages[1].system, true);
  assert.equal(messages[2].sender, "Pandu Wibisono");
  assert.equal(messages[2].system, false);
  // Pesan laporan multi-baris: baris tanpa stempel waktu tetap satu pesan.
  const report = messages[4];
  assert.equal(report.sender, "Pandu Wibisono");
  assert.match(report.text, /Kendala, Solusi/);
  assert.match(report.text, /menyusun dokumentasi rencana pemulihan bencana/);
  // Pesan terhapus dan media ditandai sistem sehingga tidak dipertimbangkan sebagai laporan.
  assert.equal(messages[11].system, true);
  assert.equal(messages[12].system, true);
});

test("ekspor chat dikenali dan obrolan santai tidak dijadikan laporan", () => {
  assert.equal(looksLikeChatExport(CHAT), true);
  assert.equal(looksLikeChatExport("💬 Report Daily Stand Up – 13/10/2026\n👷 Bima\n• a"), false);
  const result = extractFromChatExport(CHAT, MEMBERS);
  // "ditunggu laporan hariannya ya" adalah obrolan, bukan laporan — harus terabaikan.
  assert.equal(result.chat?.messageCount, 14);
  assert.equal(result.reports.length, 4);
  assert.ok(result.reports.every((report) => report.reportDate));
  assert.deepEqual(
    result.reports.map((report) => report.reportDate),
    ["2025-08-28", "2025-08-29", "2025-09-30", "2026-10-21"],
  );
});

test("laporan format [b] BBCode: bagian, anggota, aktivitas teks bebas, tindak lanjut", () => {
  const { reports } = extractFromChatExport(CHAT, MEMBERS);
  const first = reports[0];
  const byMember = (name: string) => first.members.find((m) => m.sourceName.includes(name));

  const bima = byMember("Bima");
  assert.ok(bima);
  assert.equal(bima.matchedMemberId, "m-bima");
  assert.equal(bima.activities.length, 1);
  assert.equal(bima.activities[0].kind, "plan");
  assert.equal(bima.activities[0].text, "rapat vendor parkir, memantau kasus transaksi gagal jalur 6");

  const galang = byMember("Galang");
  assert.ok(galang);
  assert.equal(galang.matchedMemberId, "m-galang");
  assert.equal(galang.activities[0].text, "Memeriksa bug modul notifikasi penjualan");

  // Kendala tanpa nama anggota jatuh ke anggota terakhir sebelumnya — perilaku parser; yang penting ikut terbaca.
  const blockerTexts = first.members.flatMap((m) => m.activities.filter((a) => a.kind === "blocker").map((a) => a.text));
  assert.ok(blockerTexts.some((text) => /jalur 6/.test(text)));
  assert.ok(blockerTexts.some((text) => /kadaluarsa/.test(text)));
  // Tindak lanjut direkam sebagai rencana, bukan kendala.
  const planTexts = first.members.flatMap((m) => m.activities.filter((a) => a.kind === "plan").map((a) => a.text));
  assert.ok(planTexts.some((text) => /memantau terus transaksi/.test(text)));
  // Teks asli pesan (dengan stempel waktu dan pengirim) tersimpan sebagai sumber.
  assert.match(first.originalText, /^8\/28\/25, 2:58 PM - Pandu Wibisono:/);
});

test("laporan markdown bersarang (* *Nama* + bullet *) dan tanggal di isi", () => {
  const { reports } = extractFromChatExport(CHAT, MEMBERS);
  const third = reports[2];
  assert.equal(third.reportDate, "2025-09-30"); // dari "*Tanggal:* 30/09/2025"
  // Baris "*Tanggal:*" tidak menjadi aktivitas.
  assert.ok(!third.members.some((m) => m.activities.some((a) => /tanggal/i.test(a.text))));
  const bima = third.members.find((m) => /Bima/.test(m.sourceName));
  assert.ok(bima);
  assert.deepEqual(
    bima?.activities.map((a) => a.text),
    ["Rapat mingguan manajemen gudang.", "Penjadwal backup otomatis server."],
  );
  const galang = third.members.find((m) => /Galang/.test(m.sourceName));
  assert.equal(galang?.activities[0].text, "Proyek aplikasi kasir klien baru dengan RFID, QR, keypad (95%).");
});

test("laporan 👨‍💻Bang + bullet *: anggota dan aktivitas terbaca", () => {
  const { reports } = extractFromChatExport(CHAT, MEMBERS);
  const latest = reports[3];
  assert.equal(latest.reportDate, "2026-10-21");
  const bima = latest.members.find((m) => /Bima/.test(m.sourceName));
  assert.ok(bima);
  assert.equal(bima?.matchedMemberId, "m-bima");
  assert.equal(bima?.activities.length, 2);
  assert.equal(bima?.activities[0].text, "pantau antrean tiket");
  assert.equal(bima?.activities[0].kind, "plan");
  // "Bang Galang" cocok dengan anggota "Galang Prasetya" lewat nama depan setelah sapaan dibuang.
  assert.equal(latest.members.find((m) => /Galang/.test(m.sourceName))?.matchedMemberId, "m-galang");
});

test("parseStandupText meneruskan laporan tempelan langsung tanpa lewat ekstraksi chat", () => {
  const pasted = ["💬 Report Daily Stand Up – 13/10/2026", "👷 Sinta Rahmawati", "• pantau antrean tiket"].join("\n");
  const result = parseStandupText(pasted, MEMBERS);
  assert.equal(result.chat, undefined);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].reportDate, "2026-10-13");
});

test("judul lawas dikoreksi ke tanggal waktu kirim pesan", () => {
  // Judul menyisakan 20/10 padahal pesan dikirim 22/10 (templat lama tak diganti).
  const stale = [
    "10/21/26, 10:00 AM - Bima@Kantor: halo semua",
    "10/22/26, 10:58 AM - Bima@Kantor: 💬 Report Daily Stand Up – 20/10/2026",
    "",
    "\u{1F5D3}\uFE0F Rencana Kerja Hari Ini",
    "",
    "\u{1F468}\u200D\u{1F4BB}Bang Sinta",
    "* monitoring portal",
  ].join("\n");
  const { reports, chat } = extractFromChatExport(stale, MEMBERS);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].reportDate, "2026-10-22");
  assert.match(reports[0].originalText, /^10\/22\/26, 10:58 AM - Bima@Kantor:/);
  assert.ok(reports[0].flags.some((flag) => /dikirim 22 Okt 2026/.test(flag.message) && /diatur ke 22 Okt 2026/.test(flag.message)));
  assert.equal(chat?.dateCorrected, 1);
});

test("kirim terlambat satu hari: tanggal judul dipertahankan tapi ditandai", () => {
  const latePost = [
    "10/15/25, 11:21 AM - Sinta@kantor: 💬 Report Daily Stand Up – 14/10/2025",
    "",
    "Rencana Kerja Hari Ini:",
    "",
    "Sinta:",
    "",
    "menyusun dokumentasi rencana pemulihan bencana",
  ].join("\n");
  const { reports, chat } = extractFromChatExport(latePost, MEMBERS);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].reportDate, "2025-10-14");
  assert.ok(reports[0].flags.some((flag) => /dikirim terlambat/i.test(flag.message)));
  assert.equal(chat?.dateLatePost, 1);
  assert.equal(chat?.dateCorrected, 0);
});

test("format ekspor internasional (hari dulu) terbaca dari sampel tak ambigu", () => {
  const intl = [
    "23/10/26, 09:00 - Bima: pagi",
    "23/10/26, 10:00 - Bima: 💬 Report Daily Stand Up – 23/10/2026",
    "Rencana Kerja Hari Ini",
    "\u{1F468}\u200D\u{1F4BB}Bang Sinta",
    "* monitoring portal",
  ].join("\n");
  const { reports } = extractFromChatExport(intl, MEMBERS);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].reportDate, "2026-10-23"); // 23 tak mungkin bulan → hari dulu
});

test("stempel waktu ambigu (semua komponen ≤ 12) tidak memicu koreksi tanggal", () => {
  // Ekspor hari-dulu "1/2/26" (1 Feb) dengan judul "01/02/2026" — tanpa sampel
  // pembeda, koreksi ke bulan pertama AS akan MEMINDAHKAN laporan ke 2 Jan.
  const ambiguous = [
    "1/2/26, 09:00 - Bima: Report Daily Stand Up – 01/02/2026",
    "Rencana Kerja Hari Ini",
    "\u{1F468}\u200D\u{1F4BB}Bang Sinta",
    "* monitoring portal",
  ].join("\n");
  const { reports, chat } = extractFromChatExport(ambiguous, MEMBERS);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].reportDate, "2026-02-01"); // tanggal judul dipertahankan
  assert.equal(chat?.dateCorrected, 0);
});

test("teks asli laporan adalah pesan mentah, termasuk tag [b] dan tebal", () => {
  const source = "10/22/26, 10:58 AM - Bima@Kantor: 💬 [b]Report Daily Stand Up – 20/10/2026[/b]\n[b]Rencana Kerja Hari Ini:[/b]\n\n[b]Bima:[/b]\n\n• cek kesiapan server pelanggan\n";
  const { reports } = extractFromChatExport(source, MEMBERS);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].reportDate, "2026-10-22"); // judul lawas dikoreksi ke waktu kirim
  assert.ok(reports[0].originalText.startsWith("10/22/26, 10:58 AM - Bima@Kantor:"));
  assert.ok(reports[0].originalText.includes("[b]Bima:[/b]"));
  assert.ok(reports[0].originalText.includes("• cek kesiapan server pelanggan"));
});

test("waktu pesan sumber menjadi sourceAt laporan (12 jam AM/PM)", () => {
  const source = [
    "10/22/26, 10:58 AM - Bima@Kantor: 💬 Report Daily Stand Up – 22/10/2026",
    "\u{1F5D3}\uFE0F Rencana Kerja Hari Ini",
    "\u{1F468}\u200D\u{1F4BB}Bang Sinta",
    "* monitoring portal",
  ].join("\n");
  const { reports } = extractFromChatExport(source, MEMBERS);
  assert.equal(reports[0].sourceAt, "2026-10-22T10:58:00+07:00");

  const evening = source.replace("10:58 AM", "2:05 PM");
  const pm = extractFromChatExport(evening, MEMBERS);
  assert.equal(pm.reports[0].sourceAt, "2026-10-22T14:05:00+07:00");
});
