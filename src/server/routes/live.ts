import { Elysia } from "elysia";
import {
  changeRoom,
  createRoom,
  getRoom,
  RoomError,
} from "@/lib/live-server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

function getBearer(authHeader?: string): string {
  const header = authHeader ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export const liveRoutes = new Elysia({ prefix: "/api/live/rooms" })
  .post("/", async ({ body, cookie, set }) => {
    try {
      const raw = cookie[SESSION_COOKIE]?.value;
      const token = typeof raw === "string" ? raw : undefined;
      const user = await getSessionUser(token);
      if (!user) {
        set.status = 401;
        return { error: "Masuk dulu untuk memulai sesi Live." };
      }
      set.status = 201;
      return await createRoom(body);
    } catch (e) {
      if (e instanceof RoomError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Ruang belum dapat dihubungi. Coba lagi." };
    }
  })
  .get("/:id", async ({ params, headers, set }) => {
    try {
      const token = getBearer(headers.authorization);
      return await getRoom(params.id, token, false);
    } catch (e) {
      if (e instanceof RoomError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Gagal mengambil sesi ruang." };
    }
  })
  .post("/:id", async ({ params, body, headers, set }) => {
    try {
      const token = getBearer(headers.authorization);
      return await changeRoom(params.id, token, body);
    } catch (e) {
      if (e instanceof RoomError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Gagal memproses aksi ruang." };
    }
  })
  .get("/:id/report", async ({ params, headers, set }) => {
    try {
      const token = getBearer(headers.authorization);
      return await getRoom(params.id, token, true);
    } catch (e) {
      if (e instanceof RoomError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Gagal mengambil laporan sesi." };
    }
  });
