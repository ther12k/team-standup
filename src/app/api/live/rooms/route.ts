import { createRoom, readRoomBody, roomError, roomResponse } from "@/lib/live-server";
import { getSessionUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    // Membuat ruang butuh sesi login; akses ruang selanjutnya tetap lewat tautan ber-kunci.
    const user = await getSessionUser();
    if (!user) return roomResponse({ error: "Masuk dulu untuk memulai sesi Live." }, 401);
    return roomResponse(await createRoom(await readRoomBody(request)), 201);
  }
  catch (error) { return roomError(error); }
}
