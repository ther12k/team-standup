/* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi awal dengan localStorage / data tanggal Asia/Jakarta setelah mount. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CircleDashed,
  FilterX,
  LayoutGrid,
  List,
  ListChecks,
  Plus,
  Timer,
  Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  Avatar,
  Button,
  Card,
  ChipButton,
  EmptyState,
  PageLoading,
  StatCard,
  cn,
  useToast,
} from "@/components/ui";
import {
  FilterSelect,
  SearchBox,
  TaskCreateModal,
  TaskListItem,
  type TaskFormValues,
} from "@/components/tasks/task-form";
import { TaskDetailModal } from "@/components/tasks/task-detail";
import type { TaskStatus } from "@/lib/types";
import { TASK_STATUSES } from "@/lib/types";
import { formatMediumDate, formatShortDate } from "@/lib/date";
import { isTaskOverdue, statusMeta, taskStandupDates } from "@/lib/tasks";

type SortOption = "due" | "recent" | "status";

export default function TugasPage() {
  const { state, hydrated, today, createTask } = useStore();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [status, setStatus] = useState<"all" | TaskStatus>("all");
  const [project, setProject] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("due");
  const [view, setView] = useState<"list" | "board">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const openedFromQuery = useRef(false);

  useEffect(() => {
    if (openedFromQuery.current) return;
    openedFromQuery.current = true;
    const id = new URLSearchParams(window.location.search).get("open");
    if (id) setSelectedId(id);
  }, []);

  const projects = useMemo(
    () => Array.from(new Set(state.tasks.map((task) => task.project).filter((value): value is string => Boolean(value)))).sort(),
    [state.tasks],
  );

  const standupCount = useMemo(() => {
    const map = new Map<string, number>();
    state.tasks.forEach((task) => map.set(task.id, taskStandupDates(state, task.id).length));
    return map;
  }, [state]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = state.tasks.filter((task) => {
      if (assignee !== "all" && !task.assigneeIds.includes(assignee)) return false;
      if (status !== "all" && task.status !== status) return false;
      if (project !== "all" && (task.project ?? "") !== project) return false;
      if (overdueOnly && !isTaskOverdue(task, today)) return false;
      if (!query) return true;
      const assigneeNames = state.members
        .filter((member) => task.assigneeIds.includes(member.id))
        .map((member) => member.name.toLowerCase())
        .join(" ");
      return `${task.title} ${task.project ?? ""} ${task.notes ?? ""} ${assigneeNames}`.toLowerCase().includes(query);
    });

    return list.sort((a, b) => {
      if (sort === "recent") return a.createdAt < b.createdAt ? 1 : -1;
      if (sort === "status") return TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status);
      const aDue = a.dueDate ?? "9999-12-31";
      const bDue = b.dueDate ?? "9999-12-31";
      return aDue.localeCompare(bDue);
    });
  }, [state.tasks, state.members, search, assignee, status, project, overdueOnly, sort, today]);

  if (!hydrated) return <PageLoading />;

  const overdueCount = state.tasks.filter((task) => isTaskOverdue(task, today)).length;
  const hasFilters = Boolean(search || assignee !== "all" || status !== "all" || project !== "all" || overdueOnly);

  const resetFilters = () => {
    setSearch("");
    setAssignee("all");
    setStatus("all");
    setProject("all");
    setOverdueOnly(false);
  };

  const handleCreate = (values: TaskFormValues) => {
    const task = createTask({
      title: values.title,
      assigneeIds: values.assigneeIds,
      project: values.project,
      dueDate: values.dueDate,
      notes: values.notes,
      status: values.status,
    });
    if (task) {
      notify("Tugas baru dibuat.");
      setSelectedId(task.id);
    } else {
      notify("Tugas gagal dibuat. Periksa judul dan penanggung jawab.", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
            <ListChecks className="h-3.5 w-3.5" /> Pelacakan pekerjaan
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[26px]">Tugas</h1>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Satu tugas dapat muncul di banyak standup. Riwayat per tanggal tetap utuh.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Tugas baru
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total tugas" value={state.tasks.length} icon={<ListChecks className="h-4 w-4" />} />
        <StatCard
          label="Dikerjakan"
          value={state.tasks.filter((task) => task.status === "dikerjakan").length}
          tone="sky"
          icon={<Timer className="h-4 w-4" />}
        />
        <StatCard
          label="Terhambat"
          value={state.tasks.filter((task) => task.status === "terhambat").length}
          tone="amber"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Terlambat"
          value={overdueCount}
          hint="Lewat tenggat, belum selesai"
          tone={overdueCount > 0 ? "rose" : "neutral"}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>

      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBox value={search} onChange={setSearch} />
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-xl border border-line bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                aria-label="Tampilan daftar"
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium transition-colors",
                  view === "list" ? "bg-brand-soft text-brand-dark" : "text-ink-soft hover:text-ink",
                )}
              >
                <List className="h-3.5 w-3.5" /> Daftar
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                aria-pressed={view === "board"}
                aria-label="Tampilan papan"
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium transition-colors",
                  view === "board" ? "bg-brand-soft text-brand-dark" : "text-ink-soft hover:text-ink",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Papan
              </button>
            </div>
            <label className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-2 py-1.5 text-[11px] text-ink-soft shadow-sm">
              <span className="text-[10px] font-semibold uppercase tracking-wide">Urut</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortOption)}
                className="cursor-pointer appearance-none bg-transparent bg-no-repeat bg-right bg-[length:12px] pr-5 text-[12px] font-medium text-ink focus:outline-none"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7c6e' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                }}
                aria-label="Urutkan tugas"
              >
                <option value="due">Tenggat</option>
                <option value="recent">Terbaru</option>
                <option value="status">Status</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect
            label="PIC"
            value={assignee}
            onChange={setAssignee}
            options={[
              { value: "all", label: "Semua anggota" },
              ...state.members.map((member) => ({ value: member.id, label: member.name })),
            ]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as "all" | TaskStatus)}
            options={[
              { value: "all", label: "Semua status" },
              ...TASK_STATUSES.map((item) => ({ value: item, label: statusMeta(item).label })),
            ]}
          />
          <FilterSelect
            label="Proyek"
            value={project}
            onChange={setProject}
            options={[
              { value: "all", label: "Semua proyek" },
              ...projects.map((item) => ({ value: item, label: item })),
              { value: "", label: "Tanpa proyek" },
            ]}
          />
          <ChipButton active={overdueOnly} onClick={() => setOverdueOnly((current) => !current)}>
            <CalendarClock className="h-3 w-3" /> Terlambat
          </ChipButton>
          {hasFilters ? (
            <Button size="xs" variant="ghost" onClick={resetFilters}>
              <FilterX className="h-3.5 w-3.5" /> Hapus filter
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11.5px] text-ink-soft">
          <span className="font-semibold text-ink">{filtered.length}</span> tugas ditampilkan
          {hasFilters ? " sesuai filter" : ""}
        </p>
        <p className="hidden items-center gap-1 text-[11px] text-ink-soft sm:flex">
          <Users className="h-3 w-3" /> Asia/Jakarta · {formatShortDate(today)}
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title={hasFilters ? "Tidak ada tugas yang cocok" : "Belum ada tugas"}
            description={
              hasFilters
                ? "Coba ubah kata kunci, anggota, status, atau filter proyek."
                : "Buat tugas pertama agar bisa ditautkan ke catatan standup harian."
            }
            icon={<CircleDashed className="h-5 w-5" />}
            action={
              hasFilters ? (
                <Button onClick={resetFilters}>
                  <FilterX className="h-4 w-4" /> Hapus filter
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> Tugas baru
                </Button>
              )
            }
          />
        </Card>
      ) : view === "list" ? (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskListItem
              key={task.id}
              task={task}
              members={state.members}
              standupCount={standupCount.get(task.id) ?? 0}
              today={today}
              onOpen={() => setSelectedId(task.id)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((columnStatus) => {
            const meta = statusMeta(columnStatus);
            const columnTasks = filtered.filter((task) => task.status === columnStatus);
            return (
              <section key={columnStatus} className="rounded-xl border border-line bg-white/60 p-2">
                <header className="flex items-center justify-between gap-2 px-1 pb-2">
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
                    <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft ring-1 ring-line">
                    {columnTasks.length}
                  </span>
                </header>
                <div className="space-y-1.5">
                  {columnTasks.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line px-2 py-4 text-center text-[10.5px] text-ink-soft/70">
                      Tidak ada tugas
                    </p>
                  ) : (
                    columnTasks.map((task) => {
                      const assignees = state.members.filter((member) => task.assigneeIds.includes(member.id));
                      const overdue = isTaskOverdue(task, today);
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setSelectedId(task.id)}
                          className="w-full rounded-lg border border-line bg-white p-2 text-left shadow-sm transition-colors hover:border-teal-300"
                        >
                          <p className="text-[12px] font-semibold leading-snug text-ink">{task.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-ink-soft">
                            {task.project ? (
                              <span className="rounded bg-slate-100 px-1 py-0.5 font-medium text-slate-600">{task.project}</span>
                            ) : null}
                            <span className={cn(overdue && "font-medium text-rose-600")}>
                              {task.dueDate ? `${overdue ? "Terlambat · " : ""}${formatMediumDate(task.dueDate)}` : "Tanpa tenggat"}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-1">
                            <div className="flex -space-x-1">
                              {assignees.slice(0, 3).map((member) => (
                                <Avatar
                                  key={member.id}
                                  name={member.name}
                                  accent={member.accent}
                                  size="xs"
                                  className="ring-1 ring-white"
                                />
                              ))}
                            </div>
                            <span className="text-[9.5px] text-ink-soft">{standupCount.get(task.id) ?? 0} standup</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TaskCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        members={state.members}
        projects={projects}
        onCreate={handleCreate}
      />
      <TaskDetailModal taskId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
