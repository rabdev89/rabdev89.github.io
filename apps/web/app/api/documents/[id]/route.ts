import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@documind/db";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const document = await prisma.document.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      _count: { select: { chunks: true } },
      ingestionJobs: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: document.id,
    workspaceId: document.workspaceId,
    filename: document.filename,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    status: document.status,
    error: document.error,
    chunkCount: document._count.chunks,
    latestJob: document.ingestionJobs[0] ?? null,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  });
}
