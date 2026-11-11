/* eslint-disable react-hooks/set-state-in-effect -- memuat daftar akun setelah mount. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, KeyRound, Loader2, Plus, ShieldCheck, UserCog, Wand2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUser } from "@/components/user-context";
import {
  Avatar,
  Button,
  Card,
  ChipButton,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Modal,
  PasswordInput,
  Pill,
  Select,
  Switch,
  generatePassword,
  useToast,
} from "@/components/ui";
import { displayNameSchema, passwordSchema, usernameSchema } from "@/lib/users-validation";
import type { SessionUser } from "@/lib/types";

type FormState = {
  username: string;
  displayName: string;
  password: string;
  role: "admin" | "member";
  division: string;
  memberId: string;
  active: boolean;
};

const EMPTY_FORM: FormState = { username: "", displayName: "", password: "", role: "member", division: "M2MPD", memberId: "", active: true };

/** Divisi yang dikenal di ruang kerja (bisa disesuaikan untuk tim kamu). */
const DIVISIONS = ["M2MPD", "RnD", "Product", "Maintenance", "PM Project"] as const;

/** Ringkasan akun baru untuk modal "akun dibuat" — sandi awal hanya tampil sekali. */
type CreatedAccount = { username: string; displayName: string; password: string; role: "admin" | "member"; division: string };

const ROLE_HINT: Record<FormState["role"], string> = {
  member: "Mengisi standup harian sendiri dan melihat laporan tim.",
  admin: "Mengelola akun tim, impor laporan, dan pengaturan ruang kerja.",
};

/** Pesan WhatsApp siap kirim berisi tautan aplikasi + kredensial akun baru. */
const whatsappCredentials = (account: CreatedAccount): string =>
  [
    "*Standup Harian — akun baru*",
    `Aplikasi: ${window.location.origin}`,
    `Nama pengguna: ${account.username}`,
    `Kata sandi: ${account.password}`,
    "Masuk lalu segera ganti kata sandi di menu Pengguna.",
  ].join("\n");

/** Pilihan peran sebagai dua chip (bukan dropdown) + keterangan peran aktif. */
function RolePicker({ value, onChange, idPrefix }: { value: FormState["role"]; onChange: (role: FormState["role"]) => void; idPrefix: string }) {
  return (
    <div>
      <div aria-label="Peran" className="grid grid-cols-2 gap-2">
        <ChipButton id={`${idPrefix}-role-member`} active={value === "member"} onClick={() => onChange("member")} className="justify-center py-2">
          Anggota
        </ChipButton>
        <ChipButton id={`${idPrefix}-role-admin`} active={value === "admin"} onClick={() => onChange("admin")} className="justify-center py-2">
          <ShieldCheck className="h-3.5 w-3.5" /> Koordinator
        </ChipButton>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-soft/80">{ROLE_HINT[value]}</p>
    </div>
  );
}

async function apiJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; error: string | null; body: unknown }> {
  try {
    const response = await fetch(url, { cache: "no-store", ...init });
    const body: unknown = await response.json().catch(() => null);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const error = typeof record?.error === "string" ? record.error : null;
    return { ok: response.ok, status: response.status, error, body };
  } catch {
    return { ok: false, status: 0, error: null, body: null };
  }
}

