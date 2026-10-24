/* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi awal dengan localStorage / data tanggal Asia/Jakarta setelah mount. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, CheckCircle2, CircleSlash, Link2 } from "lucide-react";
import type { CarryCandidate } from "@/lib/tasks";
import { Avatar, Button, EmptyState, Modal, StatusBadge, cn } from "@/components/ui";
import { formatMediumDate, formatShortDate } from "@/lib/date";

export function CarryOverModal({
  open,
  onClose,
  date,
  candidates,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  candidates: CarryCandidate[];
  onApply: (picks: { memberId: string; taskId: string }[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) setSelected([]);
  }, [open, date]);

  const key = (candidate: CarryCandidate) => `${candidate.member.id}:${candidate.task.id}`;
  const selectable = useMemo(() => candidates.filter((candidate) => !candidate.alreadyPlanned), [candidates]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; accent: CarryCandidate["member"]["accent"]; role: string; items: CarryCandidate[] }>();
    candidates.forEach((candidate) => {
      const existing = map.get(candidate.member.id);
      if (existing) {
        existing.items.push(candidate);
      } else {
        map.set(candidate.member.id, {
          name: candidate.member.name,
          accent: candidate.member.accent,
          role: candidate.member.role,
          items: [candidate],
        });
      }
    });
    return Array.from(map.values());
  }, [candidates]);

  const toggle = (candidate: CarryCandidate) => {
    if (candidate.alreadyPlanned) return;
    const id = key(candidate);
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const picks = selected
    .map((id) => {
      const [memberId, taskId] = id.split(":");
      return { memberId, taskId };
    })
    .filter((pick) => pick.memberId && pick.taskId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bawa tugas belum selesai"
      description={`Pilih tugas yang masih berjalan untuk dimasukkan ke rencana ${formatMediumDate(date)}.`}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-[11px] text-ink-soft">
            {picks.length} dipilih · status tugas tidak diubah
          </span>
          <Button onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            disabled={picks.length === 0}
            onClick={() => {
              onApply(picks);
              setSelected([]);
              onClose();
            }}
          >
            <ArrowDownToLine className="h-4 w-4" /> Bawa {picks.length || ""} tugas
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand-dark">
          <CheckCircle2 className="h-3 w-3" /> Tidak menandai tugas selesai
        </span>
        <span className="inline-flex items-center gap-1">
          <CircleSlash className="h-3 w-3" /> {selectable.length} tugas bisa dibawa
        </span>
        {candidates.length > selectable.length ? (
          <span className="inline-flex items-center gap-1">
            <Link2 className="h-3 w-3" /> {candidates.length - selectable.length} sudah ada di rencana
          </span>
        ) : null}
      </div>

      {candidates.length === 0 ? (
        <EmptyState
          title="Tidak ada tugas tertunda"
          description="Semua tugas sudah selesai atau belum ada tugas aktif. Tambahkan tugas baru dari layar Tugas."
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.name}>
              <div className="mb-1.5 flex items-center gap-2">
                <Avatar name={group.name} accent={group.accent} size="xs" />
                <p className="text-[12px] font-semibold text-ink">{group.name}</p>
                <span className="text-[10px] text-ink-soft">{group.role}</span>
              </div>
              <ul className="space-y-1">
                {group.items.map((candidate) => {
                  const id = key(candidate);
                  const checked = selected.includes(id);
                  return (
                    <li key={id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-xl border px-2.5 py-2 transition-colors",
                          candidate.alreadyPlanned
                            ? "cursor-not-allowed border-dashed border-line bg-slate-50/60 opacity-70"
                            : checked
                              ? "border-teal-300 bg-brand-soft/70"
                              : "border-line bg-white hover:border-slate-300",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 accent-teal-700"
                          checked={checked}
                          disabled={candidate.alreadyPlanned}
                          onChange={() => toggle(candidate)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-medium leading-snug text-ink">
                            {candidate.task.title}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-ink-soft">
                            <StatusBadge status={candidate.task.status} size="xs" />
                            {candidate.task.project ? <span>{candidate.task.project}</span> : null}
                            {candidate.task.dueDate ? (
                              <span className={candidate.task.dueDate < date ? "text-rose-600" : ""}>
                                Tenggat {formatShortDate(candidate.task.dueDate)}
                              </span>
                            ) : (
                              <span>Tanpa tenggat</span>
                            )}
                            {candidate.lastDate ? <span>· Standup {formatShortDate(candidate.lastDate)}</span> : null}
                          </span>
                        </span>
                        {candidate.alreadyPlanned ? (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-500">
                            Sudah ada
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
