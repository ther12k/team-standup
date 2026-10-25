"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Link2, MapPin, Plus, Trash2 } from "lucide-react";
import type { Member, StandupEntry, Task } from "@/lib/types";
import { Button, Input, Select, cn } from "@/components/ui";
import type { DraftItem, EntryDraft } from "@/lib/store";
import { statusMeta } from "@/lib/tasks";

type Row = { id?: string; text: string; taskId: string; project: string };
type Draft = { plans: Row[]; done: Row[]; blockers: Row[] };

let rowCounter = 0;
function blankRow(): Row {
  rowCounter += 1;
  return { text: "", taskId: `blank-${rowCounter}`, project: "" };
}

function rowsFrom(items: DraftItem[]): Row[] {
  if (items.length === 0) return [];
  return items.map((item) => ({ id: item.id, text: item.text, taskId: item.taskId ?? "", project: item.project ?? "" }));
}

function toRows(draft: Draft): DraftItem[] {
  return Object.values(draft)
    .flat()
    .filter((row) => row.text.trim().length > 0)
    .map((row) => ({ id: row.id, text: row.text.trim(), taskId: row.taskId || undefined, project: row.project.trim() || undefined }));
}

const SECTIONS = [
  {
    key: "plans" as const,
    label: "Rencana",
    tone: "text-brand-dark",
    dot: "bg-brand",
    placeholder: "Contoh: review pull request fitur diskon",
    hint: "Pekerjaan yang direncanakan — bukan pekerjaan yang sudah dikerjakan.",
  },
  {
    key: "done" as const,
    label: "Pekerjaan Sebelumnya",
    tone: "text-teal-700",
    dot: "bg-teal-500",
    placeholder: "Contoh: ganti housing kamera lorong 2",
    hint: "Pekerjaan yang sudah dikerjakan sejak laporan terakhir — bukan rencana.",
  },
  {
    key: "blockers" as const,
    label: "Kendala",
    tone: "text-amber-800",
    dot: "bg-amber-500",
    placeholder: "Contoh: menunggu switch pengganti dari vendor",
    hint: "Hambatan atau bantuan yang dibutuhkan.",
  },
];

