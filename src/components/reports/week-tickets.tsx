"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { addDays, eachDate, endOfWeek, formatLongDate, formatMediumDate, formatMonthName, startOfWeek, weekdayIndex, isValidISODate } from "@/lib/date";
import { isDateSelectable, latestWorkingDayOnOrBefore, nonWorkingReason } from "@/lib/workdays";
import type { Holiday } from "@/lib/types";
import { Button, cn } from "@/components/ui";

export function WeekTickets({ date, today, onChange, counts, hasData, holidays, mode, onModeChange }: {
  date: string; today: string; onChange: (date: string) => void; counts: Record<string, number>; holidays: Holiday[];
  /** Hari dengan data apa pun (termasuk yang hanya berisi keterangan cuti/izin) agar tetap bisa dibuka. */
  hasData?: Record<string, boolean>;
  mode?: "harian" | "mingguan"; onModeChange?: (mode: "harian" | "mingguan") => void;
}) {
  const calendar = useRef<HTMLInputElement>(null);
  const track = useRef<HTMLDivElement>(null);
  // Muat bar dengan sebanyak mungkin tanggal yang muat (kartu persegi tetap),
  // minimal 7, digeser otomatis saat lebar berubah.
  const [capacity, setCapacity] = useState(7);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const ticket = width < 640 ? 74 : 108; // lebar kartu + bingkai
      const fit = Math.floor((width + 8) / (ticket + 8));
      setCapacity(Math.max(7, Math.min(fit || 7, 28)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const container = track.current;
    const selected = container?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!container || !selected || container.scrollWidth <= container.clientWidth) return;
    const left = container.scrollLeft + selected.getBoundingClientRect().left - container.getBoundingClientRect().left - (container.clientWidth - selected.clientWidth) / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [date]);
  const before = Math.floor((capacity - 1) / 2);
  const rangeStart = addDays(date, -before);
  const days = eachDate(rangeStart, addDays(rangeStart, capacity - 1));
  const firstMonth = Number(days[0].slice(5, 7)) - 1;
  const lastMonth = Number(days[days.length - 1].slice(5, 7)) - 1;
  const month =
    firstMonth === lastMonth
      ? `${formatMonthName(firstMonth)} ${date.slice(0, 4)}`
      : `${formatMonthName(firstMonth).slice(0, 3)} – ${formatMonthName(lastMonth).slice(0, 3)} ${days[days.length - 1].slice(0, 4)}`;
  // Judul rentang efektif (menggantikan baris judul terpisah di bawah bar tanggal):
  // harian = tanggal terpilih; mingguan = minggu yang memuat tanggal itu.
  const effStart = mode === "mingguan" ? startOfWeek(date) : date;
  const effEnd = mode === "mingguan" ? endOfWeek(date) : date;
  const heading = mode === "mingguan"
    ? `${formatMediumDate(effStart)} – ${formatMediumDate(effEnd)}`
    : formatLongDate(date);
  const todayInRange = today >= effStart && today <= effEnd;
  return (
    <section className="ticket-selector" aria-label="Pilih tanggal laporan">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[13.5px] font-semibold tracking-tight text-ink">{heading}</h2>
          {todayInRange && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[8.5px] font-semibold text-brand">HARI INI</span>}
          <span className="hidden text-[10px] text-ink-soft/70 sm:inline">{month}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {mode && onModeChange ? (
            <div className="flex gap-0.5 rounded-lg border border-line bg-[#eaf0e7] p-0.5" role="group" aria-label="Rentang laporan">
              {([["harian", "Harian", CalendarDays], ["mingguan", "Mingguan", CalendarRange]] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onModeChange(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                    mode === value ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink",
                  )}
                >
                  <Icon size={12} />{label}
                </button>
              ))}
            </div>
          ) : null}
          <Button variant="ghost" onClick={() => onChange(latestWorkingDayOnOrBefore(today, holidays))} className="h-8 px-2.5 text-xs">Hari ini</Button>
          <div className="relative">
            <Button onClick={() => { try { calendar.current?.showPicker(); } catch { calendar.current?.focus(); } }} className="h-8 px-3 text-xs"><CalendarDays size={14} /> Tanggal lain</Button>
            <input
              ref={calendar}
              type="date"
              value={date}
              onChange={e => {
                const picked = e.target.value;
                if (!isValidISODate(picked)) return;
                // Hari libur/akhir pekan hanya bisa dibuka bila ada catatannya.
                if (!isDateSelectable(picked, holidays, hasData?.[picked] ?? (counts[picked] ?? 0) > 0)) return;
                onChange(picked);
              }}
              aria-label="Tanggal laporan lainnya"
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
          <div className="ml-1 flex gap-1 border-l border-line pl-2">
            <Button className="size-8 px-0" onClick={() => onChange(addDays(date, -7))} aria-label="Minggu sebelumnya"><ChevronLeft size={16} /></Button>
            <Button className="size-8 px-0" onClick={() => onChange(addDays(date, 7))} aria-label="Minggu berikutnya"><ChevronRight size={16} /></Button>
          </div>
        </div>
      </div>
      <div ref={track} className="ticket-track" role="group" aria-label={`Rentang ${formatMediumDate(days[0])} – ${formatMediumDate(days[days.length - 1])}`}>
        {days.map(day => {
          const selected = day === date;
          const count = counts[day] ?? 0;
          const selectable = isDateSelectable(day, holidays, hasData?.[day] ?? count > 0);
          const reason = nonWorkingReason(holidays, day);
          return <button
            key={day}
            type="button"
            disabled={!selectable}
            onClick={() => onChange(day)}
            aria-pressed={selected}
            aria-disabled={!selectable}
            aria-label={`${formatLongDate(day)}, ${count} anggota mengisi${!selectable ? ` — ${reason}` : ""}`}
            title={!selectable ? `Bukan hari kerja: ${reason}` : undefined}
            className={cn("date-ticket", selected && "is-selected", day === today && "is-today", !selectable && "is-nonworking")}
          >
            <span className="ticket-day">{["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][weekdayIndex(day)]}{day === today && <span className="ticket-today">Hari ini</span>}</span>
            <span className="ticket-date">{Number(day.slice(8))}</span>
            <span className="ticket-caption">{!selectable ? "Libur" : <>{selected ? <Check size={11} /> : <span className={cn("size-1.5 rounded-full", count ? "bg-brand" : "bg-slate-300")} />}{count ? ` ${count} anggota` : " Belum ada"}</>}</span>
          </button>;
        })}
      </div>
    </section>
  );
}
