import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_LIFETIME_SECONDS = 5 * 60;

function secret() {
  const value = process.env.VIEWER_LINK_SECRET;
  if (!value || value.length < 32) {
    throw new Error("VIEWER_LINK_SECRET must contain at least 32 characters.");
  }
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createViewerToken(documentId: string, userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      documentId,
      userId,
      expiresAt: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS
    })
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyViewerToken(token: string) {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      documentId?: unknown;
      userId?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof decoded.documentId !== "string" ||
      typeof decoded.userId !== "string" ||
      typeof decoded.expiresAt !== "number" ||
      decoded.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { documentId: decoded.documentId, userId: decoded.userId };
  } catch {
    return null;
  }
}
