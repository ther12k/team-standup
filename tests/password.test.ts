import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password";

test("hash lalu verifikasi kata sandi yang sama → cocok", async () => {
  const hash = await hashPassword("rahasia-tim");
  assert.match(hash, /^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("rahasia-tim", hash), true);
});

test("kata sandi salah ditolak", async () => {
  const hash = await hashPassword("rahasia-tim");
  assert.equal(await verifyPassword("rahasia-tim ", hash), false);
  assert.equal(await verifyPassword("Rahasia-tim", hash), false);
  assert.equal(await verifyPassword("", hash), false);
});

test("salt acak: hash yang sama dua kali berbeda", async () => {
  const a = await hashPassword("sandi-sama");
  const b = await hashPassword("sandi-sama");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("sandi-sama", a), true);
  assert.equal(await verifyPassword("sandi-sama", b), true);
});

test("hash rusak/format asing ditolak tanpa error", async () => {
  assert.equal(await verifyPassword("apa", "bukan-hash"), false);
  assert.equal(await verifyPassword("apa", "scrypt$16384$8$1$zz$00"), false);
  assert.equal(await verifyPassword("apa", ""), false);
  assert.equal(await verifyPassword("apa", "bcrypt$2a$10$abcdef"), false);
});

test("kata sandi unicode dinormalisasi konsisten", async () => {
  // é praakomposisi (U+00E9) vs e + combining acute (U+0301): kedua sisi
  // dinormalisasi NFKC sebelum scrypt sehingga bentuk berbeda tetap cocok.
  const hash = await hashPassword("sandi\u00e9aman");
  assert.equal(await verifyPassword("sandie\u0301aman", hash), true);
});
