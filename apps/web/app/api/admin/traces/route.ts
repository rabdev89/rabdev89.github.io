import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@documind/db";

export async function GET(request: NextRequest) {
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

  const { searchParams } = request.nextUrl;
  const agentFilter = searchParams.get("agent");
  const conversationFilter = searchParams.get("conversation");
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? "200", 10),
    500
  );

  const where: Record<string, unknown> = {
    message: {
      conversation: {
        workspaceId: workspace.id,
        ...(conversationFilter ? { id: conversationFilter } : {}),
      },
    },
  };

  if (agentFilter) {
    where.agentName = agentFilter;
  }

  const traces = await prisma.agentTrace.findMany({
    where,
    include: {
      message: {
        select: {
          conversationId: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(
    traces.map((t) => ({
      id: t.id,
      messageId: t.messageId,
      conversationId: t.message.conversationId,
      agentName: t.agentName,
      step: t.step,
      input: t.input,
      output: t.output,
      latencyMs: t.latencyMs,
      tokens: t.tokens,
      createdAt: t.createdAt.toISOString(),
    }))
  );
}
