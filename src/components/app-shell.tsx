"use client";

import { Link } from "@/components/link";
import { useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  ClipboardList,
  CloudOff,
  FileText,
  Info,
  ListChecks,
  LogOut,
  RotateCcw,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useUser } from "@/components/user-context";
import { Button, Modal, cn, Avatar, useToast } from "@/components/ui";
import { formatLongDate } from "@/lib/date";
import { isEntryEmpty } from "@/lib/tasks";

const NAV = [
  { href: "/", label: "Standup", hint: "Catatan harian", icon: ClipboardList },
  { href: "/tugas", label: "Tugas", hint: "Pelacakan pekerjaan", icon: ListChecks },
  { href: "/laporan", label: "Laporan", hint: "Rekap & ekspor", icon: FileText },
  { href: "/divisi", label: "Divisi Lain", hint: "Laporan referensi", icon: Building2 },
  { href: "/impor", label: "Impor", hint: "Teks WhatsApp", icon: Upload },
  { href: "/pengguna", label: "Pengguna", hint: "Akun & akses", icon: Users },
] as const;

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      {compact ? (
        <img src="/assets/teamstandup/brand/app-icon.svg" alt="Team Standup" className="h-9 w-9" />
      ) : (
        <img src="/assets/teamstandup/brand/logo-horizontal.svg" alt="Team Standup" className="h-9 w-auto" />
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { state, hydrated, today, resetDemo, storageError, dismissStorageError } = useStore();
  const user = useUser();
  const { notify } = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [showDemoNote, setShowDemoNote] = useState(true);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* sesi di server mungkin sudah habis; tetap keluar lokal */ }
    window.location.assign("/login");
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const filledToday = state.entries.filter((entry) => entry.date === today && !isEntryEmpty(entry)).length;
  const memberCount = state.members.length;

  // Focus pages own their layout: no sidebar, mobile header, or bottom navigation.
  if (pathname === "/laporan/lihat" || pathname === "/live") return <>{children}</>;

  return (
    <div className="min-h-screen">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line bg-[#fbfaf6]/95 px-4 py-5 backdrop-blur lg:flex">
        <div className="px-1">
          <Brand />
        </div>

        <nav aria-label="Navigasi utama" className="mt-7 space-y-1">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-white font-semibold text-ink shadow-sm ring-1 ring-line"
                    : "text-ink-soft hover:bg-white/70 hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg border transition-colors",
                    active
                      ? "border-teal-200 bg-brand-soft text-brand-dark"
                      : "border-transparent bg-black/[0.03] text-ink-soft group-hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block leading-tight">{item.label}</span>
                  <span className="block text-[11px] font-normal text-ink-soft/80">{item.hint}</span>
                </span>
                {active ? <span className="h-5 w-1 rounded-full bg-brand" aria-hidden /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 rounded-xl border border-line bg-white p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            <CalendarDays className="h-3.5 w-3.5" /> Standup hari ini
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink">
            {hydrated ? `${filledToday} dari ${memberCount} anggota` : "Memuat…"}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: memberCount ? `${Math.min(100, (filledToday / memberCount) * 100)}%` : "0%" }}
            />
          </div>
          <Link
            href="/"
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-brand-dark hover:underline"
          >
            Lengkapi standup <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-auto space-y-3 pt-5">
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-line px-2.5 py-2 text-[11px] leading-snug text-ink-soft">
            <CloudOff className="h-3.5 w-3.5 shrink-0" />
            <span>
              Data tim tersinkron langsung ke database PostgreSQL server. Ruang Live tersimpan terpisah.
            </span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 ring-1 ring-line">
            <Avatar name={user?.displayName ?? "?"} accent={user?.role === "admin" ? "emerald" : "teal"} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-semibold text-ink">{user?.displayName ?? "—"}</p>
              <p className="truncate text-[11px] text-ink-soft">
                {user?.role === "admin" ? "Koordinator" : user?.role === "member" ? "Anggota" : "—"}
                {user?.division ? ` · ${user.division}` : ""}
              </p>
            </div>
            {user?.role === "admin" ? (
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                title="Muat ulang data contoh"
                aria-label="Muat ulang data contoh"
                className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-slate-100 hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void logout()}
              title="Keluar"
              aria-label="Keluar dari aplikasi"
              className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Header mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-[#fbfaf6]/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <span className="max-w-[38vw] truncate text-xs font-semibold text-ink">{user?.displayName ?? "—"}</span>
          <button
            type="button"
            onClick={() => void logout()}
            title="Keluar"
            aria-label="Keluar dari aplikasi"
            className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="lg:pl-[264px]">
        <main className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          {showDemoNote ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[11px] leading-snug text-amber-900 sm:text-xs">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="flex-1">
                <span className="font-semibold">Workspace tim.</span> Data tersinkron langsung ke database PostgreSQL
                server. Tanggal &amp; waktu memakai zona Asia/Jakarta.
              </p>
              <button
                type="button"
                onClick={() => setShowDemoNote(false)}
                aria-label="Tutup catatan workspace"
                className="rounded p-0.5 text-amber-900/70 hover:bg-amber-100 hover:text-amber-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          {storageError ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-snug text-rose-900 sm:text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="flex-1">{storageError}</p>
              <button
                type="button"
                onClick={dismissStorageError}
                aria-label="Tutup pesan penyimpanan"
                className="rounded p-0.5 text-rose-900/70 hover:bg-rose-100 hover:text-rose-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-md items-stretch">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                    active ? "text-brand-dark" : "text-ink-soft",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-12 place-items-center rounded-full transition-colors",
                      active ? "bg-brand-soft" : "bg-transparent",
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px]", active && "text-brand")} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Muat ulang data contoh?"
        description="Data saat ini akan diganti dengan data contoh bawaan."
        size="sm"
        footer={
          <>
            <Button onClick={() => setResetOpen(false)}>Batal</Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDemo();
                setResetOpen(false);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Muat ulang
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          Gunakan tombol ini untuk kembali ke data contoh bawaan aplikasi. Perubahan yang kamu buat setelah
          impor (catatan manual, tugas baru) akan ditimpa.
        </p>
      </Modal>
    </div>
  );
}
