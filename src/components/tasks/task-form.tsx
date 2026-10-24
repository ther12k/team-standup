/* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi awal dengan localStorage / data tanggal Asia/Jakarta setelah mount. */
"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Search, UserPlus, X } from "lucide-react";
import type { Member, Task, TaskStatus } from "@/lib/types";
import { TASK_STATUSES } from "@/lib/types";
import { Avatar, Button, Field, Input, Modal, Select, Textarea, cn } from "@/components/ui";
import { statusMeta } from "@/lib/tasks";

export type TaskFormValues = {
  title: string;
  assigneeIds: string[];
  project: string;
  dueDate: string;
  notes: string;
  status: TaskStatus;
};

export function AssigneePicker({
  members,
  selected,
  onToggle,
  compact,
}: {
  members: Member[];
  selected: string[];
  onToggle: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", compact && "gap-1")}>
      {members.map((member) => {
        const active = selected.includes(member.id);
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => onToggle(member.id)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-1 text-[11.5px] font-medium transition-colors",
              active
                ? "border-brand bg-brand-soft text-brand-dark"
                : "border-line bg-white text-ink-soft hover:border-slate-300 hover:text-ink",
            )}
          >
            <Avatar name={member.name} accent={member.accent} size="xs" />
            <span className="max-w-[110px] truncate">{member.name.split(" ")[0]}</span>
            {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3 opacity-40" />}
          </button>
        );
      })}
    </div>
  );
}

export function TaskCreateModal({
  open,
  onClose,
  members,
  projects,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  members: Member[];
  projects: string[];
  onCreate: (values: TaskFormValues) => void;
}) {
  const [values, setValues] = useState<TaskFormValues>({
    title: "",
    assigneeIds: [],
    project: "",
    dueDate: "",
    notes: "",
    status: "belum",
  });
  const [errors, setErrors] = useState<{ title?: string; assignee?: string }>({});

  useEffect(() => {
    if (!open) {
      setValues({ title: "", assigneeIds: [], project: "", dueDate: "", notes: "", status: "belum" });
      setErrors({});
    }
  }, [open]);

  const submit = () => {
    const nextErrors: { title?: string; assignee?: string } = {};
    if (values.title.trim().length < 3) nextErrors.title = "Judul tugas minimal 3 karakter.";
    if (values.assigneeIds.length === 0) nextErrors.assignee = "Pilih minimal satu penanggung jawab.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onCreate(values);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tugas baru"
      description="Tugas berdiri sendiri dan bisa ditautkan ke banyak standup harian."
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={submit}>
            <Check className="h-4 w-4" /> Simpan tugas
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Judul tugas" htmlFor="task-title" error={errors.title} hint="Tulis satu pekerjaan yang jelas dan spesifik.">
          <Input
            id="task-title"
            value={values.title}
            onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
            placeholder="Contoh: Ganti housing kamera lorong 2"
            autoFocus
          />
        </Field>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-ink">Penanggung jawab</p>
            <span className="text-[11px] text-ink-soft">{values.assigneeIds.length} dipilih</span>
          </div>
          <AssigneePicker
            members={members}
            selected={values.assigneeIds}
            onToggle={(id) =>
              setValues((current) => ({
                ...current,
                assigneeIds: current.assigneeIds.includes(id)
                  ? current.assigneeIds.filter((item) => item !== id)
                  : [...current.assigneeIds, id],
              }))
            }
          />
          {errors.assignee ? <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.assignee}</p> : null}
          {members.length === 0 ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
              <UserPlus className="h-3 w-3" /> Tambah anggota dulu di layar Standup.
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Proyek / lokasi" htmlFor="task-project" hint="Opsional">
            <Input
              id="task-project"
              list="project-options"
              value={values.project}
              onChange={(event) => setValues((current) => ({ ...current, project: event.target.value }))}
              placeholder="Gedung A — CCTV"
            />
            <datalist id="project-options">
              {projects.map((project) => (
                <option key={project} value={project} />
              ))}
            </datalist>
          </Field>
          <Field label="Tenggat" htmlFor="task-due" hint="Opsional. Tidak diisi otomatis dari tanggal standup.">
            <Input
              id="task-due"
              type="date"
              value={values.dueDate}
              onChange={(event) => setValues((current) => ({ ...current, dueDate: event.target.value }))}
            />
          </Field>
        </div>

        <Field label="Status awal" htmlFor="task-status">
          <Select
            id="task-status"
            value={values.status}
            onChange={(event) => setValues((current) => ({ ...current, status: event.target.value as TaskStatus }))}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusMeta(status).label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Catatan" htmlFor="task-notes" hint="Opsional — konteks, kendala, atau syarat penyelesaian.">
          <Textarea
            id="task-notes"
            value={values.notes}
            onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Stok housing baru ada 2 unit di gudang."
            className="min-h-16"
          />
        </Field>
      </div>
    </Modal>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 items-center gap-1.5 rounded-xl border border-line bg-white px-2 py-1.5 shadow-sm">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-soft/80">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-1 text-[12px] font-medium text-ink focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Cari judul, proyek, atau catatan…"
        aria-label="Cari tugas"
        className="h-9 w-full rounded-xl border border-line bg-white pl-8 pr-8 text-[12.5px] text-ink shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Bersihkan pencarian"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-soft hover:bg-slate-100 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function TaskListItem({
  task,
  members,
  standupCount,
  today,
  onOpen,
}: {
  task: Task;
  members: Member[];
  standupCount: number;
  today: string;
  onOpen: () => void;
}) {
  const assignees = members.filter((member) => task.assigneeIds.includes(member.id));
  const overdue = Boolean(task.dueDate && task.status !== "selesai" && (task.dueDate as string) < today);
  const meta = statusMeta(task.status);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-start gap-3 rounded-xl border border-line bg-white p-3 text-left shadow-sm transition-colors hover:border-teal-300 hover:bg-[#fdfdfb]"
    >
      <span className={cn("mt-0.5 w-1 shrink-0 self-stretch rounded-full", meta.dot)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p
            className={cn(
              "text-[13px] font-semibold leading-snug text-ink",
              task.status === "selesai" && "text-ink-soft line-through decoration-slate-300",
            )}
          >
            {task.title}
          </p>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
              meta.chip,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} /> {meta.label}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-ink-soft">
          {task.project ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{task.project}</span>
          ) : (
            <span className="text-slate-400">Tanpa proyek</span>
          )}
          {task.dueDate ? (
            <span className={cn("font-medium", overdue ? "text-rose-600" : "text-ink-soft")}>
              {overdue ? "Terlambat · " : "Tenggat "}
              {task.dueDate.split("-").reverse().join("/")}
            </span>
          ) : (
            <span>Tanpa tenggat</span>
          )}
          <span className="inline-flex items-center gap-1">
            {assignees.slice(0, 3).map((member) => (
              <Avatar key={member.id} name={member.name} accent={member.accent} size="xs" className="ring-1 ring-white" />
            ))}
            <span className="max-w-[130px] truncate">{assignees.map((member) => member.name.split(" ")[0]).join(", ") || "Tanpa PIC"}</span>
          </span>
          <span className="text-slate-400">·</span>
          <span>{standupCount} standup</span>
        </div>
      </div>
    </button>
  );
}
