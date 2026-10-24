import { readShare } from "@/lib/share-server";
import { WorkspaceError, workspaceError, workspaceResponse } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

/**
 * Baca tautan berbagi — publik (tanpa login), tapi kunci wajib benar.
 * Kunci dikirim via header Bearer agar tidak muncul di log referer.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const header = request.headers.get("authorization") ?? "";
    const key = header.startsWith("Bearer ") ? header.slice(7) : new URL(request.url).searchParams.get("k") ?? "";
    if (!key) throw new WorkspaceError("Kunci akses tidak tersedia pada tautan.", 401);
    return workspaceResponse(await readShare(id, key));
  } catch (error) {
    return workspaceError(error);
  }
}
