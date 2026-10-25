# Team Standup

<p align="center">
  <img src="docs/assets/teamstandup/brand/logo-horizontal.svg" alt="Team Standup" width="300">
</p>

Aplikasi web internal untuk standup harian tim — menggantikan laporan manual di grup chat. Catatan **Rencana / Pekerjaan Sebelumnya / Kendala** per anggota, pelacakan tugas, impor laporan lampau dari teks chat, rekap siap salin/ekspor, sesi **Standup Live**, laporan referensi divisi lain, dan **tautan berbagi ber-kunci** untuk pembaca tanpa akun. Antarmuka berbahasa Indonesia, zona waktu **Asia/Jakarta**.

**Laman**: [ther12k.github.io/team-standup](https://ther12k.github.io/team-standup)

Dibangun dengan **Vite + React 19 + Tailwind v4 + React Router** di frontend, dan **Elysia 2 di atas Bun** di backend dengan PostgreSQL (Drizzle ORM). Ringan, mulai dalam hitungan milidetik, tanpa overhead SSR yang rumit.

> Repo ini memakai **data contoh (dummy)** — nama anggota, isi laporan, dan laporan divisi semuanya fiktif. Hubungkan ke PostgreSQL kosong dan aplikasi mengisi dirinya sendiri dengan data contoh ini.

![Cuplikan laporan](docs/screenshot-laporan.png)

## Fitur

- **Standup harian** — rencana/selesai/kendala per anggota dengan proyek opsional; sadar akhir pekan & hari libur nasional Indonesia (SKB resmi, bisa disunting tim); catatan cuti/sakit/izin otomatis ditandai (lencana oranye) dan dikecualikan dari hitungan partisipasi.
- **Tugas** — papan & daftar tugas dengan status, penanggung jawab, tenggat, riwayat status.
- **Impor chat** — tempel ekspor chat grup (format laporan `👷 Nama` + bagian), tanggal dibandingkan dengan stempel waktu pesan; anggota baru otomatis dikenali.
- **Laporan** — tampilan harian/mingguan (kartu tanggal atau kartu mingguan), daftar per tim atau kisi per anggota, pencarian, ekspor CSV, salin ringkasan format WhatsApp, dan **Bagikan**: tautan ber-kunci (`/bagikan/<id-8-karakter>?k=<kunci-6-karakter>`) untuk orang luar tanpa akun — pembaca hanya melihat rentang yang dibagikan plus navigasi mundur terbatas (10 hari pada tautan harian, 1 minggu sebelumnya pada mingguan), kedaluwarsa 180 hari.
- **Standup Live** — sesi obrolan terpandu koordinator: pilih pesan → aktivitas → terbitkan laporan yang langsung masuk riwayat standup; tautan baca-saja untuk arsip.
- **Divisi lain** — laporan harian divisi lain sebagai referensi (ekstraktor arsip chat disertakan, `src/lib/division-extract.ts`).
- **Login & pengguna** — akun internal (cookie sesi httpOnly, sandi scrypt), peran koordinator/anggota, divisi per akun, manajemen pengguna oleh koordinator. Tautan berbagi & laporan Live terlindungi kunci acak.

## Menjalankan

Butuh **Bun 1.2+** dan **PostgreSQL 14+**.

```bash
bun install
cp .env.example .env.local        # atau buat manual, lihat di bawah
bun run dev                       # Vite client dev server (port 3002)
bun run dev:server                # Elysia 2 backend dev server (port 3003)
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

Produksi: `bun run build && bun run start`, atau lewat Docker:

```bash
docker build -t team-standup .
docker run -d --name standup-app -p 3000:3000 \
  -e DATABASE_URL=postgres://standup:rahasia@standup-db:5432/hi_standup \
  team-standup
```

Container Docker menyajikan API Elysia 2 dan file statis frontend hasil build Vite dalam satu proses mandiri yang ringan (< 90 MB).

## Verifikasi

```bash
bun test          # pengujian unit (73 tes lewat)
bun run typecheck
bun run lint
```

## Struktur singkat

- `src/client/` — frontend SPA (React Router, AppShell, AppLayout, globals.css).
- `src/app/` — komponen halaman (standup, tugas, laporan, divisi, impor, pengguna, live, login, bagikan).
- `src/server/` — backend Elysia 2 (routes: auth, workspace, users, shares, live, health).
- `src/lib/` — parser impor chat/arsip divisi, logika hari kerja & libur Indonesia, scrypt, sesi.
- `src/db/` — skema Drizzle PostgreSQL.
- `public/` — set favicon (SVG/PNG/ICO), `site.webmanifest` (PWA + ikon maskable), dan aset merek di `assets/teamstandup/` (13 varian logo vektor, 40 ikon UI + sprite).

## Lisensi

MIT — lihat [LICENSE](LICENSE).
