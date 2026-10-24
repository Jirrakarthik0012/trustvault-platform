import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIp, writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidBlobPathForOrganization, isVercelBlobStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const uploadRequestSchema = z.object({
  type: z.literal("blob.generate-client-token"),
  payload: z.object({
    pathname: z.string().min(1).max(160),
    multipart: z.boolean(),
    clientPayload: z.string().max(512).nullable()
  })
});

const allowedContentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain"
];

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Cross-origin uploads are not allowed." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.role === "VIEWER") {
    return NextResponse.json({ error: "Your role does not allow uploads." }, { status: 403 });
  }
  if (!isVercelBlobStorage()) {
    return NextResponse.json({ error: "Private Blob storage is not enabled." }, { status: 503 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("TrustVault direct uploads require BLOB_READ_WRITE_TOKEN.");
    return NextResponse.json({ error: "Private file storage is not configured." }, { status: 503 });
  }

  const rateLimit = await checkRateLimit("upload", [user.id, await getRequestIp()]);
  if (!rateLimit.allowed) {
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: `Upload token blocked: rate-limit service ${rateLimit.reason}.`
    });
    return NextResponse.json(
      {
        error:
          rateLimit.reason === "limited"
            ? "Too many uploads. Please wait before trying again."
            : "Uploads are temporarily unavailable."
      },
      { status: rateLimit.reason === "limited" ? 429 : 503 }
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }
  const parsed = uploadRequestSchema.safeParse(requestBody);
  if (
    !parsed.success ||
    !isValidBlobPathForOrganization(parsed.data.payload.pathname, user.organizationId)
  ) {
    return NextResponse.json({ error: "Invalid upload destination." }, { status: 400 });
  }

  try {
    const response = await handleUpload({
      request,
      body: parsed.data as HandleUploadBody,
      onBeforeGenerateToken: async (pathname) => {
        if (!isValidBlobPathForOrganization(pathname, user.organizationId)) {
          throw new Error("Upload destination is outside the caller's organization.");
        }
        return {
          allowedContentTypes,
          maximumSizeInBytes: 10 * 1024 * 1024,
          validUntil: Date.now() + 60 * 60 * 1000,
          addRandomSuffix: false,
          allowOverwrite: false
        };
      }
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("TrustVault private upload-token generation failed.", error);
    return NextResponse.json({ error: "Unable to prepare a secure upload." }, { status: 500 });
  }
}
