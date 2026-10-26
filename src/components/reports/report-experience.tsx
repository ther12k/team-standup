/* eslint-disable react-hooks/set-state-in-effect -- tanggal awal dari URL/props dipulihkan sekali setelah hidrasi. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, CheckCheck, CircleCheck, ClipboardList, Download, FileText, LayoutGrid, List, MapPin, Share2 } from "lucide-react";
import { useStoreOptional } from "@/lib/store";
import { WeekTickets } from "@/components/reports/week-tickets";
import { DivisionChip, DivisionReportModal, latestPerDivisionInRange } from "@/components/divisions/report-modal";
import { Avatar, Button, CopyButton, EmptyState, Modal, PageLoading, StatusBadge, cn } from "@/components/ui";
import { buildReport, reportToCsv, type ReportGroup, type ReportGroupBy, type ReportLine } from "@/lib/report";
import { ABSENCE_LABEL, entryAbsence } from "@/lib/absence";
import { endOfWeek, formatClock, formatMediumDate, formatShortDate, isValidISODate, startOfWeek } from "@/lib/date";
import { latestWorkingDayOnOrBefore } from "@/lib/workdays";
import { formatReportForWhatsApp } from "@/lib/whatsapp";
import type { AppState, DivisionReport } from "@/lib/types";

const sections = [
  { key: "plan", label: "Rencana", icon: ClipboardList, tone: "text-sky-700", bg: "bg-sky-50" },
  { key: "done", label: "Pekerjaan Sebelumnya", icon: CircleCheck, tone: "text-brand", bg: "bg-emerald-50" },
  { key: "blocker", label: "Kendala", icon: AlertCircle, tone: "text-amber-700", bg: "bg-amber-50" },
] as const;

export function ActivitySections({ lines, groupBy, snapshot, showDate }: { lines: ReportLine[]; groupBy: ReportGroupBy; snapshot?: boolean; showDate?: boolean }) {
  return <div className="space-y-2">
    {sections.map(section => {
      const rows = lines.filter(l => l.kind === section.key);
      if (!rows.length) return null;
      const Icon = section.icon;
      return <section key={section.key}>
        <h4 className={cn("mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold", section.tone)}><span className={cn("grid size-5 place-items-center rounded-md", section.bg)}><Icon size={11} /></span>{section.label}<span className="font-normal opacity-60">{rows.length}</span></h4>
        <ul className={cn("space-y-1", section.key === "blocker" && "rounded-lg bg-[#fffbf0] p-2")}>
          {rows.map((line, i) => <li key={`${line.entryId}-${i}`} className="flex gap-2">
            {section.key === "done" ? <Check size={12} className="mt-[3px] shrink-0 text-brand" /> : <span className={cn("mt-[6px] size-1 shrink-0 rounded-full", section.key === "blocker" ? "bg-amber-500" : "bg-slate-400")} />}
            <div className="min-w-0 flex-1"><p className="text-[12.5px] leading-[1.5] text-[#39483e]">{groupBy === "project" && <span className="font-semibold">{line.memberName}: </span>}{line.text}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {showDate && <span className="rounded bg-slate-100 px-1 py-0 text-[9.5px] font-medium text-slate-600">{formatShortDate(line.date)}</span>}
                {line.taskStatus && <span className="inline-flex items-center gap-1 text-[9px] text-ink-soft/70">{snapshot ? "Status tugas pada snapshot" : "Status tugas saat ini"}<StatusBadge status={line.taskStatus} size="xs" /></span>}
              </div>
            </div>
          </li>)}
        </ul>
      </section>;
    })}
  </div>;
}

export function ReportCard({ group, data, groupBy, snapshot, showDate }: { group: ReportGroup; data: AppState; groupBy: ReportGroupBy; snapshot?: boolean; showDate?: boolean }) {
  const member = data.members.find(m => m.id === group.key);
  const dates = data.entries.filter(e => group.lines.some(l => l.entryId === e.id)).map(e => e.updatedAt).sort();
  const hasLive = data.entries.some(e => group.lines.some(l => l.entryId === e.id) && e.source === "live");
  const absenceKind = (() => {
    for (const e of data.entries) {
      if (group.lines.some(l => l.entryId === e.id)) {
        const kind = entryAbsence(e);
        if (kind) return kind;
      }
    }
    return null;
  })();
  return <article className="rounded-2xl border border-[#e4e9e1] bg-white p-4 shadow-[0_2px_4px_#19372a03] sm:p-5">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {groupBy === "member" ? <Avatar name={group.title} accent={member?.accent ?? "teal"} /> : <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><MapPin size={19} /></span>}
        <div className="min-w-0"><h3 className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-ink">{group.title}{groupBy === "member" && member?.active === false && <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Non-aktif</span>}{absenceKind && <span className="rounded border border-orange-300 bg-orange-50 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-orange-700">{ABSENCE_LABEL[absenceKind]}</span>}</h3><p className="mt-0.5 text-[11px] text-ink-soft">{group.subtitle || `${new Set(group.lines.map(l => l.memberId)).size} anggota`}</p></div>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-[10px] text-ink-soft/70"><CheckCheck size={13} /> {hasLive ? "Dari Live" : `${formatClock(dates.at(-1))} WIB`}</span>
    </div>
    <ActivitySections lines={group.lines} groupBy={groupBy} snapshot={snapshot} showDate={showDate} />
  </article>;
}

/** Kartu tim untuk tampilan daftar: satu kartu per tim (peran), anggota bertumpuk di dalamnya. */
export function TeamCard({ title, memberCards, data, snapshot, showDate }: {
  title: string;
  memberCards: { group: ReportGroup; member?: AppState["members"][number] }[];
  data: AppState;
  snapshot?: boolean;
  showDate?: boolean;
}) {
  const totals = memberCards.reduce(
    (acc, { group }) => ({
      plan: acc.plan + group.lines.filter(l => l.kind === "plan").length,
      done: acc.done + group.lines.filter(l => l.kind === "done").length,
      blocker: acc.blocker + group.lines.filter(l => l.kind === "blocker").length,
    }),
    { plan: 0, done: 0, blocker: 0 },
  );
  return <article className="rounded-2xl border border-[#e4e9e1] bg-white p-4 shadow-[0_2px_4px_#19372a03]">
    <div className="flex items-center justify-between gap-2 border-b border-line/70 pb-2">
      <h3 className="truncate text-[13px] font-semibold text-ink">{title}</h3>
      <span className="shrink-0 text-[10px] text-ink-soft">{memberCards.length} anggota · {totals.plan}R {totals.done}S {totals.blocker}K</span>
    </div>
    <div className="divide-y divide-line/60">
      {memberCards.map(({ group, member }) => {
        const lastUpdated = data.entries
          .filter(e => group.lines.some(l => l.entryId === e.id))
          .map(e => e.updatedAt)
          .sort()
          .at(-1);
        const absenceKind = (() => {
          for (const e of data.entries) {
            if (group.lines.some(l => l.entryId === e.id)) {
              const kind = entryAbsence(e);
              if (kind) return kind;
            }
          }
          return null;
        })();
        return (
          <div key={group.key} className="py-2.5 first:pt-2 last:pb-0">
            <div className="mb-1 flex items-center gap-2">
              <Avatar name={group.title} accent={member?.accent ?? "teal"} size="xs" />
              <p className="truncate text-[12px] font-semibold text-ink">{group.title}</p>
              {member?.active === false && <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Non-aktif</span>}
              {absenceKind && <span className="rounded border border-orange-300 bg-orange-50 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-orange-700">{ABSENCE_LABEL[absenceKind]}</span>}
              <span className="ml-auto shrink-0 text-[9.5px] text-ink-soft/70">{formatClock(lastUpdated)} WIB</span>
            </div>
            <ActivitySections lines={group.lines} groupBy="member" snapshot={snapshot} showDate={showDate} />
          </div>
        );
      })}
    </div>
  </article>;
}

