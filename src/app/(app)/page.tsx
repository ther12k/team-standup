/* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi awal dengan localStorage / data tanggal Asia/Jakarta setelah mount. */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Link2,
  ListChecks,
  MessageSquareShare,
  Plus,
  Settings2,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { WorkflowBanner } from "@/components/workflow-banner";
import {
  Avatar,
  Button,
  Card,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoading,
  Pill,
  SectionLabel,
  StatCard,
  useToast,
  cn,
} from "@/components/ui";
import { MemberEntryCard, TaskPeekRow } from "@/components/standup/member-card";
import { CarryOverModal } from "@/components/standup/carry-over-modal";
import {
  addDays,
  eachDate,
  endOfWeek,
  formatLongDate,
  formatMediumDate,
  formatShortDate,
  formatWeekday,
  isValidISODate,
  relativeDayLabel,
  startOfWeek,
  weekdayIndex,
} from "@/lib/date";
import { carryCandidates, isEntryEmpty, membersWithoutEntry } from "@/lib/tasks";
import {
  holidayLabel,
  isDateSelectable,
  latestWorkingDayOnOrBefore,
  nextWorkingDay,
  nonWorkingReason,
  prevWorkingDay,
} from "@/lib/workdays";
import { formatStandupForWhatsApp } from "@/lib/whatsapp";
import { ABSENCE_LABEL, detectAbsence, entryAbsence, type AbsenceKind } from "@/lib/absence";
import type { StandupEntry, StandupItem } from "@/lib/types";
import type { EntryDraft } from "@/lib/store";

