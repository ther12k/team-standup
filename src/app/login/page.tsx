"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, LogIn } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sudah punya sesi? Langsung ke aplikasi.
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(response => (response.ok ? router.replace("/") : null))
      .catch(() => null);
  }, [router]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Gagal masuk. Coba lagi.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f5f0] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1">
              <path d="M4 7.5h9M4 12h6" strokeLinecap="round" />
              <path d="M13.5 16.5l2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block text-[16px] font-semibold tracking-tight text-ink">Team Standup</span>
            <span className="block text-[12px] text-ink-soft">Ruang kerja operasional tim</span>
          </span>
        </div>

        <form
          className="rounded-2xl border border-line bg-white p-5 shadow-sm"
          onSubmit={event => {
            event.preventDefault();
            void submit();
          }}
        >
          <h1 className="text-base font-semibold tracking-tight text-ink">Masuk</h1>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
            Gunakan akun yang dibuat koordinator tim.
          </p>

          <div className="mt-4 space-y-3.5">
            <Field label="Nama pengguna" htmlFor="login-username">
              <Input
                id="login-username"
                name="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={event => setUsername(event.target.value)}
                placeholder="username"
              />
            </Field>
            <Field label="Kata sandi" htmlFor="login-password">
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </div>

          {error ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-snug text-rose-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="md" className="mt-4 w-full" disabled={busy || !username.trim() || !password}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {busy ? "Memeriksa…" : "Masuk"}
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-snug text-ink-soft">
          Belum punya akun? Hubungi koordinator tim kamu.
        </p>
      </div>
    </main>
  );
}
