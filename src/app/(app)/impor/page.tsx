"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  FileUp,
  Info,
  Layers,
  Link2,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { ImportDecision, ImportSummary } from "@/lib/import-apply";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageLoading,
  Pill,
  SectionLabel,
  Select,
  StatCard,
  cn,
  useToast,
} from "@/components/ui";
import {
  contentFingerprint,
  normalizeMemberName,
  suggestMemberName,
  type ParseFlag,
  type ParsedMember,
  type ParsedReport,
} from "@/lib/import-parser";
import { parseStandupText } from "@/lib/chat-extract";
import { addDays, formatDateTime, formatMediumDate, formatShortDate, isValidISODate } from "@/lib/date";
import type { ItemKind } from "@/lib/types";
import { statusMeta } from "@/lib/tasks";

const NEW_MEMBER = "__new__";
const SKIP_MEMBER = "__skip__";
const CREATE_TASK = "__create__";

type ActivityDraft = { id: string; kind: ItemKind; text: string; taskId: string; review?: string };
type MemberDraft = {
  id: string;
  sourceName: string;
  memberId: string;
  newName: string;
  newRole: string;
  review?: string;
  activities: ActivityDraft[];
};
type ReportDraft = {
  id: string;
  reportDate: string;
  dateText: string | null;
  originalText: string;
  sourceAt?: string;
  fingerprint: string;
  flags: ParseFlag[];
  members: MemberDraft[];
};

const KIND_OPTIONS: { value: ItemKind; label: string }[] = [
  { value: "plan", label: "Rencana" },
  { value: "done", label: "Pekerjaan Sebelumnya" },
  { value: "blocker", label: "Kendala" },
];

/** Warna pil jenis aktivitas — selaras dengan chip editor standup/Live. */
const KIND_STYLE: Record<ItemKind, string> = {
  plan: "border-sky-200 bg-sky-50 text-sky-700",
  done: "border-teal-200 bg-brand-soft text-brand-dark",
  blocker: "border-amber-200 bg-amber-50 text-amber-700",
};

let localId = 0;
function nextId(prefix: string): string {
  localId += 1;
  return `${prefix}-${localId}`;
}

function toDraftMember(member: ParsedMember, members: { id: string; name: string }[]): MemberDraft {
  const matched = member.matchedMemberId ?? NEW_MEMBER;
  return {
    id: nextId("md"),
    sourceName: member.sourceName,
    memberId: matched,
    newName: member.matchedMemberId ? "" : suggestMemberName(member.sourceName),
    newRole: "Anggota tim",
    review: member.review,
    activities: member.activities.map((activity) => ({
      id: nextId("ad"),
      kind: activity.kind,
      text: activity.text,
      taskId: "",
      review: activity.review,
    })),
  };
}

function toDraftReport(report: ParsedReport, members: { id: string; name: string }[]): ReportDraft {
  return {
    id: report.id,
    reportDate: report.reportDate ?? "",
    dateText: report.dateText,
    originalText: report.originalText,
    sourceAt: report.sourceAt,
    fingerprint: report.fingerprint,
    flags: report.flags,
    members: report.members.map((member) => toDraftMember(member, members)),
  };
}

/** Peran awal saat anggota baru dibuat dari impor chat. Masih bisa diedit. */
const ROLE_HINTS: Record<string, string> = {
  bima: "Software Engineer",
  sinta: "Software Engineer",
  galang: "Software Engineer",
  damar: "Software Engineer",
  hana: "Implementation Engineer",
  jodi: "Implementation Engineer",
  kirana: "Implementation Engineer",
  raka: "Implementation Engineer",
};

export function prefillRole(name: string): string {
  const key = normalizeMemberName(name);
  const hit = Object.keys(ROLE_HINTS).find((hint) => normalizeMemberName(hint) === key);
  return hit ? ROLE_HINTS[hit] : "Tim Operasional";
}

