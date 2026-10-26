"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCheck,
  CircleCheck,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Lock,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Avatar, Button, CopyButton, Modal, cn, useToast } from "@/components/ui";
import { formatClock, formatLongDate, formatMediumDate, isWeekend, todayInJakarta } from "@/lib/date";
import { ABSENCE_LABEL, entryAbsence } from "@/lib/absence";
import { isEntryEmpty } from "@/lib/tasks";
import { DivisionChip, DivisionReportModal } from "@/components/divisions/report-modal";
import type { AppState, DivisionReport, StandupEntry, StandupItem } from "@/lib/types";

export interface ReportFeedProps {
  data: AppState | null;
  today?: string;
  teamDivision?: string | null;
  /** Batas jendela berbagi jika diakses via tautan publik (di luarnya tampil terkunci/blur). */
  bounds?: { min: string; max: string };
  initialDate?: string | null;
  readOnly?: boolean;
  onSwitchToCalendar?: () => void;
}

const DIVISION_ACCENT: Record<string, string> = {
  RnD: "bg-violet-100 text-violet-700 border-violet-200",
  Product: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "PM Project": "bg-sky-100 text-sky-700 border-sky-200",
  Maintenance: "bg-amber-100 text-amber-700 border-amber-200",
};

type TeamMember = AppState["members"][number];

function memberLines(memberName: string, role: string | undefined, entry: StandupEntry): string[] {
  const lines: string[] = [`*${memberName}*${role ? ` (${role})` : ""}`];
  if (entry.plans.length) {
    lines.push("_Rencana:_");
    entry.plans.forEach(p => lines.push(`• ${p.text}`));
  }
  if (entry.done.length) {
    lines.push("_Pekerjaan Sebelumnya:_");
    entry.done.forEach(d => lines.push(`• ${d.text}`));
  }
  if (entry.blockers.length) {
    lines.push("_Kendala:_");
    entry.blockers.forEach(b => lines.push(`• ${b.text}`));
  }
  return lines;
}

function formatDivisionDayForCopy(
  division: string,
  date: string,
  entries: StandupEntry[],
  memberMap: Map<string, TeamMember>,
): string {
  const lines: string[] = [`*${division} — Standup ${formatMediumDate(date)}*`];
  entries.forEach(entry => {
    const member = memberMap.get(entry.memberId);
    const absence = entryAbsence(entry);
    lines.push("");
    if (absence) lines.push(`_${ABSENCE_LABEL[absence]}_`);
    lines.push(...memberLines(member?.name ?? "Anggota tim", member?.role, entry));
  });
  return lines.join("\n");
}

const SECTION_STYLE = {
  plan: {
    label: "Rencana Kerja",
    title: "text-sky-800",
    count: "text-sky-600",
    chip: "bg-sky-100 text-sky-700",
    box: "border-sky-100 bg-sky-50/40",
    marker: "dot" as const,
    Icon: ClipboardList,
  },
  done: {
    label: "Pekerjaan Sebelumnya",
    title: "text-brand-dark",
    count: "text-brand",
    chip: "bg-brand-soft text-brand",
    box: "border-teal-100 bg-emerald-50/30",
    marker: "check" as const,
    Icon: CircleCheck,
  },
  blocker: {
    label: "Kendala",
    title: "text-amber-800",
    count: "text-amber-700",
    chip: "bg-amber-100 text-amber-700",
    box: "border-amber-200 bg-amber-50/60",
    marker: "dot" as const,
    Icon: AlertCircle,
  },
};

