"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guard";
import { getRequestIp, writeAudit } from "@/lib/audit";
import { MalwareDetectedError, scanUpload } from "@/lib/malware-scan";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  isValidBlobPathForOrganization,
  isVercelBlobStorage,
  readStoredFile,
  removeStoredFile,
  storeFile,
  validateUpload
} from "@/lib/storage";
import { createViewerToken } from "@/lib/viewer-token";

const uploadedDocumentSchema = z.object({
  storageKey: z.string().min(1).max(160),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  size: z.coerce.number().int().positive().max(10 * 1024 * 1024)
});

export async function uploadDocument(formData: FormData) {
  const user = await getCurrentUser();
  const file = formData.get("file");
  if (!user) return { error: "Please sign in to upload a document." };
  if (isVercelBlobStorage()) {
    return { error: "Use the secure direct-upload flow for private Blob storage." };
  }
  if (user.role === "VIEWER") {
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: "Upload denied by role policy."
    });
    return { error: "Your role does not allow uploads." };
  }
  const rateLimit = await checkRateLimit("upload", [user.id, await getRequestIp()]);
  if (!rateLimit.allowed) {
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: `Upload blocked: rate-limit service ${rateLimit.reason}.`
    });
    return {
      error:
        rateLimit.reason === "limited"
          ? "Too many uploads. Please wait before trying again."
          : "Uploads are temporarily unavailable. Please try again later."
    };
  }
  if (!(file instanceof File)) return { error: "Choose a file to upload." };

  try {
    await validateUpload(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "File validation failed.";
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: `Upload rejected: ${message}`
    });
    return { error: message };
  }

  try {
    await scanUpload(file);
  } catch (error) {
    if (!(error instanceof MalwareDetectedError)) {
      console.error("TrustVault malware scan failed; upload rejected.", error);
    }
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details:
        error instanceof MalwareDetectedError
          ? "Upload rejected by malware scanner."
          : "Upload rejected because malware scanning did not complete successfully."
    });
    return {
      error:
        error instanceof MalwareDetectedError
          ? "This file was blocked by the malware scanner."
          : "The file could not be scanned safely. Please try again or contact your administrator."
    };
  }

  let storageKey: string;
  try {
    storageKey = await storeFile(file, user.organizationId);
  } catch (error) {
    console.error("TrustVault private file write failed", error);
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: "Upload failed while writing private file storage."
    });
    return { error: "The file could not be stored. Please try again or contact your administrator." };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          organizationId: user.organizationId,
          ownerId: user.id,
          name: file.name,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          storageKey
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          documentId: document.id,
          action: "UPLOAD",
          status: "SUCCESS",
          ipAddress: await getRequestIp()
        }
      });
    });
  } catch (error) {
    await removeStoredFile(storageKey);
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: "Upload metadata transaction failed; the stored file was removed."
    });
    if (error instanceof Error) console.error("TrustVault document metadata write failed", error);
    return { error: "The document could not be registered. Please try again." };
  }
  revalidatePath("/documents");
  revalidatePath("/");
  return { success: true };
}

