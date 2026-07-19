import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SCHEME = "scrypt-v1";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${SCHEME}$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== SCHEME || !salt || !hash) return false;

  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(hash, "base64url");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

export function validatePasswordPolicy(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 12) errors.push("Das Passwort muss mindestens 12 Zeichen lang sein.");
  if (password.length > 256) errors.push("Das Passwort darf maximal 256 Zeichen lang sein.");
  if (/^\s|\s$/.test(password)) errors.push("Das Passwort darf nicht mit Leerzeichen beginnen oder enden.");
  const lower = password.toLowerCase();
  const blocked = ["password", "passwort", "eckert", "ziegler", "admin", "entgelt", "welcome"];
  if (blocked.some((entry) => lower.includes(entry))) {
    errors.push("Das Passwort enthaelt einen zu leicht erratbaren Begriff.");
  }
  return errors;
}