function ItemSection({ kind, items }: { kind: keyof typeof SECTION_STYLE; items: StandupItem[] }) {
  if (items.length === 0) return null;
  const section = SECTION_STYLE[kind];
  const { Icon } = section;
  return (
    <div>
      <div className={cn("mb-1.5 flex items-center gap-1.5 text-[11px] font-bold", section.title)}>
        <span className={cn("grid size-4.5 place-items-center rounded", section.chip)}>
          <Icon className="size-3" />
        </span>
        <span>{section.label}</span>
        <span className={cn("text-[10px] font-normal", section.count)}>({items.length})</span>
      </div>
      <ul className={cn("space-y-1.5 rounded-xl border p-2.5", section.box)}>
        {items.map((item, idx) => (
          <li key={item.id || idx} className="flex items-start gap-2 text-[12px] leading-relaxed text-ink/90">
            {section.marker === "check" ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
            ) : (
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", kind === "plan" ? "bg-sky-500" : "bg-amber-500")} />
            )}
            <span className="flex-1">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MemberBlock({
  entry,
  member,
  teamDivision,
}: {
  entry: StandupEntry;
  member: TeamMember | undefined;
  teamDivision: string;
}) {
  const absence = entryAbsence(entry);
  const memberName = member?.name ?? "Anggota tim";
  const postTime = entry.updatedAt ? formatClock(entry.updatedAt) : null;
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        absence ? "border-slate-300 bg-slate-100/70" : "border-line/70 bg-[#fcfcf9]",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Avatar name={memberName} accent={member?.accent ?? "teal"} size="sm" />
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <h4 className="text-[12.5px] font-bold leading-tight text-ink">{memberName}</h4>
          {absence && (
            <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0 text-[9.5px] font-semibold uppercase tracking-wide text-slate-600">
              {ABSENCE_LABEL[absence]}
            </span>
          )}
          {member?.active === false && (
            <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
              Non-aktif
            </span>
          )}
        </div>
        <span className="ml-auto shrink-0 text-[10px] text-ink-soft">
          {member?.role || "Tim Operasional"} · {teamDivision}
          {postTime ? ` · ${postTime} WIB` : ""}
        </span>
      </div>
      <div className="mt-2.5 space-y-2.5">
        <ItemSection kind="plan" items={entry.plans} />
        <ItemSection kind="done" items={entry.done} />
        <ItemSection kind="blocker" items={entry.blockers} />
      </div>
    </div>
  );
}

export function ReportFeed({
  data,
  today = todayInJakarta(),
  teamDivision = "M2MPD",
  bounds,
  initialDate,
  readOnly = false,
  onSwitchToCalendar,
}: ReportFeedProps) {
  const { notify } = useToast();
  const [selectedDivisionReport, setSelectedDivisionReport] = useState<DivisionReport | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Kumpulkan semua tanggal yang memiliki entri atau laporan divisi, urut dari yang terbaru.
  const timelineDates = useMemo(() => {
    if (!data) return [];
    const dateSet = new Set<string>();
    data.entries.forEach(e => {
      if (!isEntryEmpty(e)) dateSet.add(e.date);
    });
    (data.divisionReports ?? []).forEach(r => {
      dateSet.add(r.date);
    });
    return Array.from(dateSet).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }, [data]);

  const memberMap = useMemo(() => {
    const map = new Map<string, AppState["members"][number]>();
    (data?.members ?? []).forEach(m => map.set(m.id, m));
    return map;
  }, [data?.members]);

  const copyPost = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedId(id);
        notify("Catatan standup disalin ke clipboard.", "success");
        setTimeout(() => setCopiedId(null), 2000);
      },
      () => notify("Gagal menyalin teks.", "error"),
    );
  };

  if (!data || timelineDates.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-ink-soft">
        <FileText className="mx-auto size-12 opacity-40" />
        <h3 className="mt-3 text-base font-semibold text-ink">Belum ada linimasa laporan</h3>
        <p className="mt-1 text-xs">Catatan standup tim akan tampil mengalir di sini seperti feed.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      {/* Top Banner / Feed Switcher Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white/90 p-3 shadow-xs backdrop-blur-xs">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand font-semibold text-xs shadow-xs">
            {teamDivision?.slice(0, 3) || "TIM"}
          </span>
          <div>
            <h1 className="text-[14px] font-semibold tracking-tight text-ink">
              {teamDivision ? `${teamDivision} · ` : ""}Linimasa Standup
            </h1>
            <p className="text-[11px] text-ink-soft">
              {timelineDates.length} hari terekam · gulir ke bawah untuk melihat riwayat lampau
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onSwitchToCalendar && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onSwitchToCalendar}
              className="h-8 gap-1.5 text-xs font-medium"
              title="Beralih ke tampilan kalender"
            >
              <Calendar className="size-3.5" /> Tampilan Kalender
            </Button>
          )}
        </div>
      </div>

      {/* Feed Stream */}
      <div className="space-y-8">
        {timelineDates.map(date => {
          const isToday = date === today;
          const isLocked = Boolean(bounds && (date < bounds.min || date > bounds.max));

          // Entri tim M2MPD untuk tanggal ini
          const dayEntries = (data.entries ?? [])
            .filter(e => e.date === date && !isEntryEmpty(e))
            .sort((a, b) => {
              const ma = memberMap.get(a.memberId)?.name ?? "";
              const mb = memberMap.get(b.memberId)?.name ?? "";
              return ma.localeCompare(mb, "id");
            });

          // Laporan divisi lain pada tanggal yang sama
          const dayDivisions = (data.divisionReports ?? []).filter(r => r.date === date);

          const filledCount = dayEntries.filter(e => !entryAbsence(e)).length;
          const absenceCount = dayEntries.length - filledCount;

          return (
            <section key={date} id={`date-${date}`} className="space-y-3.5">
              {/* Day Header (Sticky Timeline Bar) */}
              <div className="sticky top-[58px] z-10 flex items-center justify-between rounded-xl border border-line bg-[#fbfaf6]/95 px-3.5 py-2 shadow-xs backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <h2 className="text-[13px] font-bold text-ink">
                    {formatLongDate(date)}
                  </h2>
                  {isToday && (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase text-brand">
                      Hari ini
                    </span>
                  )}
                  {isLocked && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[9.5px] font-medium text-slate-600">
                      <Lock className="size-2.5" /> Terkunci
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-ink-soft">
                  <span className="font-semibold text-ink">{filledCount}</span> mengisi
                  {absenceCount > 0 && (
                    <span className="ml-1 text-slate-500">· {absenceCount} izin/cuti</span>
                  )}
                </div>
              </div>

              {/* Day Container (with lock blur if outside bounds) */}
              <div className="relative">
                <div className={cn("space-y-3", isLocked && "pointer-events-none select-none blur-sm")}>
                  {(() => {
                    // Susun kartu hari ini secara kronologis: laporan divisi lain + kartu tim.
                    const latestUpdated = dayEntries.reduce(
                      (acc, e) => (e.updatedAt && e.updatedAt > acc ? e.updatedAt : acc),
                      "",
                    );
                    const latestTime = latestUpdated ? formatClock(latestUpdated) : null;

                    const divisionPosts = dayDivisions.map(divReport => ({
                      key: divReport.id,
                      time: divReport.time ?? "",
                      element: (
                        <article
                          key={divReport.id}
                          className="rounded-2xl border border-line/80 bg-[#fbfbf8] p-4 shadow-xs transition hover:border-[#cfd8cb]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "grid size-9 place-items-center rounded-xl border text-xs font-bold",
                                  DIVISION_ACCENT[divReport.division] || "bg-slate-100 text-slate-700 border-slate-200",
                                )}
                              >
                                <Building2 className="size-4" />
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h3 className="text-[13px] font-bold text-ink">
                                    {divReport.author || divReport.division}
                                  </h3>
                                  <span
                                    className={cn(
                                      "rounded-full border px-1.5 py-0.2 text-[9px] font-bold tracking-wide uppercase",
                                      DIVISION_ACCENT[divReport.division] || "bg-slate-100 text-slate-700",
                                    )}
                                  >
                                    {divReport.division}
                                  </span>
                                </div>
                                <p className="text-[10.5px] text-ink-soft">
                                  Laporan referensi divisi lain {divReport.time ? `· ${divReport.time} WIB` : ""}
                                </p>
                              </div>
                            </div>

                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => setSelectedDivisionReport(divReport)}
                              className="h-7 gap-1 text-[11px] text-brand"
                            >
                              Lihat detail <ExternalLink className="size-3" />
                            </Button>
                          </div>

                          <div className="mt-3 rounded-xl border border-line bg-white p-3 font-sans text-[12px] leading-relaxed text-ink/90 whitespace-pre-wrap">
                            {divReport.text}
                          </div>
                        </article>
                      ),
                    }));

                    const teamPosts =
                      dayEntries.length > 0
                        ? (() => {
                            const copyId = `day-${date}`;
                            const copyText = formatDivisionDayForCopy(teamDivision || "Tim", date, dayEntries, memberMap);
                            const sourceCounts = dayEntries.reduce<Record<string, number>>((acc, e) => {
                              acc[e.source] = (acc[e.source] ?? 0) + 1;
                              return acc;
                            }, {});
                            const sourceKeys = Object.keys(sourceCounts);
                            const sourceSummary =
                              sourceKeys.length === 1 && sourceCounts.live
                                ? "live"
                                : sourceKeys.length === 1 && sourceCounts.import
                                  ? "import"
                                  : sourceKeys.length === 1 && sourceCounts.manual
                                    ? "manual"
                                    : "mixed";
                            const mixedLabel = sourceKeys
                              .map(
                                source =>
                                  `${sourceCounts[source]} ${source === "live" ? "Live" : source === "import" ? "WhatsApp" : "Manual"}`,
                              )
                              .join(" · ");

                            return [
                              {
                                key: `team-${date}`,
                                time: latestTime ?? "",
                                element: (
                                  <article key={`team-${date}`} className="rounded-2xl border border-line/90 bg-white shadow-xs transition hover:shadow-sm">
                                    {/* Post Header: per divisi */}
                                    <div className="flex items-start justify-between gap-3 p-4 pb-3">
                                      <div className="flex items-center gap-3">
                                        <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-[11px] font-bold text-brand shadow-xs">
                                          {(teamDivision || "TIM").slice(0, 3)}
                                        </span>
                                        <div>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <h3 className="text-[14px] font-bold leading-tight text-ink">
                                              {teamDivision || "Tim"}
                                            </h3>
                                            <span className="rounded-full border border-brand-200 bg-brand-soft px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide text-brand">
                                              Standup Tim
                                            </span>
                                          </div>
                                          <p className="mt-0.5 text-[11px] text-ink-soft">
                                            {dayEntries.length} anggota · {filledCount} mengisi
                                            {absenceCount > 0 ? ` · ${absenceCount} izin/cuti` : ""}
                                            {latestTime ? ` · diperbarui ${latestTime} WIB` : ""}
                                          </p>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => copyPost(copyId, copyText)}
                                        title="Salin laporan divisi hari ini"
                                        aria-label={`Salin laporan ${teamDivision || "tim"} ${formatMediumDate(date)}`}
                                        className="rounded-lg p-1.5 text-ink-soft/60 transition hover:bg-slate-100 hover:text-ink"
                                      >
                                        {copiedId === copyId ? (
                                          <Check className="size-4 text-brand" />
                                        ) : (
                                          <Copy className="size-4" />
                                        )}
                                      </button>
                                    </div>

                                    {/* Post Content: blok per anggota di dalam kartu divisi */}
                                    <div className="space-y-3 px-4 pb-4">
                                      {dayEntries.map(entry => (
                                        <MemberBlock
                                          key={entry.id}
                                          entry={entry}
                                          member={memberMap.get(entry.memberId)}
                                          teamDivision={teamDivision || "M2MPD"}
                                        />
                                      ))}
                                    </div>

                                    {/* Post Footer Action Bar (Facebook-like) */}
                                    <div className="flex items-center justify-between gap-3 border-t border-line/60 bg-[#faf9f5] px-4 py-2 text-[11px] text-ink-soft">
                                      <span className="flex items-center gap-1.5">
                                        {sourceSummary === "live" ? (
                                          <>
                                            <Sparkles className="size-3 text-brand" /> Sesi Live
                                          </>
                                        ) : sourceSummary === "import" ? (
                                          <>
                                            <MessageSquare className="size-3 text-emerald-600" /> WhatsApp Standup
                                          </>
                                        ) : sourceSummary === "manual" ? (
                                          <>
                                            <ClipboardList className="size-3 text-ink-soft" /> Input manual
                                          </>
                                        ) : (
                                          mixedLabel
                                        )}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => copyPost(copyId, copyText)}
                                        className="inline-flex items-center gap-1 font-medium text-ink-soft transition hover:text-brand"
                                      >
                                        <Copy className="size-3" /> Salin laporan divisi
                                      </button>
                                    </div>
                                  </article>
                                ),
                              },
                            ];
                          })()
                        : [];

                    const posts = [...divisionPosts, ...teamPosts].sort((a, b) =>
                      a.time < b.time ? -1 : a.time > b.time ? 1 : 0,
                    );

                    if (posts.length === 0) {
                      return (
                        <div className="rounded-2xl border border-dashed border-line bg-white/70 py-6 text-center text-xs text-ink-soft">
                          Belum ada catatan pada tanggal ini.
                        </div>
                      );
                    }
                    return posts.map(post => post.element);
                  })()}
                </div>

                {/* Lock Overlay when date is outside bounds */}
                {isLocked && (
                  <div className="absolute inset-0 z-10 grid place-items-center p-4">
                    <div className="max-w-sm rounded-2xl border border-line bg-white/95 p-5 text-center shadow-lg backdrop-blur-md">
                      <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                        <Lock className="size-5" />
                      </span>
                      <h3 className="mt-3 text-[13.5px] font-semibold text-ink">
                        Tanggal ini di luar rentang yang dibagikan
                      </h3>
                      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
                        Ada catatan pada tanggal ini, tetapi pemilik tautan hanya membagikan
                        {" "}
                        {bounds ? `${formatMediumDate(bounds.min)} – ${formatMediumDate(bounds.max)}` : "rentang tertentu"}.
                        Minta tautan berbagi baru untuk membukanya.
                      </p>
                      {initialDate && (
                        <a
                          href={`#date-${initialDate}`}
                          className="mt-3.5 inline-block rounded-xl bg-brand px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition hover:bg-brand-dark"
                        >
                          Ke rentang yang dibagikan
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <DivisionReportModal
        report={selectedDivisionReport}
        onClose={() => setSelectedDivisionReport(null)}
      />
    </div>
  );
}
