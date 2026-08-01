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

  const traces = await prisma.agentTrace.findMany({
    where: {
      message: {
        conversation: { workspaceId: workspace.id },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    traces.map((t) => ({
      id: t.id,
      messageId: t.messageId,
      agentName: t.agentName,
      step: t.step,
      latencyMs: t.latencyMs,
      tokens: t.tokens,
      createdAt: t.createdAt.toISOString(),
    }))
  );
}
