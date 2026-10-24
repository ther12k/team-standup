import { resetWorkspace, workspaceError, workspaceResponse } from "@/lib/workspace-server";
import { assertAdminUser, requireWorkspaceAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Kembalikan workspace ke data contoh — koordinator (dengan sandi sudah diganti). */
export async function POST(request: Request) {
  try {
    const user = await requireWorkspaceAccess(request);
    // Token skrip (user null) tidak boleh mereset; harus sesi koordinator sungguhan.
    if (!user) return workspaceResponse({ error: "Memuat ulang riwayat hanya untuk koordinator yang masuk." }, 403);
    assertAdminUser(user);
    return workspaceResponse(await resetWorkspace());
  } catch (error) {
    return workspaceError(error);
  }
}
