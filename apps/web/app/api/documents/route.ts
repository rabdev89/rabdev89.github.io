import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@documind/db";

export async function GET() {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!workspace) {
    return NextResponse.json([]);
  }

  const documents = await prisma.document.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: { select: { chunks: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(
    documents.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      status: doc.status,
      error: doc.error,
      chunkCount: doc._count.chunks,
      createdAt: doc.createdAt.toISOString(),
    }))
  );
}
