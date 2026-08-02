import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@documind/db";
import { uploadLimiter } from "@/lib/rate-limit";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const BUCKET = process.env.S3_UPLOAD_BUCKET ?? "documind-uploads";

const MAX_SIZE = 50 * 1024 * 1024;
const MAX_FILENAME_LENGTH = 255;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const FILENAME_RE = /^[a-zA-Z0-9._\-\s()[\]]+$/;

export async function POST(request: NextRequest) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json(
      { error: "No workspace selected" },
      { status: 403 }
    );
  }

  const { allowed, retryAfterMs } = uploadLimiter.check(orgId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Upload rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      }
    );
  }

  const body = await request.json();
  const { filename, contentType, size } = body as {
    filename: string;
    contentType: string;
    size: number;
  };

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "Missing filename or contentType" },
      { status: 400 }
    );
  }

  if (filename.length > MAX_FILENAME_LENGTH) {
    return NextResponse.json(
      { error: `Filename too long (max ${MAX_FILENAME_LENGTH} chars)` },
      { status: 400 }
    );
  }

  if (!FILENAME_RE.test(filename)) {
    return NextResponse.json(
      { error: "Filename contains invalid characters" },
      { status: 400 }
    );
  }

  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json(
      { error: "Invalid filename" },
      { status: 400 }
    );
  }

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 }
    );
  }

  if (typeof size !== "number" || size <= 0 || size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large (50MB max)" },
      { status: 400 }
    );
  }

  const documentId = crypto.randomUUID();
  const sanitizedFilename = filename.replace(/[^\w.\-]/g, "_");
  const s3Key = `${orgId}/${documentId}/${sanitizedFilename}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
    ContentLength: size,
    Metadata: {
      "workspace-id": orgId,
      "document-id": documentId,
    },
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

  let workspace = await prisma.workspace.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { clerkOrgId: orgId, name: orgId },
    });
  }

  await prisma.document.create({
    data: {
      id: documentId,
      workspaceId: workspace.id,
      filename,
      s3Key,
      mimeType: contentType,
      sizeBytes: size,
      status: "UPLOADING",
    },
  });

  return NextResponse.json({ uploadUrl, documentId, s3Key });
}
