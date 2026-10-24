import { bearer, getRoom, roomError, roomResponse } from "@/lib/live-server";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return roomResponse(await getRoom((await context.params).id, bearer(request), true)); }
  catch (error) { return roomError(error); }
}
