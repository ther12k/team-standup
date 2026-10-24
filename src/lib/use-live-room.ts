/* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi awal dengan URL fragment dan localStorage setelah mount. */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveAction, LiveSession, RoomCredentials } from "@/lib/live";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui";

const STORAGE = "team-standup-live-room-v1";
async function jsonRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Permintaan gagal. Silakan coba lagi.");
  return body as T;
}

export function useLiveRoom() {
  const { state, syncLiveReport } = useStore();
  const { notify } = useToast();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [credentials, setCredentials] = useState<RoomCredentials | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<"connecting" | "connected" | "error">("connecting");
  const sessionRef = useRef<LiveSession | null>(null);
  const credsRef = useRef<RoomCredentials | null>(null);
  const inFlight = useRef(false);

  const accept = useCallback((next: LiveSession) => {
    const current = sessionRef.current;
    if (current?.id === next.id && current.revision >= next.revision) return;
    sessionRef.current = next;
    setSession(next);
  }, []);

  const remember = useCallback((value: RoomCredentials) => {
    credsRef.current = value;
    setCredentials(value);
    try { localStorage.setItem(STORAGE, JSON.stringify(value)); }
    catch { notify("Kunci ruang tidak bisa disimpan lokal. Salin tautan undangan untuk kembali ke sesi ini.", "info"); }
  }, [notify]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    let saved: RoomCredentials | null = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null"); } catch { /* invalid local data ignored */ }
    const room = params.get("room");
    if (room) {
      const key = hash.get("key") || (saved?.id === room ? saved.key : "");
      remember({ id: room, key, viewKey: saved?.id === room ? saved.viewKey : "" });
    } else if (saved?.id && saved.key) remember(saved);
    setInitialized(true);
  }, [remember]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const creds = credsRef.current;
    if (!creds) return;
    try {
      const body = await jsonRequest<{ session: LiveSession; viewKey: string }>(`/api/live/rooms/${encodeURIComponent(creds.id)}`, {
        headers: { Authorization: `Bearer ${creds.key}` }, signal,
      });
      if (signal?.aborted || credsRef.current?.id !== body.session.id) return;
      accept(body.session);
      if (creds.viewKey !== body.viewKey) remember({ ...creds, viewKey: body.viewKey });
      setConnection("connected"); setError("");
    } catch (e) {
      if (signal?.aborted) return;
      setConnection("error");
      setError(e instanceof Error ? e.message : "Koneksi terputus. Pesan belum terkirim tidak akan dihapus.");
    }
  }, [accept, remember]);

  useEffect(() => {
    if (!credentials?.id) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => { if (!document.hidden && !inFlight.current) void refresh(controller.signal); }, 2500);
    const visibility = () => { if (!document.hidden) void refresh(controller.signal); };
    document.addEventListener("visibilitychange", visibility);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [credentials?.id, refresh]);

  useEffect(() => {
    if (session?.phase === "published") syncLiveReport(session);
  }, [session, syncLiveReport]);

  const create = useCallback(async (input: { title: string; date: string; withDemo: boolean }) => {
    if (inFlight.current) return null;
    setBusy(true); inFlight.current = true; setError("");
    try {
      const body = await jsonRequest<{ session: LiveSession; credentials: RoomCredentials }>("/api/live/rooms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, members: state.members, tasks: state.tasks.slice(0, 200) }),
      });
      remember(body.credentials); accept(body.session); setConnection("connected");
      window.history.replaceState(null, "", `/live?room=${body.session.id}#key=${body.credentials.key}`);
      return body.session;
    } catch (e) { const message = e instanceof Error ? e.message : "Tidak dapat membuat ruang."; setError(message); notify(message, "error"); return null; }
    finally { setBusy(false); inFlight.current = false; }
  }, [state.members, state.tasks, remember, accept, notify]);

  const act = useCallback(async (action: LiveAction) => {
    const creds = credsRef.current; const current = sessionRef.current;
    if (!creds || !current || inFlight.current) return null;
    setBusy(true); inFlight.current = true;
    try {
      const body = await jsonRequest<{ session: LiveSession }>(`/api/live/rooms/${encodeURIComponent(creds.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.key}` },
        body: JSON.stringify({ action, revision: current.revision }),
      });
      accept(body.session); setConnection("connected"); setError("");
      return body.session;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Belum tersimpan. Coba lagi.";
      notify(message, "error");
      await refresh();
      return null;
    } finally { setBusy(false); inFlight.current = false; }
  }, [accept, notify, refresh]);

  return { session, credentials, initialized, busy, error, connection, create, act, refresh };
}
