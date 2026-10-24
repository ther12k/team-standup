import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { UserProvider } from "@/components/user-context";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/app-shell";
import { ToastProvider, PageLoading } from "@/components/ui";
import type { SessionUser } from "@/lib/types";

export function AppLayout() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Unauthenticated");
        return res.json();
      })
      .then((body) => {
        if (!cancelled && body?.user) {
          setUser(body.user);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f4ef]">
        <PageLoading label="Memuat sesi akun…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <UserProvider user={user}>
      <StoreProvider>
        <ToastProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </ToastProvider>
      </StoreProvider>
    </UserProvider>
  );
}
