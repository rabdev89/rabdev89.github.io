import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const BUCKET = process.env.S3_UPLOAD_BUCKET ?? "documind-uploads";

export async function POST(request: NextRequest) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "No workspace selected" }, { status: 403 });
  }

  const body = await request.json();
  const { filename, contentType, size } = body as {
    filename: string;
    contentType: string;
    size: number;
  };

  if (!filename || !contentType) {
    return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
  }

  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (50MB max)" }, { status: 400 });
  }

  const documentId = crypto.randomUUID();
  const s3Key = `${orgId}/${documentId}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
    Metadata: {
      "workspace-id": orgId,
      "document-id": documentId,
    },
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

  // TODO: insert documents row with status='uploading' via Prisma

  return NextResponse.json({ uploadUrl, documentId, s3Key });
}