export async function registerUploadedDocument(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to upload a document." };
  if (user.role === "VIEWER") return { error: "Your role does not allow uploads." };
  if (!isVercelBlobStorage()) return { error: "Private Blob storage is not enabled." };

  const rateLimit = await checkRateLimit("upload-finalize", [user.id, await getRequestIp()]);
  if (!rateLimit.allowed) {
    return {
      error:
        rateLimit.reason === "limited"
          ? "Too many upload attempts. Please wait before trying again."
          : "Uploads are temporarily unavailable."
    };
  }

  const parsed = uploadedDocumentSchema.safeParse({
    storageKey: formData.get("storageKey"),
    name: formData.get("name"),
    mimeType: formData.get("mimeType"),
    size: formData.get("size")
  });
  if (!parsed.success) {
    const candidate = formData.get("storageKey");
    if (
      typeof candidate === "string" &&
      isValidBlobPathForOrganization(candidate, user.organizationId)
    ) {
      await removeStoredFile(candidate);
    }
    return { error: "The uploaded file could not be verified." };
  }
  if (!isValidBlobPathForOrganization(parsed.data.storageKey, user.organizationId)) {
    return { error: "The uploaded file could not be verified." };
  }
  const { storageKey, name, mimeType, size } = parsed.data;
  const alreadyRegistered = await prisma.document.findUnique({
    where: { storageKey },
    select: { id: true }
  });
  if (alreadyRegistered) return { error: "This upload has already been registered." };

  let file: File;
  try {
    const contents = await readStoredFile(storageKey);
    if (contents.byteLength !== size) throw new Error("Uploaded file size did not match.");
    file = new File([new Uint8Array(contents)], name, { type: mimeType });
    await validateUpload(file);
  } catch (error) {
    console.error("TrustVault uploaded Blob validation failed.", error);
    await removeStoredFile(storageKey);
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: "Direct upload rejected because stored file metadata or content was invalid."
    });
    return { error: "The uploaded file could not be verified and was removed." };
  }

  try {
    await scanUpload(file);
  } catch (error) {
    if (!(error instanceof MalwareDetectedError)) {
      console.error("TrustVault malware scan failed; direct upload rejected.", error);
    }
    await removeStoredFile(storageKey);
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details:
        error instanceof MalwareDetectedError
          ? "Direct upload rejected by malware scanner."
          : "Direct upload rejected because malware scanning did not complete successfully."
    });
    return {
      error:
        error instanceof MalwareDetectedError
          ? "This file was blocked by the malware scanner."
          : "The file could not be scanned safely. Please try again or contact your administrator."
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          organizationId: user.organizationId,
          ownerId: user.id,
          name,
          originalName: name,
          mimeType,
          size,
          storageKey
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          documentId: document.id,
          action: "UPLOAD",
          status: "SUCCESS",
          ipAddress: await getRequestIp()
        }
      });
    });
  } catch (error) {
    console.error("TrustVault direct-upload metadata transaction failed.", error);
    const registered = await prisma.document.findUnique({
      where: { storageKey },
      select: { id: true }
    });
    if (!registered) await removeStoredFile(storageKey);
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: "Direct-upload metadata transaction failed; the private Blob was removed."
    });
    return { error: "The document could not be registered. Please try again." };
  }

  revalidatePath("/documents");
  revalidatePath("/");
  return { success: true };
}

export async function discardUnregisteredUpload(storageKey: string) {
  const user = await getCurrentUser();
  if (!user || user.role === "VIEWER" || !isVercelBlobStorage()) {
    return { error: "Unable to remove the unfinished upload." };
  }
  if (!isValidBlobPathForOrganization(storageKey, user.organizationId)) {
    return { error: "Invalid upload." };
  }
  const existing = await prisma.document.findUnique({
    where: { storageKey },
    select: { id: true }
  });
  if (existing) return { error: "The registered document was not removed." };
  await removeStoredFile(storageKey);
  return { success: true };
}

export async function createViewerLink(documentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to open a document." };
  if (!documentId || documentId.length > 64) return { error: "This document is unavailable." };

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
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
    },
    select: { id: true }
  });
  if (!document) {
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      documentId: null,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: `Viewer link denied: document ${documentId} not found or no active access.`
    });
    return { error: "This document is unavailable or you do not have access." };
  }
  const token = createViewerToken(document.id, user.id);
  return { url: `/api/documents/${encodeURIComponent(document.id)}/view?token=${encodeURIComponent(token)}` };
}

export async function getTenantDocuments() {
  const user = await getCurrentUser();
  if (!user) return [];
  return prisma.document.findMany({
    where: {
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
    },
    include: {
      owner: { select: { name: true } },
      _count: { select: { shares: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}
