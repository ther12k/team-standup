import { Link } from "@/components/link";

/**
 * Merek di header tampilan fokus (laporan fokus, Live, tautan berbagi).
 * Logo bisa diklik ke beranda — pengunjung tanpa sesi otomatis diarahkan
 * ke halaman masuk oleh gerbang aplikasi.
 */
export function FocusBrand({ subtitle }: { subtitle?: string }) {
  return <div className="flex items-center gap-3">
    <Link href="/" aria-label="Kembali ke beranda Team Standup" className="rounded-lg transition-opacity hover:opacity-75">
      <img src="/assets/teamstandup/brand/logo-horizontal.svg" alt="Team Standup" className="h-9 w-auto" />
    </Link>
    {subtitle && <span className="ml-1 hidden border-l border-line pl-4 text-[11px] text-ink-soft sm:inline">{subtitle}</span>}
  </div>;
}
