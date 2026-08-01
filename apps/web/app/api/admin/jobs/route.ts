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

  const jobs = await prisma.ingestionJob.findMany({
    where: {
      document: { workspaceId: workspace.id },
    },
    include: {
      document: { select: { filename: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  return NextResponse.json(
    jobs.map((job) => ({
      id: job.id,
      documentId: job.documentId,
      filename: job.document.filename,
      state: job.state,
      error: job.error,
      sfnExecutionArn: job.sfnExecutionArn,
      startedAt: job.startedAt.toISOString(),
      endedAt: job.endedAt?.toISOString() ?? null,
      durationMs: job.endedAt
        ? job.endedAt.getTime() - job.startedAt.getTime()
        : null,
    }))
  );
}
