"use client";

import { Link } from "@/components/link";
import { ArrowRight, Check, ChevronRight, Link2, MapPin, Pencil, Plus } from "lucide-react";
import type { ItemKind, Member, StandupEntry, StandupItem, Task } from "@/lib/types";
import { Avatar, Button, Card, StatusBadge, cn } from "@/components/ui";
import { formatClock } from "@/lib/date";
import { statusMeta } from "@/lib/tasks";
import type { EntryDraft } from "@/lib/store";
import { EntryEditor } from "@/components/standup/entry-editor";

const TONES: Record<ItemKind, { dot: string; label: string; box: string }> = {
  plan: { dot: "bg-brand", label: "text-brand-dark", box: "" },
  done: { dot: "bg-teal-500", label: "text-teal-700", box: "" },
  blocker: { dot: "bg-amber-500", label: "text-amber-800", box: "rounded-lg bg-amber-50/70 px-2 py-1.5" },
};

function LinkedTask({ task }: { task: Task }) {
  return (
    <Link
      href={`/tugas?open=${task.id}`}
      className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-slate-50/80 px-1.5 py-0.5 text-[10.5px] leading-4 text-ink-soft transition-colors hover:border-teal-300 hover:bg-brand-soft/60 hover:text-ink"
      title={`Status tugas saat ini: ${statusMeta(task.status).label}`}
    >
      <Link2 className="h-2.5 w-2.5 shrink-0 text-slate-400 group-hover:text-brand" />
      <span className="truncate">{task.title}</span>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusMeta(task.status).dot)} aria-hidden />
    </Link>
  );
}

function EntrySection({
  kind,
  items,
  tasks,
  onMoveToDone,
}: {
  kind: ItemKind;
  items: StandupItem[];
  tasks: Task[];
  onMoveToDone?: (item: StandupItem) => void;
}) {
  if (items.length === 0) return null;
  const tone = TONES[kind];
  const label = kind === "plan" ? "Rencana" : kind === "done" ? "Selesai" : "Kendala";
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden />
        <p className={cn("text-[10.5px] font-semibold uppercase tracking-[0.08em]", tone.label)}>{label}</p>
        <span className="text-[10px] text-ink-soft/60">{items.length}</span>
      </div>
      <ul className={cn("mt-1 space-y-1", tone.box)}>
        {items.map((item) => {
          const task = item.taskId ? tasks.find((candidate) => candidate.id === item.taskId) : undefined;
          return (
            <li key={item.id} className="group/item flex items-start gap-1.5">
              {kind === "done" ? (
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-teal-600" aria-hidden />
              ) : (
                <span
                  className={cn(
                    "mt-1.5 h-1 w-1 shrink-0 rounded-full",
                    kind === "blocker" ? "bg-amber-500" : "bg-slate-400",
                  )}
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] leading-[1.45] text-ink">{item.text}</p>
                {(item.project ?? task?.project) ? (
                  <span className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-600">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{item.project ?? task?.project}</span>
                  </span>
                ) : null}
                {task ? <div className="mt-0.5"><LinkedTask task={task} /></div> : null}
              </div>
              {kind === "plan" && onMoveToDone ? (
                <button
                  type="button"
                  onClick={() => onMoveToDone(item)}
                  title="Pindahkan ke Selesai (hanya catatan standup, status tugas tidak berubah)"
                  aria-label={`Pindahkan "${item.text}" ke Selesai`}
                  className="mt-0.5 shrink-0 rounded-md border border-transparent p-1 text-slate-300 transition-colors hover:border-line hover:bg-white hover:text-teal-600 sm:opacity-0 sm:group-hover/item:opacity-100"
                >
                  <Check className="h-3 w-3" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MemberEntryCard({
  member,
  entry,
  date,
  tasks,
  projects,
  editing,
  inactive,
  onEdit,
  onCancel,
  onSave,
  onMoveToDone,
}: {
  member: Member;
  entry?: StandupEntry;
  date: string;
  tasks: Task[];
  projects: string[];
  editing: boolean;
  inactive?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (draft: EntryDraft) => void;
  onMoveToDone: (item: StandupItem) => void;
}) {
  const itemCount = entry ? entry.plans.length + entry.done.length + entry.blockers.length : 0;
  const filled = itemCount > 0;

  return (
    <Card
      as="article"
      className={cn(
        "flex h-full flex-col p-3.5 transition-shadow sm:p-4",
        editing && "ring-2 ring-brand/30",
        !filled && !editing && "bg-white/70",
        inactive && !editing && "opacity-75",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={member.name} accent={member.accent} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[13.5px] font-semibold leading-tight text-ink">{member.name}</h3>
            {inactive ? (
              <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0 text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
                Non-aktif
              </span>
            ) : null}
            {entry?.source === "import" || entry?.source === "live" ? (
              <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0 text-[9.5px] font-semibold uppercase tracking-wide text-violet-700">
                {entry.source === "live" ? "Live" : "Impor"}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11px] text-ink-soft">{member.role}</p>
        </div>
        {!editing ? (
          <Button variant="ghost" size="xs" onClick={onEdit} className="-mr-1 shrink-0">
            {filled ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {filled ? "Ubah" : "Isi"}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3">
          <EntryEditor
            key={`${date}-${member.id}`}
            member={member}
            entry={entry}
            date={date}
            tasks={tasks}
            projects={projects}
            onCancel={onCancel}
            onSave={onSave}
          />
        </div>
      ) : filled && entry ? (
        <div className="mt-3 flex flex-1 flex-col gap-2.5">
          <EntrySection kind="plan" items={entry.plans} tasks={tasks} onMoveToDone={onMoveToDone} />
          <EntrySection kind="done" items={entry.done} tasks={tasks} />
          <EntrySection kind="blocker" items={entry.blockers} tasks={tasks} />
          <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[10px] text-ink-soft/70">
            <span>Diperbarui {formatClock(entry.updatedAt)} WIB</span>
            <span className="inline-flex items-center gap-1">
              {entry.plans.length}R · {entry.done.length}S · {entry.blockers.length}K
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-1 flex-col justify-center rounded-xl border border-dashed border-line bg-[#fbfaf6]/60 px-3 py-4 text-center">
          <p className="text-[12.5px] font-medium text-ink">Belum mengisi standup</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">
            Catat rencana, pekerjaan selesai, atau kendala {entry ? "untuk tanggal ini" : "hari ini"}.
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="mx-auto mt-2 inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-brand-dark shadow-sm transition-colors hover:border-teal-300 hover:bg-brand-soft"
          >
            Isi standup <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </Card>
  );
}

export function TaskPeekRow({ task, onAdd, disabled }: { task: Task; onAdd: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-line/80 bg-white px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium leading-snug text-ink">{task.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <StatusBadge status={task.status} size="xs" />
          {task.project ? <span className="truncate text-[10px] text-ink-soft">{task.project}</span> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={`Bawa tugas ${task.title}`}
        title={disabled ? "Sudah ada di rencana tanggal ini" : "Tambahkan ke rencana"}
        className="mt-0.5 shrink-0 rounded-md border border-line bg-white p-1 text-ink-soft transition-colors hover:border-teal-300 hover:bg-brand-soft hover:text-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