export default function PenggunaPage() {
  const me = useUser();
  const isAdmin = me?.role === "admin";
  const { notify } = useToast();
  const { state } = useStore();

  const [rows, setRows] = useState<SessionUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(me?.displayName ?? "");
  const [profileDivision, setProfileDivision] = useState(me?.division ?? "M2MPD");
  const [profileMember, setProfileMember] = useState(me?.memberId ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SessionUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  /** False sampai percobaan kirim pertama — error inline tidak muncul saat masih mengetik. */
  const [showErrors, setShowErrors] = useState(false);
  const [created, setCreated] = useState<CreatedAccount | null>(null);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    const { ok, body, error } = await apiJson("/api/users");
    if (!ok) {
      setLoadError(error ?? "Gagal memuat daftar pengguna.");
      return;
    }
    const users = body && typeof body === "object" ? (body as Record<string, unknown>).users : null;
    setLoadError(null);
    setRows(Array.isArray(users) ? (users as SessionUser[]) : []);
  }, [isAdmin]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const memberOptions = state.members;

  // Anggota yang sudah terhubung ke akun lain tidak bisa dipilih dua kali
  // (akun yang sedang diedit tidak dihitung supaya tetap bisa mempertahankan tautannya).
  const memberOwner = new Map<string, SessionUser>();
  rows?.forEach(user => {
    if (user.memberId && user.id !== editing?.id) memberOwner.set(user.memberId, user);
  });

  const fieldError = (
    value: string,
    schema: typeof usernameSchema | typeof displayNameSchema | typeof passwordSchema,
  ): string | undefined => {
    if (!showErrors) return undefined;
    const parsed = schema.safeParse(value);
    return parsed.success ? undefined : (parsed.error.issues[0]?.message ?? "Isian tidak valid.");
  };
  const usernameError = fieldError(form.username, usernameSchema);
  const displayNameError = fieldError(form.displayName, displayNameSchema);
  const passwordError = fieldError(form.password, passwordSchema);
  // Di modal ubah, kata sandi boleh kosong (tidak diganti) — error hanya untuk isian yang tidak valid.
  const editPasswordError = form.password === "" ? undefined : passwordError;
  const createValid =
    usernameSchema.safeParse(form.username).success &&
    displayNameSchema.safeParse(form.displayName).success &&
    passwordSchema.safeParse(form.password).success;

  const saveProfile = async () => {
    if (!me || savingProfile) return;
    if (newPassword && newPassword !== confirmPassword) {
      notify("Konfirmasi kata sandi baru tidak cocok.", "error");
      return;
    }
    if (newPassword && !currentPassword) {
      notify("Isi kata sandi lama untuk mengganti kata sandi.", "error");
      return;
    }
    setSavingProfile(true);
    const payload: Record<string, unknown> = {
      displayName: profileName.trim(),
      division: profileDivision,
      memberId: profileMember || null,
    };
    if (newPassword) {
      payload.password = newPassword;
      payload.currentPassword = currentPassword;
    }
    const { ok, error } = await apiJson(`/api/users/${me.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingProfile(false);
    if (!ok) {
      notify(error ?? "Gagal menyimpan profil.", "error");
      return;
    }
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    notify("Profil tersimpan.");
    window.location.reload();
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = (user: SessionUser) => {
    setForm({
      username: user.username,
      displayName: user.displayName,
      password: "",
      role: user.role,
      division: user.division,
      memberId: user.memberId ?? "",
      active: user.active,
    });
    setFormError(null);
    setEditing(user);
  };

  const submitCreate = async () => {
    if (savingForm) return;
    setShowErrors(true);
    if (!createValid) return;
    setSavingForm(true);
    const { ok, error } = await apiJson("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.username,
        displayName: form.displayName,
        password: form.password,
        role: form.role,
        division: form.division,
        memberId: form.memberId || null,
      }),
    });
    setSavingForm(false);
    if (!ok) {
      setFormError(error ?? "Gagal membuat akun.");
      return;
    }
    setCreated({
      username: form.username,
      displayName: form.displayName.trim(),
      password: form.password,
      role: form.role,
      division: form.division,
    });
    setShowCreate(false);
    setShowErrors(false);
    notify(`Akun ${form.username} dibuat.`);
    await loadUsers();
  };

  const submitEdit = async () => {
    if (!editing || savingForm) return;
    setShowErrors(true);
    if (!displayNameSchema.safeParse(form.displayName).success) return;
    // Kata sandi opsional saat mengedit: hanya divalidasi bila diisi.
    if (form.password && !passwordSchema.safeParse(form.password).success) return;
    setSavingForm(true);
    const payload: Record<string, unknown> = {
      displayName: form.displayName.trim(),
      role: form.role,
      division: form.division,
      memberId: form.memberId || null,
    };
    if (editing.active !== form.active) payload.active = form.active;
    if (form.password) payload.password = form.password;
    const { ok, error } = await apiJson(`/api/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingForm(false);
    if (!ok) {
      setFormError(error ?? "Gagal menyimpan perubahan.");
      return;
    }
    setEditing(null);
    notify("Perubahan akun tersimpan.");
    if (editing.id === me?.id) window.location.reload();
    await loadUsers();
  };

  const memberName = (memberId: string | null) =>
    memberId ? (memberOptions.find(m => m.id === memberId)?.name ?? memberId) : "—";

  const resetModal = () => { setShowCreate(false); setEditing(null); setFormError(null); setShowErrors(false); };

  const renderMemberOptions = () => memberOptions.map(member => {
    const owner = memberOwner.get(member.id);
    return (
      <option key={member.id} value={member.id} disabled={Boolean(owner)}>
        {member.name}
        {member.active === false ? " (nonaktif)" : ""}
        {owner ? ` · terhubung @${owner.username}` : ""}
      </option>
    );
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">Pengguna &amp; Akses</h1>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
            {isAdmin
              ? "Kelola akun login tim, peran, dan koneksi ke anggota standup."
              : "Profil akun dan kata sandi kamu."}
          </p>
        </div>
        {isAdmin ? (
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tambah pengguna
          </Button>
        ) : null}
      </header>

      {me && !me.passwordChanged ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-snug text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">
            <span className="font-semibold">Kata sandi kamu masih bawaan.</span> Ganti kata sandi di bawah agar akun
            aman sebelum dibagikan ke tim.
          </p>
        </div>
      ) : null}

      {/* Akun saya */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <Avatar name={me?.displayName ?? "?"} accent={isAdmin ? "emerald" : "teal"} size="md" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-ink">{me?.displayName ?? "—"}</p>
            <p className="truncate text-[11px] text-ink-soft">
              @{me?.username ?? "—"} · {isAdmin ? "Koordinator (admin)" : "Anggota"} · {me?.division ?? "M2MPD"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <Field label="Nama tampilan" htmlFor="profile-name">
            <Input id="profile-name" value={profileName} maxLength={80} onChange={event => setProfileName(event.target.value)} />
          </Field>
          <Field label="Divisi / departemen" htmlFor="profile-division" hint="Divisi asal akun kamu.">
            <Select id="profile-division" value={profileDivision} onChange={event => setProfileDivision(event.target.value)}>
              {DIVISIONS.map(division => (
                <option key={division} value={division}>{division}</option>
              ))}
            </Select>
          </Field>
          <Field label="Anggota tim terkait" htmlFor="profile-member" hint="Dipakai sebagai identitasmu di standup & Live.">
            <Select id="profile-member" value={profileMember} onChange={event => setProfileMember(event.target.value)}>
              <option value="">— tidak terhubung —</option>
              {memberOptions.map(member => (
                <option key={member.id} value={member.id}>
                  {member.name}{member.active === false ? " (nonaktif)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-[#fbfaf6] p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            <KeyRound className="h-3.5 w-3.5" /> Ganti kata sandi <span className="font-normal normal-case tracking-normal">(opsional)</span>
          </p>
          <div className="mt-3 grid gap-3.5 sm:grid-cols-3">
            <Field label="Kata sandi lama" htmlFor="profile-old-password">
              <Input id="profile-old-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
            </Field>
            <Field label="Kata sandi baru" htmlFor="profile-new-password" hint="Minimal 6 karakter.">
              <Input id="profile-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} />
            </Field>
            <Field label="Ulangi sandi baru" htmlFor="profile-confirm-password">
              <Input id="profile-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
            </Field>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            variant="primary"
            disabled={savingProfile || profileName.trim().length < 2}
            onClick={() => void saveProfile()}
          >
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {savingProfile ? "Menyimpan…" : "Simpan profil"}
          </Button>
        </div>
      </Card>

      {/* Daftar akun (koordinator) */}
      {isAdmin ? (
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <UserCog className="h-4 w-4 text-ink-soft" /> Semua pengguna
            </p>
            <Pill className="border-line bg-white text-ink-soft">{rows?.length ?? "…"} akun</Pill>
          </div>

          {loadError ? (
            <p className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              <AlertTriangle className="h-3.5 w-3.5" /> {loadError}
            </p>
          ) : rows === null ? (
            <p className="flex items-center gap-2 py-4 text-xs text-ink-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat daftar akun…
            </p>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Belum ada akun selain kamu"
              description="Buat akun pertama untuk anggota tim supaya mereka bisa mengisi standup sendiri."
              action={
                <Button variant="primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Tambah pengguna
                </Button>
              }
            />
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.07em] text-ink-soft/80">
                    <th className="py-2 pr-3 font-semibold">Nama</th>
                    <th className="py-2 pr-3 font-semibold">Peran</th>
                    <th className="py-2 pr-3 font-semibold">Divisi</th>
                    <th className="py-2 pr-3 font-semibold">Anggota</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 font-semibold" aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(user => (
                    <tr key={user.id} className="border-b border-line/70 last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="block text-[13px] font-semibold text-ink">{user.displayName}</span>
                        <span className="block text-[11px] text-ink-soft">@{user.username}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {user.role === "admin" ? (
                          <Pill className="border-teal-200 bg-brand-soft text-brand-dark">
                            <ShieldCheck className="h-3 w-3" /> Koordinator
                          </Pill>
                        ) : (
                          <Pill className="border-line bg-white text-ink-soft">Anggota</Pill>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-[12px] text-ink">{user.division}</td>
                      <td className="py-2.5 pr-3 text-[12px] text-ink">{memberName(user.memberId)}</td>
                      <td className="py-2.5 pr-3">
                        {user.active ? (
                          <span className="text-[12px] text-teal-700">Aktif</span>
                        ) : (
                          <span className="text-[12px] text-ink-soft/70">Nonaktif</span>
                        )}
                        {!user.passwordChanged ? (
                          <span className="ml-1.5 text-[10.5px] text-amber-700">sandinya masih default</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button size="xs" onClick={() => openEdit(user)}>Ubah</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      <Modal
        open={showCreate}
        onClose={resetModal}
        title="Tambah pengguna"
        description="Anggota login dengan nama pengguna dan kata sandi ini."
        size="sm"
        footer={
          <>
            <Button onClick={resetModal}>Batal</Button>
            <Button variant="primary" disabled={savingForm} onClick={() => void submitCreate()}>
              {savingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {savingForm ? "Membuat…" : "Buat akun"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="Nama pengguna" htmlFor="new-username" hint="Huruf kecil, angka, titik, garis bawah. Dipakai untuk login." error={usernameError}>
            <Input id="new-username" value={form.username} maxLength={30} autoComplete="off"
              onChange={event => setForm({ ...form, username: event.target.value.toLowerCase() })} placeholder="mis. budi" />
          </Field>
          <Field label="Nama tampilan" htmlFor="new-display-name" error={displayNameError}>
            <Input id="new-display-name" value={form.displayName} maxLength={80}
              onChange={event => setForm({ ...form, displayName: event.target.value })} placeholder="mis. Sinta Rahmawati" />
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink">Peran</p>
            <RolePicker idPrefix="new" value={form.role} onChange={role => setForm({ ...form, role })} />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Divisi" htmlFor="new-division">
              <Select id="new-division" value={form.division} onChange={event => setForm({ ...form, division: event.target.value })}>
                {DIVISIONS.map(division => (
                  <option key={division} value={division}>{division}</option>
                ))}
              </Select>
            </Field>
            <Field label="Anggota terkait" htmlFor="new-member" hint="Kartu standup yang diwakili akun ini.">
              <Select id="new-member" value={form.memberId} onChange={event => setForm({ ...form, memberId: event.target.value })}>
                <option value="">— tidak terhubung —</option>
                {renderMemberOptions()}
              </Select>
            </Field>
          </div>
          <Field label="Kata sandi awal" htmlFor="new-password" hint="Minimal 6 karakter — pengguna bisa menggantinya sendiri." error={passwordError}>
            <div className="flex gap-2">
              <PasswordInput id="new-password" className="min-w-0 flex-1" value={form.password}
                onChange={event => setForm({ ...form, password: event.target.value })} />
              <Button variant="secondary" title="Buat kata sandi acak" onClick={() => setForm({ ...form, password: generatePassword() })}>
                <Wand2 className="h-4 w-4" /> Buat otomatis
              </Button>
            </div>
          </Field>
          {formError ? (
            <p className="flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {formError}
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(created)}
        onClose={() => setCreated(null)}
        title="Akun dibuat"
        description="Kirim kredensial ini ke anggota — kata sandi tidak akan tampil lagi setelah jendela ini ditutup."
        size="sm"
        footer={
          <>
            <Button onClick={() => setCreated(null)}>Tutup</Button>
            <CopyButton text={created ? whatsappCredentials(created) : ""} label="Salin untuk WhatsApp" variant="primary" size="md" />
          </>
        }
      >
        {created ? (
          <div className="space-y-3.5">
            <div className="rounded-xl border border-line bg-[#fbfaf6] p-3.5">
              <div className="flex items-center gap-2.5">
                <Avatar name={created.displayName} accent={created.role === "admin" ? "emerald" : "teal"} size="md" />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-semibold text-ink">{created.displayName}</p>
                  <p className="truncate text-[11px] text-ink-soft">
                    @{created.username} · {created.role === "admin" ? "Koordinator" : "Anggota"} · {created.division}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Kata sandi awal</p>
                  <p className="mt-0.5 truncate font-mono text-sm tracking-wide text-ink">{created.password}</p>
                </div>
                <CopyButton text={created.password} label="Salin sandi" variant="secondary" />
              </div>
            </div>
            <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Ingatkan anggota untuk segera mengganti kata sandi setelah masuk pertama di menu Pengguna.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={resetModal}
        title={`Ubah akun — ${editing?.displayName ?? ""}`}
        description={editing ? `@${editing.username}${editing.active ? "" : " · saat ini nonaktif"}` : ""}
        size="sm"
        footer={
          <>
            <Button onClick={resetModal}>Batal</Button>
            <Button variant="primary" disabled={savingForm} onClick={() => void submitEdit()}>
              {savingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {savingForm ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="Nama tampilan" htmlFor="edit-display-name" error={displayNameError}>
            <Input id="edit-display-name" value={form.displayName} maxLength={80}
              onChange={event => setForm({ ...form, displayName: event.target.value })} />
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink">Peran</p>
            <RolePicker idPrefix="edit" value={form.role} onChange={role => setForm({ ...form, role })} />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Divisi" htmlFor="edit-division">
              <Select id="edit-division" value={form.division} onChange={event => setForm({ ...form, division: event.target.value })}>
                {DIVISIONS.map(division => (
                  <option key={division} value={division}>{division}</option>
                ))}
              </Select>
            </Field>
            <Field label="Anggota terkait" htmlFor="edit-member" hint="Kartu standup yang diwakili akun ini.">
              <Select id="edit-member" value={form.memberId} onChange={event => setForm({ ...form, memberId: event.target.value })}>
                <option value="">— tidak terhubung —</option>
                {renderMemberOptions()}
              </Select>
            </Field>
          </div>
          <Field label="Kata sandi baru" htmlFor="edit-password" hint="Kosongkan bila tidak diganti; admin tidak perlu sandi lama." error={editPasswordError}>
            <div className="flex gap-2">
              <PasswordInput id="edit-password" className="min-w-0 flex-1" value={form.password}
                onChange={event => setForm({ ...form, password: event.target.value })} />
              <Button variant="secondary" title="Buat kata sandi acak" onClick={() => setForm({ ...form, password: generatePassword() })}>
                <Wand2 className="h-4 w-4" /> Buat otomatis
              </Button>
            </div>
          </Field>
          <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-[#fbfaf6] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink">Akun aktif</p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">Nonaktifkan untuk mencabut akses tanpa menghapus riwayat.</p>
            </div>
            <Switch checked={form.active} onCheckedChange={checked => setForm({ ...form, active: checked })} />
          </div>
          {editing?.active && !form.active ? (
            <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Setelah disimpan, @{editing.username} langsung dikeluarkan dari aplikasi dan tidak bisa masuk lagi sampai diaktifkan.
            </p>
          ) : null}
          {formError ? (
            <p className="flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {formError}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
