import { Elysia } from "elysia";
import {
  assertLoginAllowed,
  authenticate,
  clearLoginFailures,
  createSession,
  destroySession,
  ensureAuthReady,
  getSessionUser,
  recordLoginFailure,
  toSessionUser,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";
import { loginSchema } from "@/lib/users-validation";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .post("/login", async ({ body, cookie, set, headers }) => {
    await ensureAuthReady();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: parsed.error.issues[0]?.message ?? "Isian tidak valid." };
    }
    const username = parsed.data.username.toLowerCase();
    try {
      assertLoginAllowed(username);
    } catch (e) {
      set.status = 429;
      return { error: e instanceof Error ? e.message : "Terlalu banyak percobaan gagal." };
    }

    const row = await authenticate(username, parsed.data.password);
    if (!row) {
      recordLoginFailure(username);
      set.status = 401;
      return { error: "Nama pengguna atau kata sandi salah." };
    }

    clearLoginFailures(username);
    const token = await createSession(row.id);
    const forwardedProto = headers["x-forwarded-proto"] ?? "";
    cookie[SESSION_COOKIE].set({
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: forwardedProto.split(",")[0].trim() === "https",
    });

    return { user: toSessionUser(row) };
  })
  .post("/logout", async ({ cookie }) => {
    const raw = cookie[SESSION_COOKIE]?.value;
    const token = typeof raw === "string" ? raw : undefined;
    if (token) {
      try {
        await destroySession(token);
      } catch {
        /* sesi sudah tidak ada */
      }
    }
    cookie[SESSION_COOKIE].remove();
    return { ok: true };
  })
  .get("/me", async ({ cookie, set }) => {
    const raw = cookie[SESSION_COOKIE]?.value;
    const token = typeof raw === "string" ? raw : undefined;
    const user = await getSessionUser(token);
    if (!user) {
      set.status = 401;
      return { error: "Belum masuk." };
    }
    return { user };
  });
