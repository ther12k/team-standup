/* eslint-disable react-hooks/set-state-in-effect -- memuat daftar akun setelah mount. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, KeyRound, Loader2, Plus, ShieldCheck, UserCog } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUser } from "@/components/user-context";
import { Avatar, Button, Card, Field, Input, Modal, Pill, Select, useToast } from "@/components/ui";
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

const EMPTY_FORM: FormState = { username: "", displayName: "", password: "", role: "member", division: "Engineering", memberId: "", active: true };

/** Divisi yang dikenal di ruang kerja (bisa disesuaikan untuk tim kamu). */
const DIVISIONS = ["Engineering", "Product", "Maintenance", "PM Project"] as const;

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
  const router = useRouter();
  const { notify } = useToast();
  const { state } = useStore();

  const [rows, setRows] = useState<SessionUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(me?.displayName ?? "");
  const [profileDivision, setProfileDivision] = useState(me?.division ?? "Engineering");
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
    router.refresh();
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
    setShowCreate(false);
    notify(`Akun ${form.username} dibuat.`);
    await loadUsers();
  };

  const submitEdit = async () => {
    if (!editing || savingForm) return;
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
    if (editing.id === me?.id) router.refresh();
    await loadUsers();
  };

  const memberName = (memberId: string | null) =>
    memberId ? (memberOptions.find(m => m.id === memberId)?.name ?? memberId) : "—";

  const resetModal = () => { setShowCreate(false); setEditing(null); setFormError(null); };

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
              @{me?.username ?? "—"} · {isAdmin ? "Koordinator (admin)" : "Anggota"} · {me?.division ?? "Engineering"}
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
            <Button
              variant="primary"
              disabled={savingForm || form.username.trim().length < 3 || form.displayName.trim().length < 2 || form.password.length < 6}
              onClick={() => void submitCreate()}
            >
              {savingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {savingForm ? "Membuat…" : "Buat akun"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="Nama pengguna" htmlFor="new-username" hint="Huruf kecil, angka, titik, garis bawah. Dipakai untuk login.">
            <Input id="new-username" value={form.username} maxLength={30} autoComplete="off"
              onChange={event => setForm({ ...form, username: event.target.value.toLowerCase() })} placeholder="mis. budi" />
          </Field>
          <Field label="Nama tampilan" htmlFor="new-display-name">
            <Input id="new-display-name" value={form.displayName} maxLength={80}
              onChange={event => setForm({ ...form, displayName: event.target.value })} placeholder="mis. Sinta Rahmawati" />
          </Field>
          <Field label="Kata sandi awal" htmlFor="new-password" hint="Minimal 6 karakter; pengguna bisa menggantinya sendiri.">
            <Input id="new-password" type="password" autoComplete="new-password" value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })} />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Peran" htmlFor="new-role">
              <Select id="new-role" value={form.role} onChange={event => setForm({ ...form, role: event.target.value as FormState["role"] })}>
                <option value="member">Anggota</option>
                <option value="admin">Koordinator (admin)</option>
              </Select>
            </Field>
            <Field label="Divisi" htmlFor="new-division">
              <Select id="new-division" value={form.division} onChange={event => setForm({ ...form, division: event.target.value })}>
                {DIVISIONS.map(division => (
                  <option key={division} value={division}>{division}</option>
                ))}
              </Select>
            </Field>
            <Field label="Anggota terkait" htmlFor="new-member">
              <Select id="new-member" value={form.memberId} onChange={event => setForm({ ...form, memberId: event.target.value })}>
                <option value="">— tidak terhubung —</option>
                {memberOptions.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name}{member.active === false ? " (nonaktif)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {formError ? (
            <p className="flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {formError}
            </p>
          ) : null}
        </div>
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
            <Button variant="primary" disabled={savingForm || form.displayName.trim().length < 2} onClick={() => void submitEdit()}>
              {savingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {savingForm ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="Nama tampilan" htmlFor="edit-display-name">
            <Input id="edit-display-name" value={form.displayName} maxLength={80}
              onChange={event => setForm({ ...form, displayName: event.target.value })} />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Peran" htmlFor="edit-role">
              <Select id="edit-role" value={form.role} onChange={event => setForm({ ...form, role: event.target.value as FormState["role"] })}>
                <option value="member">Anggota</option>
                <option value="admin">Koordinator (admin)</option>
              </Select>
            </Field>
            <Field label="Divisi" htmlFor="edit-division">
              <Select id="edit-division" value={form.division} onChange={event => setForm({ ...form, division: event.target.value })}>
                {DIVISIONS.map(division => (
                  <option key={division} value={division}>{division}</option>
                ))}
              </Select>
            </Field>
            <Field label="Anggota terkait" htmlFor="edit-member">
              <Select id="edit-member" value={form.memberId} onChange={event => setForm({ ...form, memberId: event.target.value })}>
                <option value="">— tidak terhubung —</option>
                {memberOptions.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name}{member.active === false ? " (nonaktif)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Kata sandi baru" htmlFor="edit-password" hint="Kosongkan bila tidak diganti; admin tidak perlu sandi lama.">
            <Input id="edit-password" type="password" autoComplete="new-password" value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })} />
          </Field>
          <label className="flex items-center gap-2 rounded-xl border border-line bg-[#fbfaf6] px-3 py-2.5 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={form.active}
              onChange={event => setForm({ ...form, active: event.target.checked })}
              className="accent-teal-700"
            />
            Akun aktif (dapat masuk). Nonaktifkan untuk mencabut akses tanpa menghapus riwayat.
          </label>
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
