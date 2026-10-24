import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/storage";
import { verifyViewerToken } from "@/lib/viewer-token";

export const maxDuration = 60;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Authentication required.", { status: 401 });

  const token = new URL(request.url).searchParams.get("token") ?? "";
  const { id: documentId } = await context.params;
  if (documentId.length > 64) return new NextResponse("Document unavailable.", { status: 404 });
  const claims = verifyViewerToken(token);
  if (!claims || claims.documentId !== documentId || claims.userId !== user.id) {
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      documentId: null,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: `Viewer rejected: invalid, expired, or mismatched signed link for document ${documentId}.`
    });
    return new NextResponse("Document unavailable.", { status: 404 });
  }

  const document = await prisma.document.findFirst({
    where: {
      id: claims.documentId,
      organizationId: user.organizationId,
      OR: [
        { ownerId: user.id },
        ...(user.role === "ADMIN" || user.role === "MANAGER" ? [{}] : []),
        {
          shares: {
            some: {
              userId: user.id,
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            }
          }
        }
      ]
    }
  });
  if (!document) {
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      documentId: null,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: `Viewer rejected: no active tenant-scoped permission for document ${claims.documentId}.`
    });
    return new NextResponse("Document unavailable.", { status: 404 });
  }

  let contents: Buffer;
  try {
    contents = await readStoredFile(document.storageKey);
  } catch (error) {
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      documentId: document.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: "Viewer failed: private file could not be read."
    });
    throw error;
  }
  await writeAudit({
    organizationId: user.organizationId,
    userId: user.id,
    documentId: document.id,
    action: "VIEW",
    status: "SUCCESS",
    details: "Document content served through the authenticated viewer."
  });

  return new NextResponse(new Uint8Array(contents), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": "inline; filename=\"TrustVault document\"",
      "Content-Length": String(contents.byteLength),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"
    }
  });
}