export function EntryEditor({
  member,
  entry,
  date,
  tasks,
  projects,
  onSave,
  onCancel,
}: {
  member: Member;
  entry?: StandupEntry;
  date: string;
  tasks: Task[];
  projects: string[];
  onSave: (draft: EntryDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    plans: rowsFrom(entry?.plans ?? []),
    done: rowsFrom(entry?.done ?? []),
    blockers: rowsFrom(entry?.blockers ?? []),
  }));
  const [touchedPlan, setTouchedPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberTasks = useMemo(
    () => tasks.filter((task) => task.assigneeIds.includes(member.id)),
    [tasks, member.id],
  );
  const otherTasks = useMemo(
    () => tasks.filter((task) => !task.assigneeIds.includes(member.id)),
    [tasks, member.id],
  );

  const totalRows = draft.plans.length + draft.done.length + draft.blockers.length;

  const addRow = (key: keyof Draft) => {
    setDraft((current) => ({ ...current, [key]: [...current[key], blankRow()] }));
  };

  const updateRow = (key: keyof Draft, index: number, patch: Partial<Row>) => {
    setDraft((current) => ({
      ...current,
      [key]: current[key].map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    }));
  };

  const removeRow = (key: keyof Draft, index: number) => {
    setDraft((current) => ({ ...current, [key]: current[key].filter((_, rowIndex) => rowIndex !== index) }));
  };

  const submit = () => {
    const plans = toRows({ plans: draft.plans, done: [], blockers: [] });
    const done = toRows({ plans: [], done: draft.done, blockers: [] });
    const blockers = toRows({ plans: [], done: [], blockers: draft.blockers });
    if (plans.length + done.length + blockers.length === 0) {
      setError("Isi minimal satu aktivitas, atau batalkan untuk menutup tanpa menyimpan.");
      return;
    }
    onSave({ date, memberId: member.id, plans, done, blockers });
  };

  return (
    <div className="space-y-3.5">
      {SECTIONS.map((section) => {
        const rows = draft[section.key];
        return (
          <div key={section.key}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", section.dot)} aria-hidden />
                <p className={cn("text-[12px] font-semibold", section.tone)}>{section.label}</p>
                <span className="text-[11px] text-ink-soft/70">({rows.filter((r) => r.text.trim()).length})</span>
              </div>
              <button
                type="button"
                onClick={() => addRow(section.key)}
                className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:bg-slate-100 hover:text-ink"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah
              </button>
            </div>

            <div className="mt-1.5 space-y-1.5">
              {rows.length === 0 ? (
                <button
                  type="button"
                  onClick={() => addRow(section.key)}
                  className="w-full rounded-xl border border-dashed border-line px-3 py-2 text-left text-[12px] text-ink-soft/80 transition-colors hover:border-teal-300 hover:bg-brand-soft/40"
                >
                  + {section.placeholder}
                </button>
              ) : null}
              {rows.map((row, index) => (
                <div key={row.id ?? `${section.key}-${index}`} className="rounded-xl border border-line bg-white p-1.5">
                  <div className="flex items-start gap-1">
                    <Input
                      value={row.text}
                      onChange={(event) => updateRow(section.key, index, { text: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          if (row.text.trim().length === 0) return;
                          addRow(section.key);
                        }
                      }}
                      placeholder={section.placeholder}
                      className="min-h-8 border-0 bg-transparent px-2 py-1 text-[13px] shadow-none focus:ring-0"
                      aria-label={`${section.label} ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(section.key, index)}
                      aria-label={`Hapus ${section.label} ${index + 1}`}
                      className="mt-0.5 rounded-lg p-1.5 text-ink-soft/70 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 px-2 pb-0.5">
                    <Link2 className={cn("h-3 w-3 shrink-0", row.taskId ? "text-brand" : "text-slate-300")} />
                    <Select
                      value={row.taskId}
                      onChange={(event) => {
                        const linked = tasks.find((task) => task.id === event.target.value);
                        updateRow(section.key, index, {
                          taskId: event.target.value,
                          ...(linked?.project && !row.project.trim() ? { project: linked.project } : {}),
                        });
                        if (section.key === "plans") setTouchedPlan(true);
                      }}
                      aria-label={`Tautkan tugas untuk ${section.label} ${index + 1}`}
                      className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-[11px] text-ink-soft shadow-none focus:ring-0"
                    >
                      <option value="">Tanpa tautan tugas</option>
                      {memberTasks.length > 0 ? (
                        <optgroup label={`Tugas ${member.name}`}>
                          {memberTasks.map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.title} · {statusMeta(task.status).label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {otherTasks.length > 0 ? (
                        <optgroup label="Tugas anggota lain">
                          {otherTasks.map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.title} · {statusMeta(task.status).label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </Select>
                    <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
                    <MapPin className={cn("h-3 w-3 shrink-0", row.project.trim() ? "text-brand" : "text-slate-300")} />
                    <Input
                      value={row.project}
                      onChange={(event) => updateRow(section.key, index, { project: event.target.value })}
                      list="standup-project-options"
                      placeholder="Proyek / lokasi? (opsional)"
                      aria-label={`Proyek untuk ${section.label} ${index + 1}`}
                      className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 py-0 text-[11px] text-ink-soft shadow-none focus:ring-0"
                    />
                  </div>
                </div>
              ))}
            </div>
            {section.key === "plans" ? (
              <p className="mt-1 text-[11px] leading-snug text-ink-soft/80">
                {section.hint} Tautan tugas dan proyek opsional — biarkan kosong bila tidak perlu; laporan tetap masuk “Tanpa proyek / lokasi”.
              </p>
            ) : null}
          </div>
        );
      })}

      <datalist id="standup-project-options">
        {projects.map((project) => (
          <option key={project} value={project} />
        ))}
      </datalist>

      {touchedPlan ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-sky-50 px-2.5 py-2 text-[11px] leading-snug text-sky-800">
          <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
          Tautan tugas tersimpan pada catatan standup ini. Status tugas tetap diubah manual di layar Tugas.
        </p>
      ) : null}

      {error ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-2 text-[12px] font-medium text-rose-700">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-[11px] text-ink-soft">{totalRows} baris · kosongkan baris untuk mengabaikan</p>
        <div className="flex gap-2">
          <Button onClick={onCancel}>Batal</Button>
          <Button variant="primary" onClick={submit}>
            <Check className="h-4 w-4" /> Simpan standup
          </Button>
        </div>
      </div>
    </div>
  );
}
