"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "@/lib/types";

/**
 * Identitas pengguna yang sedang masuk, disediakan layout (app) dari sesi server.
 * Nilai diperbarui lewat router.refresh() setelah mengubah profil.
 */
const UserContext = createContext<SessionUser | null>(null);

export function UserProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): SessionUser | null {
  return useContext(UserContext);
}