function buildDecision(draft: ReportDraft, roleOverrides: Record<string, string> = {}, options: { skipTeamNotes?: boolean } = {}): ImportDecision {
  return {
    reportDate: draft.reportDate,
    originalText: draft.originalText,
    sourceAt: draft.sourceAt,
    members: draft.members
      .filter((member) => member.memberId !== SKIP_MEMBER)
      .filter((member) => !(options.skipTeamNotes && member.sourceName === "Tanpa nama"))
      .map((member) => {
        const newName = member.newName.trim();
        return {
          sourceName: member.sourceName,
          memberId: member.memberId === NEW_MEMBER ? null : member.memberId,
          createMember:
            member.memberId === NEW_MEMBER
              ? {
                  name: newName,
                  role: roleOverrides[normalizeMemberName(newName)] ?? (member.newRole.trim() || "Anggota tim"),
                }
              : undefined,
          activities: member.activities
            .filter((activity) => activity.text.trim().length > 0)
            .map((activity) => ({
              kind: activity.kind,
              text: activity.text.trim(),
              taskId: activity.taskId && activity.taskId !== CREATE_TASK ? activity.taskId : undefined,
              createTask:
                activity.taskId === CREATE_TASK ? { title: activity.text.trim() } : undefined,
            })),
        };
      }),
  };
}

function FlagRow({ flag }: { flag: ParseFlag }) {
  const tone =
    flag.level === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : flag.level === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-sky-200 bg-sky-50 text-sky-800";
  const Icon = flag.level === "error" ? ShieldAlert : flag.level === "warning" ? AlertTriangle : Info;
  return (
    <li className={cn("flex items-start gap-1.5 rounded-lg border px-2 py-1 text-[11px] leading-snug", tone)}>
      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{flag.message}</span>
    </li>
  );
}

