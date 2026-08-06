import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32",
    );
  }
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encrypted] = ciphertext.split(":");
  if (!ivHex || !tagHex || !encrypted) {
    throw new Error("Invalid encrypted value format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
