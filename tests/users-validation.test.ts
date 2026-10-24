import test from "node:test";
import assert from "node:assert/strict";
import { createUserSchema, loginSchema, updateUserSchema } from "../src/lib/users-validation";

test("skema login menerima isian wajar", () => {
  const parsed = loginSchema.safeParse({ username: " Budi ", password: "standup123" });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.username.trim(), "Budi");
});

test("skema login menolak isian kosong", () => {
  assert.equal(loginSchema.safeParse({ username: "", password: "" }).success, false);
  assert.equal(loginSchema.safeParse({ username: "a" }).success, false);
});

test("buat akun: username dinormalisasi kecil dan validasi ketat", () => {
  const ok = createUserSchema.safeParse({
    username: "Isra.M",
    displayName: "Isra",
    password: "sandi123",
    role: "member",
    memberId: "m-isra",
  });
  assert.equal(ok.success, true);
  if (ok.success) assert.equal(ok.data.username, "isra.m");

  assert.equal(createUserSchema.safeParse({ username: "AB", displayName: "Ab", password: "sandi123" }).success, false);
  assert.equal(createUserSchema.safeParse({ username: "isra!", displayName: "Isra", password: "sandi123" }).success, false);
  assert.equal(createUserSchema.safeParse({ username: "isra", displayName: "Isra", password: "123" }).success, false);
});

test("buat akun: memberId kosong/string kosong dinormalkan null, role default member", () => {
  const parsed = createUserSchema.parse({ username: "budi", displayName: "Budi", password: "sandi123", memberId: "" });
  assert.equal(parsed.memberId, null);
  assert.equal(parsed.role, "member");
});

test("divisi: default Engineering, bisa diisi, kosong ditolak", () => {
  const def = createUserSchema.parse({ username: "budi", displayName: "Budi", password: "sandi123" });
  assert.equal(def.division, "Engineering");
  const set = createUserSchema.parse({ username: "budi", displayName: "Budi", password: "sandi123", division: " RnD " });
  assert.equal(set.division, "RnD");
  assert.equal(createUserSchema.safeParse({ username: "budi", displayName: "Budi", password: "sandi123", division: "" }).success, false);
  assert.equal(updateUserSchema.safeParse({ division: "" }).success, false);
});

test("ubah akun: menolak payload kosong", () => {
  assert.equal(updateUserSchema.safeParse({}).success, false);
});

test("ubah akun: menerima kombinasi sah", () => {
  const parsed = updateUserSchema.safeParse({ displayName: "Isra Maulana", division: "Product", memberId: null, active: false });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.division, "Product");
  const withPassword = updateUserSchema.safeParse({ password: "sandi-baru", currentPassword: "lama" });
  assert.equal(withPassword.success, true);
  assert.equal(updateUserSchema.safeParse({ password: "123" }).success, false);
  assert.equal(updateUserSchema.safeParse({ role: "boss" }).success, false);
});
