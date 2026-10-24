import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/app-shell";
import { UserProvider } from "@/components/user-context";

export const dynamic = "force-dynamic";

/**
 * Gerbang autentikasi seluruh halaman aplikasi: tanpa sesi login yang sah,
 * pengguna dialihkan ke /login sebelum halaman dirender.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <UserProvider user={user}>
      <StoreProvider>
        <AppShell>{children}</AppShell>
      </StoreProvider>
    </UserProvider>
  );
}