export default function ImporPage() {
  const { state, hydrated, today, runImport } = useStore();
  const { notify } = useToast();
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<ReportDraft[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [reportErrors, setReportErrors] = useState<Record<string, string>>({});
  const [viewingImportId, setViewingImportId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkRoles, setBulkRoles] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const imports = useMemo(
    () => [...state.imports].sort((a, b) => (a.importedAt < b.importedAt ? 1 : -1)),
    [state.imports],
  );
  const viewingImport = imports.find((record) => record.id === viewingImportId) ?? null;

  // Anggota baru unik di seluruh draf (kunci: nama ternormalisasi) untuk langkah tinjauan sekali.
  const newMembers = useMemo(() => {
    const map = new Map<string, { key: string; name: string; role: string }>();
    drafts.forEach((draft) =>
      draft.members.forEach((member) => {
        if (member.memberId !== NEW_MEMBER) return;
        // Catatan bagian tim tanpa pemilik ("Tanpa nama") tidak dijadikan anggota.
        if (member.sourceName === "Tanpa nama") return;
        const name = (member.newName.trim() || suggestMemberName(member.sourceName)).trim();
        if (!name) return;
        const key = normalizeMemberName(name);
        if (!map.has(key)) map.set(key, { key, name, role: bulkRoles[key] ?? prefillRole(name) });
      }),
    );
    return [...map.values()];
    // bulkRoles sengaja bukan dependensi: memo dipakai untuk pratinjau modal saat terbuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

  if (!hydrated) return <PageLoading />;

  const sampleText = [
    `💬 Report Daily Stand Up – ${formatShortDate(addDays(today, -1))}`,
    "📅 Rencana Kerja Hari Ini",
    "👷 Bang Bima",
    "• lanjut penyempurnaan modul laporan penjualan",
    "• review pull request fitur diskon",
    "👷 Bang Sinta",
    "• tulis pengujian otomatis alur pendaftaran",
    "• rapikan dokumentasi API",
    "✅ Pekerjaan Selesai",
    "👷 Bang Sinta",
    "• perbaiki bug validasi formulir pelanggan",
    "⛔ Kendala",
    "👷 Bang Bima",
    "• lingkungan staging kadang lambat saat deploy",
    "👷 Bang Galang",
    "• menunggu konfirmasi jadwal survei lokasi pelanggan",
  ].join("\n");

  const analyze = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setParseError("Tempel teks laporan terlebih dahulu, atau unggah berkas .txt.");
      return;
    }
    const result = parseStandupText(trimmed, state.members);
    setParseError(
      result.reports.length === 0
        ? result.chat
          ? "Ekspor chat terbaca, tetapi tidak ada pesan berformat laporan standup di dalamnya."
          : "Tidak ada struktur laporan yang dikenali. Pastikan ada baris judul laporan dan tanggal, mis. “Report Daily Stand Up – 13/10/2026”."
        : null,
    );
    setDrafts(result.reports.map((report) => toDraftReport(report, state.members)));
    setIgnored(result.ignoredLines);
    setReportErrors({});
    if (result.reports.length > 0) {
      const activityCount = result.reports.reduce(
        (total, report) => total + report.members.reduce((sum, member) => sum + member.activities.length, 0),
        0,
      );
      notify(
        result.chat
          ? `Ekspor grup chat: ${result.chat.messageCount} pesan dipindai, ${result.reports.length} laporan terbaca · ${activityCount} aktivitas.${result.chat.dateCorrected > 0 ? ` ${result.chat.dateCorrected} tanggal judul ≠ waktu kirim — dikoreksi ke waktu kirim, periksa pratinjau.` : ""}${result.chat.dateLatePost > 0 ? ` ${result.chat.dateLatePost} laporan terkirim sehari setelah tanggal judul — ditandai.` : ""}`
          : `${result.reports.length} laporan terbaca · ${activityCount} aktivitas. Periksa pratinjau sebelum menyimpan.`,
        "info",
      );
    }
  };

  const handleFile = async (file: File) => {
    if (!/\.txt$|text\/plain/i.test(file.name) && file.type !== "text/plain") {
      setParseError("Berkas harus berupa teks biasa (.txt).");
      return;
    }
    try {
      const content = await file.text();
      setText(content);
      analyze(content);
    } catch {
      setParseError("Gagal membaca berkas. Coba tempel teksnya secara manual.");
    }
  };

  const updateDraft = (reportId: string, producer: (draft: ReportDraft) => ReportDraft) => {
    setDrafts((current) => current.map((draft) => (draft.id === reportId ? producer(draft) : draft)));
  };

  const updateMember = (reportId: string, memberId: string, producer: (member: MemberDraft) => MemberDraft) => {
    updateDraft(reportId, (draft) => ({
      ...draft,
      members: draft.members.map((member) => (member.id === memberId ? producer(member) : member)),
    }));
  };

  const duplicateOf = (draft: ReportDraft) => {
    if (!isValidISODate(draft.reportDate)) return null;
    const groups = draft.members
      .filter((member) => member.memberId !== SKIP_MEMBER)
      .map((member) => ({
        key: member.memberId === NEW_MEMBER ? `new:${member.newName}` : member.memberId,
        activities: member.activities.filter((activity) => activity.text.trim().length > 0),
      }))
      .filter((group) => group.activities.length > 0);
    if (groups.length === 0) return null;
    const fingerprint = contentFingerprint(draft.reportDate, groups);
    return state.imports.find((record) => record.fingerprint === fingerprint) ?? null;
  };

  const validateDraft = (draft: ReportDraft): string | null => {
    if (!isValidISODate(draft.reportDate)) return "Tanggal laporan belum diisi. Tanggal tidak boleh ditebak.";
    const keptMembers = draft.members.filter((member) => member.memberId !== SKIP_MEMBER);
    if (keptMembers.length === 0) return "Petakan minimal satu anggota.";
    const unresolved = keptMembers.find(
      (member) => member.memberId === NEW_MEMBER && member.newName.trim().length < 2,
    );
    if (unresolved) return "Nama anggota baru belum lengkap.";
    const activityCount = keptMembers.reduce(
      (total, member) => total + member.activities.filter((activity) => activity.text.trim().length > 0).length,
      0,
    );
    if (activityCount === 0) return "Tidak ada aktivitas untuk disimpan.";
    return null;
  };

  const saveDraft = (draft: ReportDraft) => {
    const error = validateDraft(draft);
    if (error) {
      setReportErrors((current) => ({ ...current, [draft.id]: error }));
      return;
    }
    const summary: ImportSummary = runImport(buildDecision(draft));
    const parts = [
      `${summary.itemsAdded} aktivitas baru`,
      summary.itemsSkipped > 0 ? `${summary.itemsSkipped} duplikat dilewati` : null,
      summary.membersCreated > 0 ? `${summary.membersCreated} anggota baru` : null,
      summary.tasksCreated > 0 ? `${summary.tasksCreated} tugas dibuat` : null,
    ].filter(Boolean);

    if (summary.saved) {
      notify(`Laporan ${formatMediumDate(draft.reportDate)} disimpan: ${parts.join(" · ")}.`);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
    } else if (summary.duplicateReport || summary.itemsSkipped > 0) {
      notify("Laporan ini identik dengan data yang sudah ada. Tidak ada catatan ganda yang dibuat.", "info");
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
    } else {
      notify("Tidak ada aktivitas baru yang bisa disimpan. Periksa pemetaan anggota.", "error");
    }
  };

  const totalActivities = drafts.reduce(
    (total, draft) => total + draft.members.reduce((sum, member) => sum + member.activities.filter((a) => a.text.trim()).length, 0),
    0,
  );

  const openBulk = () => {
    setBulkRoles(Object.fromEntries(newMembers.map((member) => [member.key, member.role])));
    setBulkOpen(true);
  };

  const saveAll = () => {
    setBulkBusy(true);
    // Beri satu frame agar tombol menampilkan status menyimpan sebelum loop sinkron.
    window.setTimeout(() => {
      let saved = 0;
      let added = 0;
      let skipped = 0;
      let membersCreated = 0;
      let withoutDate = 0;
      drafts
        .slice()
        .sort((a, b) => a.reportDate.localeCompare(b.reportDate))
        .forEach((draft) => {
          if (!isValidISODate(draft.reportDate)) {
            withoutDate += 1;
            return;
          }
          const summary = runImport(buildDecision(draft, bulkRoles, { skipTeamNotes: true }));
          if (summary.saved) saved += 1;
          added += summary.itemsAdded;
          skipped += summary.itemsSkipped;
          membersCreated += summary.membersCreated;
        });
      setBulkBusy(false);
      setBulkOpen(false);
      setDrafts((current) => current.filter((draft) => !isValidISODate(draft.reportDate)));
      setReportErrors({});
      const parts = [
        `${saved} laporan tersimpan`,
        `${added} aktivitas`,
        membersCreated > 0 ? `${membersCreated} anggota baru` : null,
        skipped > 0 ? `${skipped} duplikat dilewati` : null,
        withoutDate > 0 ? `${withoutDate} laporan tanpa tanggal dilewati` : null,
      ].filter(Boolean);
      notify(parts.join(" · ") + ".", "success");
    }, 30);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
          <Upload className="h-3.5 w-3.5" /> Impor laporan lampau
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[26px]">Impor</h1>
        <p className="mt-0.5 text-[13px] text-ink-soft">
          Tempel laporan WhatsApp atau unggah .txt, lalu periksa pratinjau sebelum menyimpan.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Laporan terbaca" value={drafts.length} hint="Belum disimpan" tone="brand" icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Aktivitas" value={totalActivities} icon={<ClipboardPaste className="h-4 w-4" />} />
        <StatCard label="Perlu dipetakan" value={drafts.reduce((total, draft) => total + draft.members.filter((member) => member.memberId === NEW_MEMBER || member.memberId === SKIP_MEMBER).length, 0)} tone="amber" icon={<UserPlus className="h-4 w-4" />} />
        <StatCard label="Impor tersimpan" value={imports.length} hint="Teks asli disimpan" icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <Card
            className="p-3.5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <ClipboardPaste className="h-4 w-4 text-brand" /> Tempel teks laporan
                </h2>
                <p className="mt-0.5 text-[11px] text-ink-soft">
                  Satu kali tempel boleh berisi beberapa laporan sekaligus. Bisa juga tempel/seret ekspor chat grup — laporan di dalamnya diambil otomatis.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                    event.target.value = "";
                  }}
                />
                <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-3.5 w-3.5" /> Unggah .txt
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setText(sampleText);
                    analyze(sampleText);
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Isi contoh
                </Button>
              </div>
            </div>

            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`💬 Report Daily Stand Up – 13/10/2026\n📅 Rencana Kerja Hari Ini\n👷 Bang Bima\n• review pull request\n👷 Bang Sinta\n• tulis pengujian otomatis`}
              rows={9}
              spellCheck={false}
              aria-label="Teks laporan WhatsApp"
              className="mt-2 w-full resize-y rounded-xl border border-line bg-[#fbfaf6] p-3 font-mono text-[12px] leading-relaxed text-ink placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => analyze(text)}>
                <Sparkles className="h-4 w-4" /> Analisis teks
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setText("");
                  setDrafts([]);
                  setIgnored([]);
                  setParseError(null);
                  setReportErrors({});
                }}
              >
                Bersihkan
              </Button>
              <span className="ml-auto text-[10.5px] text-ink-soft">
                {text.trim() ? `${text.trim().split(/\n/).length} baris` : "Belum ada teks"}
              </span>
            </div>

            {parseError ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11.5px] leading-snug text-rose-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {parseError}
              </p>
            ) : null}

            {ignored.length > 0 ? (
              <details className="mt-2 rounded-lg border border-line bg-white px-2.5 py-2">
                <summary className="cursor-pointer text-[11px] font-medium text-ink-soft">
                  {ignored.length} baris tidak dikenali (perlu diperiksa)
                </summary>
                <ul className="mt-1.5 space-y-0.5">
                  {ignored.map((line, index) => (
                    <li key={`${line}-${index}`} className="truncate font-mono text-[10.5px] text-ink-soft">
                      {line}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>

          {drafts.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                title="Pratinjau akan muncul di sini"
                description="Tempel laporan lalu klik Analisis teks. Tidak ada data yang disimpan sebelum kamu menekan Simpan laporan."
                icon={<ClipboardPaste className="h-5 w-5" />}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {drafts.length > 1 ? (
                <Card className="flex flex-wrap items-center justify-between gap-2 border-teal-200 bg-brand-soft/60 p-3">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-ink">
                      {drafts.length} laporan siap disimpan
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">
                      Periksa pemetaan anggota sekali di sini, lalu simpan semuanya sekaligus. Laporan identik otomatis dilewati.
                    </p>
                  </div>
                  <Button variant="primary" onClick={openBulk}>
                    <Layers className="h-4 w-4" /> Simpan semua ({drafts.length})
                  </Button>
                </Card>
              ) : null}
              {drafts.map((draft) => {
                const duplicate = duplicateOf(draft);
                const error = reportErrors[draft.id];
                return (
                  <Card key={draft.id} className="overflow-hidden">
                    <div className="border-b border-line bg-[#fbfaf6] px-3.5 py-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <SectionLabel>Pratinjau laporan</SectionLabel>
                            <Pill className="border-violet-200 bg-violet-50 text-violet-700">Impor</Pill>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <label className="text-[11px] font-medium text-ink-soft" htmlFor={`date-${draft.id}`}>
                              Tanggal laporan
                            </label>
                            <input
                              id={`date-${draft.id}`}
                              type="date"
                              value={draft.reportDate}
                              onChange={(event) =>
                                updateDraft(draft.id, (current) => ({ ...current, reportDate: event.target.value }))
                              }
                              className={cn(
                                "h-8 rounded-lg border bg-white px-2 text-[12px] font-medium text-ink focus:outline-none",
                                isValidISODate(draft.reportDate) ? "border-line" : "border-rose-300 ring-2 ring-rose-100",
                              )}
                            />
                            <span className="text-[10.5px] text-ink-soft">
                              {isValidISODate(draft.reportDate)
                                ? formatMediumDate(draft.reportDate)
                                : "wajib diisi manual"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Pill className="whitespace-nowrap border-line bg-white text-ink-soft">
                            {draft.members.length} anggota
                          </Pill>
                          <Pill className="whitespace-nowrap border-line bg-white text-ink-soft">
                            {draft.members.reduce((total, member) => total + member.activities.length, 0)} aktivitas
                          </Pill>
                        </div>
                      </div>

                      {draft.dateText ? (
                        <p className="mt-1 truncate font-mono text-[10px] text-ink-soft/80">Dari teks: {draft.dateText}</p>
                      ) : null}

                      {draft.flags.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {draft.flags.map((flag, index) => (
                            <FlagRow key={`${flag.message}-${index}`} flag={flag} />
                          ))}
                        </ul>
                      ) : null}

                      {duplicate ? (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-900">
                          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            Laporan identik sudah diimpor {formatDateTime(duplicate.importedAt)}. Aktivitas yang sama akan
                            dilewati — tidak ada catatan ganda yang dibuat.
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2.5 p-3">
                      {draft.members.length === 0 ? (
                        <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11.5px] text-amber-900">
                          Tidak ada anggota terbaca. Tambahkan baris “👷 Nama” pada teks atau tambahkan anggota manual di bawah.
                        </p>
                      ) : null}

                      {draft.members.map((member) => (
                        <div key={member.id} className="overflow-hidden rounded-xl border border-line bg-white">
                          <div className="flex flex-wrap items-center gap-2 border-b border-line/70 bg-[#fcfbf8] px-2.5 py-2">
                            <span className="text-[12px] font-semibold text-ink">{member.sourceName}</span>
                            <ArrowRight className="h-3 w-3 shrink-0 text-ink-soft/60" />
                            <Select
                              value={member.memberId}
                              onChange={(event) => {
                                const value = event.target.value;
                                updateMember(draft.id, member.id, (current) => ({
                                  ...current,
                                  memberId: value,
                                  newName: value === NEW_MEMBER ? current.newName || current.sourceName : "",
                                }));
                              }}
                              aria-label={`Petakan ${member.sourceName} ke anggota`}
                              className={cn(
                                "h-8 w-full py-0 text-[11.5px] font-medium sm:w-auto sm:min-w-[190px]",
                                member.memberId === SKIP_MEMBER
                                  ? "border-slate-200 bg-slate-50 text-slate-500"
                                  : member.memberId === NEW_MEMBER
                                    ? "border-amber-200 bg-amber-50 text-amber-800"
                                    : "border-teal-200 bg-brand-soft text-brand-dark",
                              )}
                            >
                              <option value={NEW_MEMBER}>Buat anggota baru…</option>
                              <option value={SKIP_MEMBER}>Lewati anggota ini</option>
                              <optgroup label="Anggota terdaftar">
                                {state.members.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </optgroup>
                            </Select>
                            {member.memberId !== NEW_MEMBER && member.memberId !== SKIP_MEMBER ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand">
                                <CheckCircle2 className="h-3 w-3" /> terpetakan
                              </span>
                            ) : null}
                            <div className="ml-auto flex items-center gap-1">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() =>
                                  updateMember(draft.id, member.id, (current) => ({
                                    ...current,
                                    activities: [
                                      ...current.activities,
                                      { id: nextId("ad"), kind: "plan", text: "", taskId: "" },
                                    ],
                                  }))
                                }
                              >
                                <Plus className="h-3 w-3" /> Aktivitas
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                aria-label={`Hapus ${member.sourceName}`}
                                onClick={() =>
                                  updateDraft(draft.id, (current) => ({
                                    ...current,
                                    members: current.members.filter((item) => item.id !== member.id),
                                  }))
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {member.memberId === NEW_MEMBER ? (
                            <div className="flex flex-wrap gap-1.5 border-b border-line/70 px-2.5 py-2">
                              <Input
                                value={member.newName}
                                onChange={(event) =>
                                  updateMember(draft.id, member.id, (current) => ({ ...current, newName: event.target.value }))
                                }
                                placeholder="Nama anggota baru"
                                aria-label="Nama anggota baru"
                                className="h-8 w-44 py-0 text-[11.5px]"
                              />
                              <Input
                                value={member.newRole}
                                onChange={(event) =>
                                  updateMember(draft.id, member.id, (current) => ({ ...current, newRole: event.target.value }))
                                }
                                placeholder="Peran"
                                aria-label="Peran anggota baru"
                                className="h-8 w-36 py-0 text-[11.5px]"
                              />
                            </div>
                          ) : null}
                          {member.review ? (
                            <p className="flex items-start gap-1 border-b border-line/70 px-2.5 py-1.5 text-[10.5px] text-amber-800">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {member.review}
                            </p>
                          ) : null}

                          <div>
                            {member.activities.length === 0 ? (
                              <p className="px-3 py-2.5 text-[11px] text-ink-soft">Belum ada aktivitas untuk anggota ini.</p>
                            ) : (
                              member.activities.map((activity) => (
                                <div key={activity.id} className="border-b border-line/50 px-2.5 py-1.5 transition-colors last:border-b-0 hover:bg-[#fcfbf8]">
                                  <div className="flex items-center gap-1.5">
                                    <Select
                                      value={activity.kind}
                                      onChange={(event) =>
                                        updateMember(draft.id, member.id, (current) => ({
                                          ...current,
                                          activities: current.activities.map((item) =>
                                            item.id === activity.id ? { ...item, kind: event.target.value as ItemKind } : item,
                                          ),
                                        }))
                                      }
                                      aria-label="Jenis aktivitas"
                                      className={cn("h-8 w-[128px] shrink-0 py-0 text-[10.5px] font-semibold", KIND_STYLE[activity.kind])}
                                    >
                                      {KIND_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </Select>
                                    <Input
                                      value={activity.text}
                                      onChange={(event) =>
                                        updateMember(draft.id, member.id, (current) => ({
                                          ...current,
                                          activities: current.activities.map((item) =>
                                            item.id === activity.id ? { ...item, text: event.target.value } : item,
                                          ),
                                        }))
                                      }
                                      placeholder="Tulis aktivitas persis seperti laporan"
                                      aria-label="Teks aktivitas"
                                      className="h-8 min-w-0 flex-1 py-0 text-[12px]"
                                    />
                                    <button
                                      type="button"
                                      aria-label="Hapus aktivitas"
                                      onClick={() =>
                                        updateMember(draft.id, member.id, (current) => ({
                                          ...current,
                                          activities: current.activities.filter((item) => item.id !== activity.id),
                                        }))
                                      }
                                      className="shrink-0 rounded-lg p-1.5 text-ink-soft/50 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                    <Link2 className={cn("h-3 w-3 shrink-0", activity.taskId ? "text-brand" : "text-slate-300")} />
                                    <Select
                                      value={activity.taskId}
                                      onChange={(event) =>
                                        updateMember(draft.id, member.id, (current) => ({
                                          ...current,
                                          activities: current.activities.map((item) =>
                                            item.id === activity.id ? { ...item, taskId: event.target.value } : item,
                                          ),
                                        }))
                                      }
                                      aria-label="Tautkan aktivitas ke tugas"
                                      className="h-7 w-auto max-w-full border-0 bg-transparent py-0 text-[10.5px] text-ink-soft shadow-none"
                                    >
                                      <option value="">Tanpa tautan tugas</option>
                                      <option value={CREATE_TASK}>+ Buat tugas baru (Belum Mulai)</option>
                                      {state.tasks.map((task) => (
                                        <option key={task.id} value={task.id}>
                                          {task.title} · {statusMeta(task.status).label}
                                        </option>
                                      ))}
                                    </Select>
                                    {activity.review ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-800">
                                        <AlertTriangle className="h-2.5 w-2.5" /> {activity.review}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() =>
                            updateDraft(draft.id, (current) => ({
                              ...current,
                              members: [
                                ...current.members,
                                {
                                  id: nextId("md"),
                                  sourceName: "Anggota tambahan",
                                  memberId: SKIP_MEMBER,
                                  newName: "",
                                  newRole: "Anggota tim",
                                  activities: [{ id: nextId("ad"), kind: "plan", text: "", taskId: "" }],
                                },
                              ],
                            }))
                          }
                        >
                          <UserPlus className="h-3 w-3" /> Tambah anggota
                        </Button>
                        <details className="w-full">
                          <summary className="cursor-pointer text-[10.5px] font-medium text-ink-soft">
                            Lihat teks asli yang disimpan
                          </summary>
                          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-white p-2 font-mono text-[10.5px] leading-relaxed text-ink-soft">
                            {draft.originalText}
                          </pre>
                        </details>
                      </div>

                      {error ? (
                        <p className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11.5px] font-medium text-rose-800">
                          <AlertTriangle className="h-3.5 w-3.5" /> {error}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
                        <p className="text-[10.5px] leading-snug text-ink-soft">
                          Rencana tidak otomatis menjadi selesai. Tanggal laporan terpisah dari waktu impor.
                        </p>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}
                          >
                            Batalkan
                          </Button>
                          <Button size="sm" variant="primary" onClick={() => saveDraft(draft)}>
                            <CheckCircle2 className="h-4 w-4" /> Simpan laporan
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-3.5">
            <SectionLabel>Struktur yang dikenali</SectionLabel>
            <pre className="mt-1.5 overflow-x-auto rounded-lg border border-line bg-[#fbfaf6] p-2 font-mono text-[10px] leading-relaxed text-ink-soft">{`💬 Report Daily Stand Up – 13/10/2026
📅 Rencana Kerja Hari Ini
👷 Bang Bima
• review pull request
👷 Bang Sinta
• tulis penguji

Bagian lain:
✅ Pekerjaan Selesai
⛔ Kendala`}</pre>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-ink-soft">
              <li>• Nama dengan emoji 👷 atau “Nama:” lebih akurat.</li>
              <li>• Tanggal dd/mm/yyyy, yyyy-mm-dd, atau “13 Oktober 2026”.</li>
              <li>• Aktivitas di bawah Rencana tetap rencana, tidak menjadi selesai.</li>
            </ul>
          </Card>

          <Card className="bg-[#fbfaf6] p-3.5">
            <SectionLabel>Aturan impor</SectionLabel>
            <ul className="mt-1.5 space-y-1.5 text-[11px] leading-snug text-ink-soft">
              <li className="flex items-start gap-1.5">
                <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                Tanggal, anggota, dan status selesai tidak pernah ditebak. Bagian yang ambigu ditandai.
              </li>
              <li className="flex items-start gap-1.5">
                <Link2 className="mt-0.5 h-3 w-3 shrink-0 text-brand" />
                Pencocokan tugas hanya otomatis untuk teks yang identik; kemiripan kata tidak menggabungkan tugas.
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-teal-600" />
                Impor berulang tidak membuat catatan ganda pada tanggal & anggota yang sama.
              </li>
            </ul>
          </Card>

          <Card className="p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-semibold text-ink">Riwayat impor</h2>
              <Pill className="border-line bg-slate-50 text-ink-soft">{imports.length}</Pill>
            </div>
            {imports.length === 0 ? (
              <p className="mt-2 text-[11px] text-ink-soft">Belum ada laporan yang diimpor.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {imports.slice(0, 8).map((record) => (
                  <li key={record.id} className="rounded-lg border border-line bg-white p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-semibold text-ink">
                          {record.reportDate ? formatMediumDate(record.reportDate) : "Tanpa tanggal"}
                        </p>
                        <p className="truncate text-[10px] text-ink-soft">
                          {record.memberNames.join(", ") || "—"}
                        </p>
                      </div>
                      <Pill className="border-line bg-slate-50 text-[9.5px] text-ink-soft">{record.activityCount} aktivitas</Pill>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      <span className="text-[9.5px] text-ink-soft/80">Diimpor {formatDateTime(record.importedAt)}</span>
                      <button
                        type="button"
                        onClick={() => setViewingImportId(record.id)}
                        className="text-[10px] font-medium text-brand-dark hover:underline"
                      >
                        Teks asli
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      <Modal
        open={Boolean(viewingImport)}
        onClose={() => setViewingImportId(null)}
        title="Teks asli laporan"
        description={
          viewingImport
            ? `Tanggal laporan ${viewingImport.reportDate ? formatMediumDate(viewingImport.reportDate) : "—"} · diimpor ${formatDateTime(viewingImport.importedAt)}`
            : undefined
        }
        size="md"
        footer={<Button onClick={() => setViewingImportId(null)}>Tutup</Button>}
      >
        {viewingImport ? (
          <>
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-[#fbfaf6] p-3 font-mono text-[11.5px] leading-relaxed text-ink">
              {viewingImport.originalText}
            </pre>
            <p className="mt-2 text-[10.5px] text-ink-soft">
              Sidik jari impor: <span className="font-mono">{viewingImport.fingerprint.slice(0, 16)}</span>. Teks asli
              dipertahankan; tanggal laporan disimpan terpisah dari waktu impor.
            </p>
          </>
        ) : null}
      </Modal>

      <Modal
        open={bulkOpen}
        onClose={() => (bulkBusy ? undefined : setBulkOpen(false))}
        title="Simpan semua laporan"
        description={`${drafts.length} laporan · ${totalActivities} aktivitas. Laporan identik dengan data yang sudah ada otomatis dilewati.`}
        size="md"
        footer={
          <>
            <Button disabled={bulkBusy} onClick={() => setBulkOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" disabled={bulkBusy} onClick={saveAll}>
              <Layers className="h-4 w-4" /> {bulkBusy ? "Menyimpan…" : `Simpan semua (${drafts.length})`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {newMembers.length > 0 ? (
            <div>
              <p className="text-[12px] font-semibold text-ink">
                Anggota baru ({newMembers.length})
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">
                Peran sudah diisi sesuai pembagian tim — Software Engineer / Implementation Engineer — dan masih bisa diubah.
              </p>
              <div className="mt-2 max-h-64 space-y-1.5 overflow-auto pr-1">
                {newMembers.map((member) => (
                  <div key={member.key} className="flex items-center gap-2 rounded-xl border border-line bg-white p-2">
                    <Input
                      value={member.name}
                      readOnly
                      aria-label={`Nama ${member.name}`}
                      className="h-8 min-w-0 flex-1 bg-[#fbfaf6] text-[12px]"
                    />
                    <Input
                      value={bulkRoles[member.key] ?? member.role}
                      onChange={(event) =>
                        setBulkRoles((current) => ({ ...current, [member.key]: event.target.value }))
                      }
                      aria-label={`Peran ${member.name}`}
                      className="h-8 w-52 text-[12px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-ink-soft">
              Semua anggota sudah terdaftar — laporan langsung ditautkan ke anggota yang ada.
            </p>
          )}
          <p className="flex items-start gap-1.5 rounded-lg bg-[#fbfaf6] px-2.5 py-2 text-[11px] leading-snug text-ink-soft">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Bagian kendala/tindak lanjut tim tanpa pemilik (“Tanpa nama”) tidak disimpan sebagai anggota — teks aslinya tetap tersimpan di riwayat impor.
          </p>
          <p className="flex items-start gap-1.5 rounded-lg bg-[#fbfaf6] px-2.5 py-2 text-[11px] leading-snug text-ink-soft">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Menyimpan tidak mengubah status tugas ataupun menetapkan tenggat. Laporan tanpa tanggal
            tetap harus diisi manual satu per satu.
          </p>
        </div>
      </Modal>
    </div>
  );
}
