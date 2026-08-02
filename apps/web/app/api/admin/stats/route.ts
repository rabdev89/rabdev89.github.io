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
    return NextResponse.json({
      documents: { total: 0, ready: 0, processing: 0, failed: 0 },
      chunks: 0,
      conversations: 0,
      messages: 0,
      traces: { total: 0, avgLatencyMs: 0 },
      topAgents: [],
    });
  }

  const wsId = workspace.id;

  const [
    docTotal,
    docReady,
    docProcessing,
    docFailed,
    chunkCount,
    conversationCount,
    messageCount,
    traceCount,
    avgLatency,
    topAgents,
  ] = await Promise.all([
    prisma.document.count({ where: { workspaceId: wsId } }),
    prisma.document.count({ where: { workspaceId: wsId, status: "READY" } }),
    prisma.document.count({
      where: { workspaceId: wsId, status: "PROCESSING" },
    }),
    prisma.document.count({ where: { workspaceId: wsId, status: "FAILED" } }),
    prisma.chunk.count({ where: { workspaceId: wsId } }),
    prisma.conversation.count({ where: { workspaceId: wsId } }),
    prisma.message.count({
      where: { conversation: { workspaceId: wsId } },
    }),
    prisma.agentTrace.count({
      where: { message: { conversation: { workspaceId: wsId } } },
    }),
    prisma.agentTrace.aggregate({
      where: { message: { conversation: { workspaceId: wsId } } },
      _avg: { latencyMs: true },
    }),
    prisma.agentTrace.groupBy({
      by: ["agentName"],
      where: { message: { conversation: { workspaceId: wsId } } },
      _count: { id: true },
      _avg: { latencyMs: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    documents: {
      total: docTotal,
      ready: docReady,
      processing: docProcessing,
      failed: docFailed,
    },
    chunks: chunkCount,
    conversations: conversationCount,
    messages: messageCount,
    traces: {
      total: traceCount,
      avgLatencyMs: Math.round(avgLatency._avg.latencyMs ?? 0),
    },
    topAgents: topAgents.map((a) => ({
      agent: a.agentName,
      count: a._count.id,
      avgLatencyMs: Math.round(a._avg.latencyMs ?? 0),
    })),
  });
}
