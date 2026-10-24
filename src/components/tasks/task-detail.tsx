/* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi awal dengan localStorage / data tanggal Asia/Jakarta setelah mount. */
"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, ClipboardList, History, Link2, MapPin, Pencil, Save, X } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  Avatar,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Pill,
  StatusBadge,
  Textarea,
  cn,
  useToast,
} from "@/components/ui";
import { AssigneePicker } from "@/components/tasks/task-form";
import { TASK_STATUSES, type ItemKind, type TaskStatus } from "@/lib/types";
import { formatDateTime, formatLongDate, formatMediumDate, formatShortDate } from "@/lib/date";
import { isTaskOverdue, statusMeta, taskStandupUpdates } from "@/lib/tasks";

const KIND_META: Record<ItemKind, { label: string; className: string }> = {
  plan: { label: "Rencana", className: "border-slate-200 bg-slate-50 text-slate-700" },
  done: { label: "Selesai", className: "border-teal-200 bg-teal-50 text-teal-700" },
  blocker: { label: "Kendala", className: "border-amber-200 bg-amber-50 text-amber-800" },
};

export function TaskDetailModal({
  taskId,
  onClose,
}: {
  taskId: string | null;
  onClose: () => void;
}) {
  const { state, today, updateTask, changeTaskStatus } = useStore();
  const { notify } = useToast();
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  const [editing, setEditing] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    project: "",
    dueDate: "",
    notes: "",
    assigneeIds: [] as string[],
  });

  useEffect(() => {
    if (!task) return;
    setDraft({
      title: task.title,
      project: task.project ?? "",
      dueDate: task.dueDate ?? "",
      notes: task.notes ?? "",
      assigneeIds: task.assigneeIds,
    });
    setEditing(false);
    setStatusNote("");
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null;

  const updates = taskStandupUpdates(state, task.id);
  const assignees = state.members.filter((member) => task.assigneeIds.includes(member.id));
  const overdue = isTaskOverdue(task, today);
  const history = [...task.statusHistory].sort((a, b) => (a.at < b.at ? 1 : -1));

  const setStatus = (status: TaskStatus) => {
    if (status === task.status) return;
    changeTaskStatus(task.id, status, statusNote);
    notify(`Status tugas diubah menjadi ${statusMeta(status).label}.`);
    setStatusNote("");
  };

  const saveEdits = () => {
    if (draft.title.trim().length < 3) {
      notify("Judul tugas minimal 3 karakter.", "error");
      return;
    }
    if (draft.assigneeIds.length === 0) {
      notify("Pilih minimal satu penanggung jawab.", "error");
      return;
    }
    updateTask(task.id, {
      title: draft.title.trim(),
      project: draft.project.trim() || undefined,
      dueDate: draft.dueDate,
      notes: draft.notes.trim() || undefined,
      assigneeIds: draft.assigneeIds,
    });
    setEditing(false);
    notify("Perubahan tugas disimpan.");
  };

  return (
    <Modal
      open={Boolean(taskId)}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex flex-wrap items-center gap-2">
          Detail tugas
          <StatusBadge status={task.status} />
          {overdue ? (
            <Pill className="border-rose-200 bg-rose-50 text-rose-700">
              <CalendarClock className="h-3 w-3" /> Terlambat
            </Pill>
          ) : null}
        </span>
      }
      description={`Dibuat ${formatDateTime(task.createdAt)}`}
      footer={
        <>
          <Button onClick={onClose} className="mr-auto">
            Tutup
          </Button>
          {editing ? (
            <>
              <Button onClick={() => setEditing(false)}>
                <X className="h-4 w-4" /> Batal
              </Button>
              <Button variant="primary" onClick={saveEdits}>
                <Save className="h-4 w-4" /> Simpan perubahan
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Ubah tugas
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {editing ? (
          <div className="space-y-3 rounded-xl border border-line bg-[#fbfaf6] p-3">
            <Field label="Judul tugas" htmlFor="detail-title">
              <Input
                id="detail-title"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </Field>
            <div>
              <p className="mb-1 text-[12px] font-semibold text-ink">Penanggung jawab</p>
              <AssigneePicker
                members={state.members}
                selected={draft.assigneeIds}
                onToggle={(id) =>
                  setDraft((current) => ({
                    ...current,
                    assigneeIds: current.assigneeIds.includes(id)
                      ? current.assigneeIds.filter((item) => item !== id)
                      : [...current.assigneeIds, id],
                  }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Proyek / lokasi" htmlFor="detail-project">
                <Input
                  id="detail-project"
                  value={draft.project}
                  onChange={(event) => setDraft((current) => ({ ...current, project: event.target.value }))}
                  placeholder="Gedung A — CCTV"
                />
              </Field>
              <Field label="Tenggat" htmlFor="detail-due" hint="Tidak diisi otomatis dari tanggal standup.">
                <Input
                  id="detail-due"
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </Field>
            </div>
            <Field label="Catatan" htmlFor="detail-notes">
              <Textarea
                id="detail-notes"
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-16"
              />
            </Field>
          </div>
        ) : (
          <div>
            <h3 className="text-[15px] font-semibold leading-snug text-ink">{task.title}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-soft">
              {task.project ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {task.project}
                </span>
              ) : (
                <span className="text-slate-400">Tanpa proyek / lokasi</span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {task.dueDate ? (
                  <span className={overdue ? "font-medium text-rose-600" : ""}>
                    Tenggat {formatMediumDate(task.dueDate)}
                  </span>
                ) : (
                  "Tanpa tenggat"
                )}
              </span>
              <span className="inline-flex items-center gap-1">
                <ClipboardList className="h-3 w-3" /> Muncul di {updates.length} catatan standup
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {assignees.length > 0 ? (
                assignees.map((member) => (
                  <span
                    key={member.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-ink"
                  >
                    <Avatar name={member.name} accent={member.accent} size="xs" />
                    {member.name}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-amber-700">Belum ada penanggung jawab</span>
              )}
            </div>
            {task.notes ? (
              <p className="mt-2 rounded-xl border border-line bg-[#fbfaf6] px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
                {task.notes}
              </p>
            ) : null}
          </div>
        )}

        <div className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-ink">Ubah status</p>
            <span className="text-[10.5px] text-ink-soft">Setiap perubahan tercatat di riwayat</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {TASK_STATUSES.map((status, index) => {
              const meta = statusMeta(status);
              const active = task.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatus(status)}
                  disabled={active}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-lg border px-2 py-1.5 text-left transition-colors",
                    active
                      ? "border-brand bg-brand-soft text-brand-dark"
                      : "border-line bg-white text-ink-soft hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <span className="flex items-center gap-1 text-[11px] font-semibold">
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                  <span className="text-[9.5px] opacity-70">
                    {active ? "Status saat ini" : index === 3 ? "Selesai" : `Langkah ${index + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <Input
              value={statusNote}
              onChange={(event) => setStatusNote(event.target.value)}
              placeholder="Catatan perubahan status (opsional)"
              className="h-8 text-[11.5px]"
              aria-label="Catatan perubahan status"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                <ClipboardList className="h-3.5 w-3.5 text-brand" /> Riwayat standup
              </p>
              <span className="text-[10px] text-ink-soft">{updates.length}</span>
            </div>
            <p className="mt-0.5 text-[10.5px] leading-snug text-ink-soft">
              Teks di bawah adalah catatan pada tanggal tersebut. Status terkini: <span className="font-medium text-ink">{statusMeta(task.status).label}</span>.
            </p>
            <div className="mt-2 space-y-1.5">
              {updates.length === 0 ? (
                <EmptyState
                  title="Belum tertaut ke standup"
                  description="Tautkan tugas dari formulir standup agar riwayat per tanggal tercatat di sini."
                  className="border border-dashed border-line bg-[#fbfaf6] py-5"
                />
              ) : (
                updates.map((update) => (
                  <div key={`${update.entry.id}-${update.kind}-${update.item.id}`} className="rounded-lg border border-line bg-white px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10.5px] font-semibold text-ink">{formatShortDate(update.entry.date)}</span>
                      <span className={cn("rounded border px-1.5 py-0 text-[9.5px] font-semibold", KIND_META[update.kind].className)}>
                        {KIND_META[update.kind].label}
                      </span>
                      {update.member ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-ink-soft">
                          <Avatar name={update.member.name} accent={update.member.accent} size="xs" className="h-4 w-4 text-[8px]" />
                          {update.member.name}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-ink-soft">{update.item.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                <History className="h-3.5 w-3.5 text-brand" /> Riwayat status
              </p>
              <span className="text-[10px] text-ink-soft">{history.length}</span>
            </div>
            <p className="mt-0.5 text-[10.5px] text-ink-soft">Waktu dalam WIB.</p>
            <ol className="mt-2 space-y-0">
              {history.map((event, index) => (
                <li key={event.id} className="relative flex gap-2 pb-2.5">
                  <div className="flex flex-col items-center">
                    <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", statusMeta(event.status).dot)} />
                    {index < history.length - 1 ? <span className="mt-0.5 w-px flex-1 bg-line" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={event.status} size="xs" />
                      <span className="text-[10px] text-ink-soft">{formatDateTime(event.at)}</span>
                    </div>
                    {event.note ? <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{event.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-1 flex items-start gap-1.5 rounded-lg bg-sky-50 px-2 py-1.5 text-[10.5px] leading-snug text-sky-800">
              <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
              Standup dan tugas adalah catatan terpisah. Perubahan status tidak mengubah riwayat standup.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-2 text-[10px] text-ink-soft">
          <span>Tanggal standup tidak dipakai sebagai tenggat.</span>
          <span className="inline-flex items-center gap-1">
            Dibuat {formatLongDate(task.createdAt.slice(0, 10))} <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </Modal>
  );
}
