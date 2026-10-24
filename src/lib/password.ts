import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Wrapper promise agar opsi cost scrypt tetap terbawa (promisify bawaan memilih overload tanpa opsi).
const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key)));
  });

// Parameter scrypt standar OWASP 2023 untuk login interaktif.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Hash kata sandi: "scrypt$N$r$p$saltHex$keyHex" (async karena scrypt di thread pool). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("hex"), key.toString("hex")].join("$");
}

/** Bandingkan kata sandi dengan hash tersimpan; salah format hash = gagal, bukan error. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [scheme, nRaw, rRaw, pRaw, saltHex, keyHex] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (scheme !== "scrypt" || !Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (n <= 0 || n > 1 << 22 || r <= 0 || r > 1024 || p <= 0 || p > 1024) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(keyHex, "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await scrypt(password.normalize("NFKC"), salt, expected.length, { N: n, r, p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