/**
 * Pengalaman laporan yang sama untuk menu Laporan (/laporan), tampilan fokus
 * (/laporan/lihat), dan pembaca tautan berbagi (/bagikan): bar tanggal, alat
 * ringkas, chip divisi lain, daftar/kisi. `data` bisa berupa state workspace
 * (mode biasa), snapshot laporan Live, atau state tersaring tautan berbagi.
 */
export function ReportExperience({
  data,
  today,
  snapshot = false,
  initialDate,
  initialMode,
  loading = false,
  readOnly = false,
  bounds,
}: {
  data: AppState | null;
  today: string;
  snapshot?: boolean;
  /** Tanggal awal (dari ?date= atau tanggal laporan Live); pilihan pengguna menang. */
  initialDate?: string | null;
  /** Mode awal harian/mingguan (tautan berbagi menyimpan mode pembuatnya). */
  initialMode?: "harian" | "mingguan";
  loading?: boolean;
  /** Mode baca-saja (tautan berbagi): tanpa tombol Bagikan. */
  readOnly?: boolean;
  /** Batas navigasi tanggal (jendela tautan berbagi). */
  bounds?: { min: string; max: string };
}) {
  // Di luar StoreProvider (halaman berbagi publik) libur diambil dari `data`;
  // di dalam aplikasi state workspace tetap sumbernya.
  const store = useStoreOptional();
  const holidays = data?.holidays ?? store?.state.holidays ?? [];
  const [date, setDate] = useState("");
  const [groupBy, setGroupBy] = useState<ReportGroupBy>("member");
  const [mode, setMode] = useState<"harian" | "mingguan">(initialMode ?? "harian");
  const [view, setView] = useState<"grid" | "list">("list");
  const [divisionReport, setDivisionReport] = useState<DivisionReport | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    // Tanggal awal: ?date= pada URL, lalu tanggal laporan Live, lalu hari kerja terakhir.
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("date");
    if (!isValidISODate(fromUrl)) return;
    // Di jendela berbagi, tanggal URL di luar jendela diabaikan.
    if (bounds && (fromUrl < bounds.min || fromUrl > bounds.max)) return;
    setDate(current => current || fromUrl);
    // bounds stabil per halaman (jendela berbagi); cukup dibaca sekali.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!today) return;
    // Di jendela berbagi, "hari ini" bisa berada di luar jendela — tanggal awal
    // selalu tanggal yang dibagikan (initialDate).
    if (bounds) return;
    setDate(current => current || latestWorkingDayOnOrBefore(today, holidays));
    // holidays dibiarkan dari dependensi: default hanya dihitung sekali per hari.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  useEffect(() => {
    if (initialDate && isValidISODate(initialDate)) setDate(current => current || initialDate);
  }, [initialDate]);

  // Harian = tanggal terpilih saja; Mingguan = seluruh minggu yang memuat tanggal itu.
  const range = useMemo(() => {
    if (!date) return null;
    if (mode === "harian") return { start: date, end: date };
    return { start: startOfWeek(date), end: endOfWeek(date) };
  }, [date, mode]);
  const multiDay = Boolean(range && range.start !== range.end);
  const report = useMemo(
    () => (data && range ? buildReport(data, range.start, range.end, groupBy) : null),
    [data, range, groupBy],
  );
  // Kotak tanggal hanya menghitung peserta yang bekerja — anggota dengan keterangan
  // cuti/sakit/izin tidak menaikkan angka, tetapi harinya tetap bisa dibuka.
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    data?.entries.forEach(e => {
      if (e.plans.length + e.done.length + e.blockers.length && !entryAbsence(e)) result[e.date] = (result[e.date] ?? 0) + 1;
    });
    return result;
  }, [data]);
  const hasData = useMemo(() => {
    const result: Record<string, boolean> = {};
    data?.entries.forEach(e => { if (e.plans.length + e.done.length + e.blockers.length) result[e.date] = true; });
    return result;
  }, [data]);

  const selectDate = (value: string) => {
    setDate(value);
    const url = new URL(window.location.href);
    url.searchParams.set("date", value);
    window.history.replaceState(null, "", url);
  };
  const exportCsv = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([`\ufeff${reportToCsv(report)}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `standup-${date}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  // Bagikan: buat tautan ber-kunci untuk rentang aktif — pemegang tautan tanpa
  // akun hanya melihat entri rentang ini, mengikuti data terkini.
  const createShareLink = async () => {
    if (!range || shareBusy) return;
    setShareBusy(true);
    setShareError("");
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: range.start, end: range.end, groupBy }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Gagal membuat tautan berbagi.");
      setShareUrl(`${window.location.origin}/bagikan/${body.id}?k=${body.key}`);
      setShareOpen(true);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Gagal membuat tautan berbagi.");
      setShareOpen(true);
    } finally {
      setShareBusy(false);
    }
  };
  const divisionChips = useMemo(
    () => (snapshot || !range ? [] : latestPerDivisionInRange(data?.divisionReports ?? [], range.start, range.end)),
    [snapshot, range, data?.divisionReports],
  );

  if (loading || !report || !data || !date) return <PageLoading label="Menyiapkan laporan…" />;

  const groups = report.groups;
  return <>
    <WeekTickets date={date} today={today} onChange={selectDate} counts={counts} hasData={hasData} holidays={holidays} mode={mode} onModeChange={setMode} bounds={bounds} />
    <div className="mt-3 mb-3 flex flex-wrap items-center justify-end gap-2.5">
      <div className="flex gap-1 rounded-lg bg-[#eaf0e7] p-1" role="group" aria-label="Kelompok laporan">
        {([['member', 'Per anggota'], ['project', 'Per proyek']] as const).map(([value, label]) => <button key={value} onClick={() => setGroupBy(value)} aria-pressed={groupBy === value} className={cn("rounded-md px-3 py-1.5 text-[11px] transition", groupBy === value ? "bg-white font-medium text-ink shadow-sm" : "text-ink-soft")}>{label}</button>)}
      </div>
      <div className="flex gap-1 rounded-lg bg-[#eaf0e7] p-1" role="group" aria-label="Tampilan konten laporan">
        {([["list", "Tampilan daftar per tim", List], ["grid", "Tampilan kisi/kartu per anggota", LayoutGrid]] as const).map(([value, ariaLabel, Icon]) => (
          <button key={value} onClick={() => setView(value)} aria-pressed={view === value} aria-label={ariaLabel} title={ariaLabel} className={cn("inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-[11px] transition", view === value ? "bg-white font-medium text-ink shadow-sm" : "text-ink-soft")}>
            <Icon size={13} />
          </button>
        ))}
      </div>
      <Button onClick={exportCsv} disabled={!report.lines.length} size="sm" className="text-xs"><Download size={14} /> Ekspor CSV</Button>
      <CopyButton text={formatReportForWhatsApp(report)} label="Salin ringkasan" disabled={!report.lines.length} size="sm" className="text-xs" />
      {!snapshot && !readOnly ? (
        <Button onClick={() => void createShareLink()} disabled={shareBusy} size="sm" className="text-xs">
          <Share2 size={14} /> {shareBusy ? "Menyiapkan…" : "Bagikan"}
        </Button>
      ) : null}
    </div>
    {divisionChips.length > 0 ? (
      <div className="no-print mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-ink-soft/70">Divisi lain</span>
        {divisionChips.map(item => (
          <DivisionChip key={`${item.division}-${item.date}`} report={item} onClick={() => setDivisionReport(item)} />
        ))}
      </div>
    ) : null}
    {groups.length ? (
      view === "list" && groupBy === "member" ? (
        // Daftar per tim: satu kartu per tim, anggota bertumpuk di dalam — ringkas tanpa margin antar anggota.
        (() => {
          const buckets: { title: string; memberCards: { group: ReportGroup; member?: AppState["members"][number] }[] }[] = [];
          data.members.forEach(member => {
            const group = groups.find(g => g.key === member.id);
            if (!group) return;
            const title = member.role || "Tanpa peran";
            let bucket = buckets.find(b => b.title === title);
            if (!bucket) { bucket = { title, memberCards: [] }; buckets.push(bucket); }
            bucket.memberCards.push({ group, member });
          });
          return (
            <div className="grid items-start gap-3 sm:grid-cols-2">
              {buckets.map(bucket => (
                <TeamCard key={bucket.title} title={bucket.title} memberCards={bucket.memberCards} data={data} snapshot={snapshot} showDate={multiDay} />
              ))}
            </div>
          );
        })()
      ) : (
        // Kisi = kartu per anggota/proyek.
        <div className="grid items-start gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map(group => <ReportCard key={group.key} group={group} data={data} groupBy={groupBy} snapshot={snapshot} showDate={multiDay} />)}
        </div>
      )
    ) : <div className="rounded-2xl border border-dashed border-line bg-white py-8"><EmptyState icon={<FileText size={20} />} title={multiDay ? "Belum ada catatan pada minggu ini" : "Belum ada cerita di hari ini"} description={snapshot ? `Snapshot ini memuat laporan ${formatMediumDate(date)}.` : "Pilih tanggal lain di atas. Laporan baru akan muncul setelah standup disimpan atau sesi Live diterbitkan."} action={snapshot && initialDate && initialDate !== date ? <Button onClick={() => selectDate(initialDate)}>Ke tanggal laporan</Button> : null} /></div>}
    <DivisionReportModal report={divisionReport} onClose={() => setDivisionReport(null)} />
    <Modal
      open={shareOpen}
      onClose={() => setShareOpen(false)}
      title="Bagikan laporan"
      description={range ? `${multiDay ? `${formatMediumDate(range.start)} – ${formatMediumDate(range.end)}` : formatMediumDate(range.start)} · hanya rentang ini yang terlihat penerima.` : undefined}
      size="md"
      footer={<Button onClick={() => setShareOpen(false)}>Tutup</Button>}
    >
      {shareError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">{shareError}</p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-[#fbfaf6] p-2.5">
            <p className="break-all font-mono text-[11px] leading-relaxed text-ink">{shareUrl}</p>
          </div>
          <CopyButton text={shareUrl} label="Salin tautan" copiedLabel="Tautan tersalin" variant="primary" size="sm" />
          <p className="text-[11px] leading-relaxed text-ink-soft">
            Tautan memuat kunci akses — siapa pun yang memegang tautan lengkap bisa membaca laporan rentang ini
            <span className="font-medium text-ink"> tanpa perlu login</span>. Isinya mengikuti data tim terkini dan
            kedaluwarsa dalam 180 hari. Kunci tidak ditampilkan lagi setelah dialog ini ditutup; buat tautan baru
            bila perlu membagikan ulang.
          </p>
        </div>
      )}
    </Modal>
  </>;
}
