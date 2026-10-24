# Team Standup

Aplikasi web internal untuk standup harian tim — menggantikan laporan manual di grup chat. Catatan **Rencana / Selesai / Kendala** per anggota, pelacakan tugas, impor laporan lampau dari teks chat, rekap siap salin/ekspor, sesi **Standup Live**, laporan referensi divisi lain, dan **tautan berbagi ber-kunci** untuk pembaca tanpa akun. Antarmuka berbahasa Indonesia, zona waktu **Asia/Jakarta**.

> Repo ini memakai **data contoh (dummy)** — nama anggota, isi laporan, dan laporan divisi semuanya fiktif. Hubungkan ke PostgreSQL kosong dan aplikasi mengisi dirinya sendiri dengan data contoh ini.

![Cuplikan laporan](docs/screenshot-laporan.png)

## Fitur

- **Standup harian** — rencana/selesai/kendala per anggota dengan proyek opsional; sadar akhir pekan & hari libur nasional Indonesia (SKB resmi, bisa disunting tim).
- **Tugas** — papan & daftar tugas dengan status, penanggung jawab, tenggat, riwayat status.
- **Impor chat** — tempel ekspor chat grup (format laporan `👷 Nama` + bagian), tanggal dibandingkan dengan stempel waktu pesan; anggota baru otomatis dikenali.
- **Laporan** — tampilan harian/mingguan, daftar per tim atau kisi per anggota, pencarian, ekspor CSV, salin ringkasan format WhatsApp, dan **Bagikan**: tautan ber-kunci (`/bagikan/…?k=…`) untuk orang luar tanpa akun — hanya rentang yang dibagikan yang terlihat, kedaluwarsa 180 hari.
- **Standup Live** — sesi obrolan terpandu koordinator: pilih pesan → aktivitas → terbitkan laporan yang langsung masuk riwayat standup; tautan baca-saja untuk arsip.
- **Divisi lain** — laporan harian divisi lain sebagai referensi (ekstraktor arsip chat disertakan, `src/lib/division-extract.ts`).
- **Login & pengguna** — akun internal (cookie sesi httpOnly, sandi scrypt), peran koordinator/anggota, divisi per akun, manajemen pengguna oleh koordinator. Tautan berbagi & laporan Live terlindungi kunci acak.

## Menjalankan

Butuh Node.js 20+ dan PostgreSQL 14+.

```bash
npm install
cp .env.example .env.local        # atau buat manual, lihat di bawah
npm run dev                       # http://localhost:3000
```

Isi `.env.local`:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/team_standup
# opsional
STANDUP_ADMIN_USERNAME=admin      # akun koordinator pertama (default: admin)
STANDUP_ADMIN_PASSWORD=ganti-aya  # tanpa ini: sandi awal "standup123" dan
                                  # admin wajib menggantinya sebelum aksi admin
WORKSPACE_ACCESS_TOKEN=...        # opsional: akses API skrip via Bearer
```

Database dan tabel dibuat otomatis saat pertama kali dijalankan. Pada kunjungan pertama, workspace diisi **data contoh** (8 anggota, ±8 minggu riwayat, laporan 4 divisi). Cek kesehatan lewat `/api/health`.

**Akun demo pertama kali**: `admin` / `standup123` (koordinator; diminta mengganti sandi saat masuk — aksi admin terkunci sampai diganti).

Produksi: `npm run build && npm start`.

## Verifikasi

```bash
npm test          # pengujian unit (tsx --test)
npm run typecheck
npm run lint
```

## Struktur singkat

- `src/app/(app)/` — halaman dalam gerbang login (standup, tugas, laporan, divisi, impor, pengguna, live).
- `src/app/login`, `src/app/bagikan/[id]` — publik (masuk & tautan berbagi ber-kunci).
- `src/app/api/` — workspace (sinkron revisi), auth, users, live rooms, shares.
- `src/lib/` — parser impor chat/arsip divisi, logika hari kerja & libur Indonesia, scrypt, sesi.
- `src/db/` — skema Drizzle (workspace, live rooms, users, sessions, shares).

## Lisensi

MIT — lihat [LICENSE](LICENSE).
