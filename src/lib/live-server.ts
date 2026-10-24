import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { liveRooms } from "@/db/schema";
import { createLiveSession, liveReportSnapshot, reduceLiveSession } from "@/lib/live";
import { ensureCoreTables } from "@/lib/workspace-server";
import { roomActionSchema, roomCreateSchema } from "@/lib/live-validation";

export class RoomError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
function tokenMatches(token: string, expectedHash: string): boolean {
  return token.length >= 32 && timingSafeEqual(Buffer.from(digest(token), "hex"), Buffer.from(expectedHash, "hex"));
}
export function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}
export async function readRoomBody(request: Request): Promise<unknown> {
  const body = await request.text();
  if (body.length > 350_000) throw new RoomError("Data terlalu besar. Maksimal 350 KB.", 413);
  try { return JSON.parse(body); } catch { throw new RoomError("Format permintaan tidak valid."); }
}
export function roomResponse(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
export function roomError(error: unknown) {
  if (error instanceof RoomError) return roomResponse({ error: error.message }, error.status);
  console.error("Standup live:", error instanceof Error ? error.message : "Unknown error");
  return roomResponse({ error: "Ruang belum dapat dihubungi. Coba lagi; teks yang belum terkirim tetap ada." }, 503);
}
function checkId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new RoomError("Ruang tidak ditemukan.", 404);
}

export async function createRoom(body: unknown) {
  await ensureCoreTables();
  const parsed = roomCreateSchema.safeParse(body);
  if (!parsed.success) throw new RoomError(`Periksa data sesi: ${parsed.error.issues[0]?.message ?? "tidak valid"}`);
  const key = randomBytes(32).toString("hex");
  const viewKey = randomBytes(32).toString("hex");
  const session = createLiveSession({ ...parsed.data, id: randomUUID() });
  // Bersihkan ruang lama (60 hari tak tersentuh) supaya tabel tidak tumbuh tanpa batas.
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  await db.delete(liveRooms).where(lt(liveRooms.updatedAt, cutoff));
  await db.insert(liveRooms).values({ id: session.id, tokenHash: digest(key), viewToken: viewKey, session });
  return { session, credentials: { id: session.id, key, viewKey } };
}

export async function getRoom(id: string, token: string, reportOnly = false) {
  checkId(id);
  const [row] = await db.select().from(liveRooms).where(eq(liveRooms.id, id)).limit(1);
  if (!row || !tokenMatches(token, reportOnly ? digest(row.viewToken) : row.tokenHash)) {
    throw new RoomError("Tautan ruang tidak valid atau kunci akses tidak tersedia.", 403);
  }
  if (reportOnly) {
    if (!row.report) throw new RoomError("Laporan belum diterbitkan. Minta koordinator menyelesaikan tinjauan.", 409);
    return row.report;
  }
  return { session: row.session, viewKey: row.viewToken };
}

export async function changeRoom(id: string, token: string, body: unknown) {
  checkId(id);
  const parsed = roomActionSchema.safeParse(body);
  if (!parsed.success) throw new RoomError(`Aktivitas tidak valid: ${parsed.error.issues[0]?.message ?? "periksa isian"}`);
  const { action, revision } = parsed.data;
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(liveRooms).where(eq(liveRooms.id, id)).for("update");
    if (!row || !tokenMatches(token, row.tokenHash)) throw new RoomError("Akses ruang ditolak. Buka kembali tautan undangan.", 403);
    if (action.type !== "message" && revision !== row.session.revision) {
      throw new RoomError("Ada perubahan dari peserta lain. Data sudah disegarkan; periksa lalu simpan kembali.", 409);
    }
    let session;
    try { session = reduceLiveSession(row.session, action); }
    catch (error) { throw new RoomError(error instanceof Error ? error.message : "Aksi tidak valid."); }
    await tx.update(liveRooms).set({
      session, updatedAt: new Date(),
      ...(action.type === "phase" && action.phase === "published" ? { report: liveReportSnapshot(session) } : {}),
    }).where(eq(liveRooms.id, id));
    return { session, viewKey: row.viewToken };
  });
}
