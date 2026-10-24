import { bearer, changeRoom, getRoom, readRoomBody, roomError, roomResponse } from "@/lib/live-server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try { return roomResponse(await getRoom((await context.params).id, bearer(request))); }
  catch (error) { return roomError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try { return roomResponse(await changeRoom((await context.params).id, bearer(request), await readRoomBody(request))); }
  catch (error) { return roomError(error); }
}
