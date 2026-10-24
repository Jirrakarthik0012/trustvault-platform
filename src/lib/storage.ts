import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain"
]);

function storageRoot() {
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.TRUSTVAULT_STORAGE_DIR ?? ".trustvault-storage");
  const publicRoot = path.resolve(process.cwd(), "public");
  const relative = path.relative(publicRoot, root);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error("TRUSTVAULT_STORAGE_DIR must be outside the public directory.");
  }
  return root;
}

function storageProvider() {
  const provider = process.env.TRUSTVAULT_STORAGE_PROVIDER;
  if (provider === "vercel-blob") return provider;
  if (provider === "filesystem" || (!provider && process.env.NODE_ENV !== "production")) {
    return "filesystem";
  }
  throw new Error("Set TRUSTVAULT_STORAGE_PROVIDER to vercel-blob for production.");
}

export function isVercelBlobStorage() {
  return storageProvider() === "vercel-blob";
}

export function isValidBlobPathForOrganization(key: string, organizationId: string) {
  const prefix = `trustvault/${organizationId}/`;
  return key.startsWith(prefix) && /^[0-9a-f-]{36}$/i.test(key.slice(prefix.length));
}

export async function validateUpload(file: File) {
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Choose a file smaller than 10 MB.");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only PDF, JPEG, PNG, WebP, and plain text files are supported.");
  }
  if (!file.name.trim() || file.name.length > 255 || /[\u0000-\u001f\u007f]/.test(file.name)) {
    throw new Error("The filename is invalid or too long.");
  }
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const startsWith = (...bytes: number[]) => bytes.every((byte, index) => header[index] === byte);
  const valid =
    (file.type === "application/pdf" && new TextDecoder().decode(header.slice(0, 5)) === "%PDF-") ||
    (file.type === "image/jpeg" && startsWith(0xff, 0xd8, 0xff)) ||
    (file.type === "image/png" && startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) ||
    (file.type === "image/webp" &&
      new TextDecoder().decode(header.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(header.slice(8, 12)) === "WEBP") ||
    (file.type === "text/plain" && !header.includes(0));
  if (!valid) throw new Error("The file content does not match its supported file type.");
}

export async function storeFile(file: File, organizationId: string) {
  if (storageProvider() === "vercel-blob") {
    const blob = await put(`trustvault/${organizationId}/${randomUUID()}`, file, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: false
    });
    return blob.pathname;
  }

  const root = storageRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const key = randomUUID();
  const destination = path.join(/*turbopackIgnore: true*/ root, key);
  await writeFile(/*turbopackIgnore: true*/ destination, Buffer.from(await file.arrayBuffer()), {
    flag: "wx",
    mode: 0o600
  });
  return key;
}

export async function readStoredFile(key: string) {
  if (storageProvider() === "vercel-blob") {
    if (!/^trustvault\/[a-z0-9_-]{1,64}\/[0-9a-f-]{36}$/i.test(key)) {
      throw new Error("Invalid private Blob pathname.");
    }
    const blob = await get(key, { access: "private", useCache: false });
    if (!blob || blob.statusCode !== 200) throw new Error("Private Blob was not found.");
    return Buffer.from(await new Response(blob.stream).arrayBuffer());
  }
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid storage key.");
  return readFile(/*turbopackIgnore: true*/ path.join(storageRoot(), key));
}

export async function removeStoredFile(key: string) {
  if (storageProvider() === "vercel-blob") {
    if (!/^trustvault\/[a-z0-9_-]{1,64}\/[0-9a-f-]{36}$/i.test(key)) {
      throw new Error("Invalid private Blob pathname.");
    }
    await del(key);
    return;
  }
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid storage key.");
  await unlink(/*turbopackIgnore: true*/ path.join(storageRoot(), key));
}
