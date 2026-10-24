import { createShare } from "@/lib/share-server";
import { requireSessionUser } from "@/lib/auth";
import { WorkspaceError, workspaceError, workspaceResponse } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

/** Buat tautan berbagi (wajib login; kunci hanya ditampilkan sekali saat dibuat). */
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(await request.text());
    } catch {
      throw new WorkspaceError("Format permintaan tidak valid.");
    }
    const share = await createShare(parsedBody, user.id);
    return workspaceResponse(share, 201);
  } catch (error) {
    return workspaceError(error);
  }
}