export default function StandupPage() {
  const { state, hydrated, today, saveEntry, addMember, carryOver, addHoliday, removeHoliday, setMemberActive } = useStore();
  const { notify } = useToast();
  const [date, setDate] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [carryOpen, setCarryOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", role: "" });
  const [memberError, setMemberError] = useState<string | null>(null);
  const [newHoliday, setNewHoliday] = useState({ date: "", label: "" });
  const [manageOpen, setManageOpen] = useState(false);

  const holidays = state.holidays ?? [];

  useEffect(() => {
    if (today && !date) setDate(latestWorkingDayOnOrBefore(today, holidays));
    // holidays berubah hanya saat daftar libur diedit; default cukup dihitung sekali per hari.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, date]);

  const entryByMember = useMemo(() => {
    const map = new Map<string, StandupEntry>();
    state.entries
      .filter((entry) => entry.date === date && !isEntryEmpty(entry))
      .forEach((entry) => map.set(entry.memberId, entry));
    return map;
  }, [state.entries, date]);

  const totals = useMemo(() => {
    const entries = Array.from(entryByMember.values());
    return {
      plans: entries.reduce((total, entry) => total + entry.plans.length, 0),
      done: entries.reduce((total, entry) => total + entry.done.length, 0),
      blockers: entries.reduce((total, entry) => total + entry.blockers.length, 0),
      // Angka "mengisi" hanya menghitung anggota aktif yang bekerja — non-aktif
      // dan yang menulis cuti/sakit/izin tidak menaikkan pembilang.
      filled: entries.filter((entry) =>
        state.members.find((m) => m.id === entry.memberId)?.active !== false && !entryAbsence(entry),
      ).length,
    };
  }, [entryByMember, state.members]);

  const absentees = useMemo(() => {
    const list: { memberId: string; kind: AbsenceKind; note: string }[] = [];
    entryByMember.forEach((entry, memberId) => {
      const kind = entryAbsence(entry);
      if (kind) {
        const note = [...entry.plans, ...entry.done, ...entry.blockers].map((item) => item.text).find((text) => detectAbsence([text]) !== null) ?? "";
        list.push({ memberId, kind, note });
      }
    });
    return list;
  }, [entryByMember]);
  const absentMemberIds = useMemo(() => new Set(absentees.map((a) => a.memberId)), [absentees]);

  const missing = useMemo(
    () => membersWithoutEntry(state, date).filter((member) => !absentMemberIds.has(member.id)),
    [state, date, absentMemberIds],
  );
  const candidates = useMemo(() => carryCandidates(state, date), [state, date]);
  const quickCandidates = useMemo(() => candidates.filter((candidate) => !candidate.alreadyPlanned).slice(0, 4), [candidates]);
  const weekDates = useMemo(() => (isValidISODate(date) ? eachDate(startOfWeek(date), endOfWeek(date)) : []), [date]);
  const projects = useMemo(
    () => Array.from(new Set(state.tasks.map((task) => task.project).filter((value): value is string => Boolean(value?.trim())))).sort(),
    [state.tasks],
  );

  const dayHasData = (day: string) =>
    state.entries.some((entry) => entry.date === day && entry.plans.length + entry.done.length + entry.blockers.length > 0);
  const daySelectable = (day: string) => isDateSelectable(day, holidays, dayHasData(day));
  const upcomingHolidays = holidays.filter((holiday) => holiday.date >= today).slice(0, 5);

  const activeMembers = state.members.filter((member) => member.active !== false);
  const inactiveMembers = state.members.filter((member) => member.active === false);
  // Anggota aktif selalu tampil; non-aktif hanya bila punya catatan pada tanggal terpilih
  // (riwayat tetap terbuka, tetapi tidak mengundang pengisian baru).
  const gridMembers = [
    ...activeMembers,
    ...inactiveMembers.filter((member) => entryByMember.has(member.id)),
  ];

  if (!hydrated || !date) return <PageLoading />;

  const waText = formatStandupForWhatsApp(state, date);
  const reminderText = [
    `Halo, mohon lengkapi standup ${formatMediumDate(date)}:`,
    ...missing.map((member) => `• ${member.name}`),
  ].join("\n");

  const handleSave = (draft: EntryDraft) => {
    saveEntry(draft);
    setEditingMemberId(null);
    const member = state.members.find((m) => m.id === draft.memberId);
    notify(`Standup ${member?.name ?? "anggota"} untuk ${formatMediumDate(draft.date)} tersimpan.`);
  };

  const moveToDone = (memberId: string, item: StandupItem) => {
    const entry = entryByMember.get(memberId);
    if (!entry) return;
    saveEntry({
      date,
      memberId,
      plans: entry.plans.filter((plan) => plan.id !== item.id),
      done: [...entry.done, { text: item.text, taskId: item.taskId, project: item.project }],
      blockers: entry.blockers,
    });
    notify("Dipindahkan ke Pekerjaan Sebelumnya. Status tugas tidak ikut berubah.", "info");
  };

  const handleAddMember = () => {
    if (newMember.name.trim().length < 2) {
      setMemberError("Nama anggota minimal 2 karakter.");
      return;
    }
    const member = addMember(newMember.name, newMember.role);
    if (!member) {
      setMemberError("Nama anggota tidak valid.");
      return;
    }
    setAddOpen(false);
    setNewMember({ name: "", role: "" });
    setMemberError(null);
    setEditingMemberId(member.id);
    notify(`${member.name} siap diisi standup-nya.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
            <ClipboardList className="h-3.5 w-3.5" /> Standup harian · Asia/Jakarta
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[26px]">Standup Harian</h1>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {formatLongDate(date)} · <span className="font-medium text-brand-dark">{relativeDayLabel(date, today)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setCarryOpen(true)}>
            <ArrowDownToLine className="h-4 w-4" /> Bawa tugas
          </Button>
          <Button variant="secondary" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> Anggota
          </Button>
          <Button variant="primary" onClick={() => setWaOpen(true)}>
            <MessageSquareShare className="h-4 w-4" /> Salin WhatsApp
          </Button>
        </div>
      </div>

      <WorkflowBanner />

      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => {
                setDate(prevWorkingDay(date, holidays));
                setEditingMemberId(null);
              }}
              aria-label="Hari kerja sebelumnya"
              className="px-2.5"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <Input
                type="date"
                value={date}
                onChange={(event) => {
                  const picked = event.target.value;
                  if (!isValidISODate(picked)) return;
                  if (!daySelectable(picked)) {
                    notify(`${formatLongDate(picked)} bukan hari kerja (${nonWorkingReason(holidays, picked)}). Pilih hari kerja.`, "error");
                    return;
                  }
                  setDate(picked);
                  setEditingMemberId(null);
                }}
                className="h-9 w-[168px] pl-8 text-[13px] font-medium"
                aria-label="Pilih tanggal standup"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                setDate(nextWorkingDay(date, holidays));
                setEditingMemberId(null);
              }}
              aria-label="Hari kerja berikutnya"
              className="px-2.5"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={date === today ? "soft" : "ghost"}
              onClick={() => {
                const target = latestWorkingDayOnOrBefore(today, holidays);
                if (target !== today) {
                  notify(`Hari ini ${nonWorkingReason(holidays, today)} — menampilkan hari kerja terakhir (${formatMediumDate(target)}).`, "info");
                }
                setDate(target);
                setEditingMemberId(null);
              }}
            >
              Hari ini
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill className="border-line bg-slate-50 text-ink-soft">{formatWeekday(date)}</Pill>
            <Pill className="border-teal-200 bg-brand-soft text-brand-dark">
              <Users className="h-3 w-3" /> {totals.filled}/{activeMembers.length} mengisi
            </Pill>
            {absentees.length > 0 ? (
              <Pill className="border-orange-200 bg-orange-50 text-orange-700">
                {absentees.length} cuti/sakit/izin
              </Pill>
            ) : null}
            {missing.length > 0 ? (
              <Pill className="border-amber-200 bg-amber-50 text-amber-800">{missing.length} belum mengisi</Pill>
            ) : (
              <Pill className="border-teal-200 bg-teal-50 text-teal-700">
                <CheckCircle2 className="h-3 w-3" /> Lengkap
              </Pill>
            )}
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-7 gap-1">
          {weekDates.map((day) => {
            const dayEntries = state.entries.filter((entry) => entry.date === day && !isEntryEmpty(entry));
            // Titik hijau hanya menyala bila ada peserta yang bekerja (bukan sekadar keterangan cuti).
            const workingCount = dayEntries.filter((entry) => !entryAbsence(entry)).length;
            const isSelected = day === date;
            const isToday = day === today;
            const selectable = daySelectable(day);
            const reason = nonWorkingReason(holidays, day);
            return (
              <button
                key={day}
                type="button"
                disabled={!selectable}
                onClick={() => {
                  setDate(day);
                  setEditingMemberId(null);
                }}
                aria-pressed={isSelected}
                aria-disabled={!selectable}
                aria-label={`${formatLongDate(day)}${workingCount ? `, ${workingCount} anggota bekerja` : dayEntries.length ? ", hanya keterangan cuti/izin" : ", belum ada catatan"}${!selectable ? ` — ${reason}` : ""}`}
                title={!selectable ? `Bukan hari kerja: ${reason}${dayEntries.length ? " (ada catatan lama)" : ""}` : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 transition-colors",
                  selectable ? "cursor-pointer" : "cursor-not-allowed opacity-40",
                  isSelected
                    ? "border-brand bg-brand text-white shadow-sm"
                    : selectable
                      ? "border-line bg-white text-ink-soft hover:border-teal-300 hover:bg-brand-soft/50"
                      : "border-dashed border-line bg-slate-50 text-ink-soft/60",
                )}
              >
                <span className={cn("text-[9.5px] font-semibold uppercase tracking-wide", isSelected ? "text-white/80" : "text-ink-soft/70")}>
                  {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"][(weekdayIndex(day) + 6) % 7]}
                </span>
                <span className={cn("text-[13px] font-semibold leading-none", isSelected ? "text-white" : "text-ink")}>
                  {Number(day.slice(8, 10))}
                </span>
                <span
                  className={cn(
                    "h-1 w-1 rounded-full",
                    isSelected ? "bg-white/80" : workingCount > 0 ? "bg-brand" : dayEntries.length > 0 ? "bg-orange-400" : "bg-slate-200",
                  )}
                  aria-hidden
                />
                {isToday && !isSelected ? (
                  <span className="absolute inset-0 rounded-lg ring-1 ring-brand/40" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Rencana" value={totals.plans} tone="brand" icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Pekerjaan Sebelumnya" value={totals.done} hint="Dilaporkan eksplisit" tone="neutral" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Kendala" value={totals.blockers} tone={totals.blockers > 0 ? "amber" : "neutral"} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Belum mengisi" value={missing.length} hint={`dari ${activeMembers.length} anggota aktif`} tone={missing.length > 0 ? "rose" : "neutral"} icon={<Users className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_324px]">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">Anggota tim</h2>
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-soft ring-1 ring-line">
                {activeMembers.length}
                {inactiveMembers.length > 0 ? (
                  <span className="text-ink-soft/70"> + {inactiveMembers.length} non-aktif</span>
                ) : null}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="hidden items-center gap-1.5 text-[11px] text-ink-soft sm:flex">
                <Link2 className="h-3 w-3" /> Klik tugas tertaut untuk membuka detail
              </div>
              <Button size="xs" variant="ghost" onClick={() => setManageOpen(true)}>
                <Settings2 className="h-3.5 w-3.5" /> Kelola
              </Button>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {gridMembers.map((member) => {
              const absence = absentees.find((a) => a.memberId === member.id);
              return (
              <div key={member.id} className={cn(editingMemberId === member.id && "sm:col-span-2")}>
                <MemberEntryCard
                  member={member}
                  entry={entryByMember.get(member.id)}
                  date={date}
                  tasks={state.tasks}
                  projects={projects}
                  editing={editingMemberId === member.id}
                  inactive={member.active === false}
                  absence={absence ? { label: ABSENCE_LABEL[absence.kind], note: absence.note } : undefined}
                  onEdit={() => setEditingMemberId(member.id)}
                  onCancel={() => setEditingMemberId(null)}
                  onSave={handleSave}
                  onMoveToDone={(item) => moveToDone(member.id, item)}
                />
              </div>
              );
            })}
          </div>

          <Card className="flex flex-wrap items-center justify-between gap-2 bg-[#fbfaf6] p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 text-brand" />
              <p className="text-[11.5px] leading-snug text-ink-soft">
                Koordinator dapat mengisi standup seluruh anggota dari layar ini, termasuk tanggal lampau.
              </p>
            </div>
            <Button size="xs" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Anggota baru
            </Button>
          </Card>
        </section>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ListChecks className="h-4 w-4 text-brand" />
                <h2 className="text-[13px] font-semibold text-ink">Tugas belum selesai</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                {candidates.filter((candidate) => !candidate.alreadyPlanned).length}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">
              Bawa ke rencana tanpa menandai selesai.
            </p>
            <div className="mt-2.5 space-y-1.5">
              {quickCandidates.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-ink-soft">
                  Tidak ada tugas tertunda yang bisa dibawa.
                </p>
              ) : (
                quickCandidates.map((candidate) => (
                  <div key={`${candidate.member.id}-${candidate.task.id}`}>
                    <div className="mb-1 flex items-center gap-1">
                      <Avatar name={candidate.member.name} accent={candidate.member.accent} size="xs" />
                      <span className="text-[10px] font-medium text-ink-soft">{candidate.member.name}</span>
                    </div>
                    <TaskPeekRow
                      task={candidate.task}
                      onAdd={() => {
                        const added = carryOver(date, [{ memberId: candidate.member.id, taskId: candidate.task.id }]);
                        notify(
                          added > 0 ? "Tugas dibawa ke rencana. Status tugas tidak berubah." : "Tugas sudah ada di rencana.",
                          added > 0 ? "success" : "info",
                        );
                      }}
                    />
                  </div>
                ))
              )}
            </div>
            <Button variant="secondary" size="sm" className="mt-2.5 w-full" onClick={() => setCarryOpen(true)}>
              <ArrowDownToLine className="h-3.5 w-3.5" /> Pilih tugas
            </Button>
          </Card>

          <Card className="p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-amber-600" />
                <h2 className="text-[13px] font-semibold text-ink">Belum mengisi</h2>
              </div>
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                {missing.length}
              </span>
            </div>
            {missing.length === 0 ? (
              <p className="mt-2 rounded-lg bg-teal-50 px-2.5 py-2 text-[11px] text-teal-800">
                Semua anggota sudah mengisi standup tanggal ini.
              </p>
            ) : (
              <>
                <ul className="mt-2 space-y-1">
                  {missing.map((member) => (
                    <li key={member.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-50">
                      <Avatar name={member.name} accent={member.accent} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-ink">{member.name}</p>
                        <p className="truncate text-[10px] text-ink-soft">{member.role}</p>
                      </div>
                      <Button size="xs" variant="ghost" onClick={() => setEditingMemberId(member.id)}>
                        Isi
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2">
                  <CopyButton
                    text={reminderText}
                    label="Salin pengingat"
                    copiedLabel="Pengingat tersalin"
                    variant="secondary"
                    size="xs"
                    icon={false}
                  />
                </div>
              </>
            )}
          </Card>

          <Card className="p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CalendarOff className="h-4 w-4 text-ink-soft" />
                <h2 className="text-[13px] font-semibold text-ink">Hari libur</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                {holidays.length}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">
              Sabtu–Minggu otomatis non-aktif. Tanggal libur tidak bisa dipilih, kecuali sudah ada catatan.
            </p>
            {upcomingHolidays.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {upcomingHolidays.map((holiday) => (
                  <li key={holiday.date} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-50">
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                      {formatShortDate(holiday.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">{holiday.label ?? "Libur"}</span>
                    <button
                      type="button"
                      onClick={() => removeHoliday(holiday.date)}
                      aria-label={`Hapus libur ${holiday.label ?? holiday.date}`}
                      className="rounded-md p-1 text-ink-soft/60 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-ink-soft">
                Tidak ada libur terjadwal saat ini.
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Input
                type="date"
                value={newHoliday.date}
                onChange={(event) => setNewHoliday((current) => ({ ...current, date: event.target.value }))}
                aria-label="Tanggal libur baru"
                className="h-8 w-[130px] text-[11.5px]"
              />
              <Input
                value={newHoliday.label}
                onChange={(event) => setNewHoliday((current) => ({ ...current, label: event.target.value }))}
                placeholder="mis. Cuti bersama"
                aria-label="Nama libur (opsional)"
                className="h-8 min-w-0 flex-1 text-[11.5px]"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!isValidISODate(newHoliday.date)) {
                    notify("Pilih tanggal libur terlebih dahulu.");
                    return;
                  }
                  addHoliday(newHoliday.date, newHoliday.label);
                  setNewHoliday({ date: "", label: "" });
                  notify(`Libur ${formatMediumDate(newHoliday.date)} disimpan.`, "success");
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Tambah
              </Button>
            </div>
          </Card>

          <Card className="bg-[#fbfaf6] p-3.5">
            <SectionLabel>Catatan</SectionLabel>
            <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-ink-soft">
              <li>• Rencana ≠ pekerjaan sebelumnya. Bagian Pekerjaan Sebelumnya hanya untuk pekerjaan yang sudah dikerjakan.</li>
              <li>• Tanggal standup tidak pernah mengubah tenggat tugas.</li>
              <li>• Tugas dapat muncul di banyak standup dengan riwayat per tanggal.</li>
            </ul>
          </Card>
        </aside>
      </div>

      <CarryOverModal
        open={carryOpen}
        onClose={() => setCarryOpen(false)}
        date={date}
        candidates={candidates}
        onApply={(picks) => {
          const added = carryOver(date, picks);
          notify(
            added > 0
              ? `${added} tugas dibawa ke rencana ${formatMediumDate(date)}. Status tugas tidak berubah.`
              : "Tidak ada tugas baru—semua pilihan sudah ada di rencana.",
            added > 0 ? "success" : "info",
          );
        }}
      />

      <Modal
        open={waOpen}
        onClose={() => setWaOpen(false)}
        title="Salin untuk WhatsApp"
        description={`Ringkasan ${formatLongDate(date)} — bagian kosong dihilangkan.`}
        size="md"
        footer={
          <>
            <Button onClick={() => setWaOpen(false)}>Tutup</Button>
            <CopyButton text={waText} label="Salin teks WhatsApp" />
          </>
        }
      >
        {totals.filled === 0 ? (
          <EmptyState
            title="Belum ada catatan"
            description="Isi standup minimal satu anggota, lalu salin ringkasannya ke grup WhatsApp."
            icon={<MessageSquareShare className="h-5 w-5" />}
          />
        ) : (
          <pre className="max-h-[52vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-[#f8f7f3] p-3 font-sans text-[12.5px] leading-relaxed text-ink">
            {waText}
          </pre>
        )}
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Tambah anggota tim"
        description="Anggota baru langsung bisa diisi standup dan ditugaskan pekerjaan."
        size="sm"
        footer={
          <>
            <Button onClick={() => setAddOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={handleAddMember}>
              <UserPlus className="h-4 w-4" /> Tambah anggota
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nama lengkap" htmlFor="member-name" error={memberError ?? undefined}>
            <Input
              id="member-name"
              value={newMember.name}
              onChange={(event) => {
                setNewMember((current) => ({ ...current, name: event.target.value }));
                setMemberError(null);
              }}
              placeholder="Contoh: Fajar Nugroho"
              autoFocus
            />
          </Field>
          <Field label="Peran / unit" htmlFor="member-role" hint="Opsional, mis. Teknisi Lapangan atau Administrasi.">
            <Input
              id="member-role"
              value={newMember.role}
              onChange={(event) => setNewMember((current) => ({ ...current, role: event.target.value }))}
              placeholder="Teknisi Lapangan"
            />
          </Field>
          <div className="flex items-start gap-2 rounded-xl border border-dashed border-line bg-[#fbfaf6] px-3 py-2 text-[11px] leading-snug text-ink-soft">
            <CalendarPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Setelah ditambahkan, formulir standup anggota akan langsung terbuka untuk tanggal {formatMediumDate(date)}.
          </div>
        </div>
      </Modal>

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Kelola anggota"
        description="Non-aktifkan anggota yang resign: riwayat lama tetap terlihat di laporan, tetapi tidak dihitung sebagai “belum mengisi”."
        size="md"
        footer={<Button onClick={() => setManageOpen(false)}>Selesai</Button>}
      >
        <ul className="space-y-1.5">
          {[...activeMembers, ...inactiveMembers].map((member) => {
            const active = member.active !== false;
            const entryCount = state.entries.filter((entry) => entry.memberId === member.id).length;
            return (
              <li key={member.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-white p-2.5">
                <Avatar name={member.name} accent={member.accent} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[13px] font-medium", active ? "text-ink" : "text-ink-soft")}>
                    {member.name}
                  </p>
                  <p className="truncate text-[10.5px] text-ink-soft">
                    {member.role} · {entryCount} catatan
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  aria-label={`${active ? "Non-aktifkan" : "Aktifkan"} ${member.name}`}
                  onClick={() => {
                    setMemberActive(member.id, !active);
                    notify(active ? `${member.name} dinonaktifkan — tidak dihitung sebagai belum mengisi.` : `${member.name} diaktifkan kembali.`, "info");
                  }}
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    active ? "bg-brand" : "bg-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                      active ? "left-[18px]" : "left-0.5",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>
    </div>
  );
}
