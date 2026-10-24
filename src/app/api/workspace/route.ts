import { getWorkspace, readWorkspaceBody, saveWorkspace, workspaceError, workspaceResponse } from "@/lib/workspace-server";
import { requireWorkspaceAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireWorkspaceAccess(request);
    return workspaceResponse(await getWorkspace());
  } catch (error) {
    return workspaceError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireWorkspaceAccess(request);
    const body = await readWorkspaceBody(request);
    return workspaceResponse(await saveWorkspace(body));
  } catch (error) {
    return workspaceError(error);
  }
}
