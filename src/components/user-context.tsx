"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { SessionUser } from "@/lib/types";
import { DEFAULT_DIVISION } from "@/lib/division";

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

/**
 * Cakupan divisi untuk tampilan: divisi akun yang masuk, atau divisi lain yang
 * dipilih admin (disimpan per-browser). Anggota biasa selalu melihat divisinya
 * sendiri; hanya koordinator yang bisa berpindah untuk mengawasi divisi lain.
 */
const DIVISION_OVERRIDE_KEY = "standup-division-override";

export type DivisionScope = {
  division: string;
  canSwitch: boolean;
  setDivision: (division: string) => void;
};

const DivisionScopeContext = createContext<DivisionScope | null>(null);

const FALLBACK_SCOPE: DivisionScope = { division: DEFAULT_DIVISION, canSwitch: false, setDivision: () => {} };

export function DivisionScopeProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  const isAdmin = user.role === "admin";
  const userOverrideKey = `${DIVISION_OVERRIDE_KEY}:${user.id}`;
  const [override, setOverride] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(userOverrideKey);
    } catch {
      return null;
    }
  });

  const setDivision = useCallback((division: string) => {
    setOverride(division);
    try {
      window.localStorage.setItem(userOverrideKey, division);
    } catch {
      /* penyimpanan lokal tidak tersedia — override hanya untuk sesi ini */
    }
  }, [userOverrideKey]);

  const value = useMemo<DivisionScope>(
    () => ({
      division: isAdmin && override ? override : user.division || DEFAULT_DIVISION,
      canSwitch: isAdmin,
      setDivision,
    }),
    [isAdmin, override, user.division, setDivision],
  );

  return <DivisionScopeContext.Provider value={value}>{children}</DivisionScopeContext.Provider>;
}

export function useDivisionScope(): DivisionScope {
  return useContext(DivisionScopeContext) ?? FALLBACK_SCOPE;
}
