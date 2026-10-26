import { z } from "zod";

/** Skema validasi akun — dipakai API /api/users dan halaman /pengguna. */

export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Nama pengguna: 3–30 karakter huruf kecil, angka, titik, atau garis bawah.");

export const passwordSchema = z
  .string()
  .min(6, "Kata sandi minimal 6 karakter.")
  .max(200, "Kata sandi terlalu panjang (maksimal 200 karakter).");

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Nama tampilan minimal 2 karakter.")
  .max(80, "Nama tampilan maksimal 80 karakter.");

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Isi nama pengguna.").max(100),
  password: z.string().min(1, "Isi kata sandi.").max(200),
});

export const divisionSchema = z
  .string()
  .trim()
  .min(1, "Divisi tidak boleh kosong.")
  .max(40, "Nama divisi maksimal 40 karakter.");

export const createUserSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  role: z.enum(["admin", "member"]).default("member"),
  division: divisionSchema.default("M2MPD"),
  memberId: z.string().trim().max(100).nullish().transform(value => value || null),
});

export const updateUserSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    memberId: z.string().trim().max(100).nullable().optional(),
    role: z.enum(["admin", "member"]).optional(),
    division: divisionSchema.optional(),
    active: z.boolean().optional(),
    password: passwordSchema.optional(),
    /** Wajib bila pengguna mengubah kata sandinya sendiri (bukan admin yang me-reset). */
    currentPassword: z.string().max(200).optional(),
  })
  .refine(value => Object.values(value).some(field => field !== undefined), "Tidak ada perubahan yang dikirim.");
