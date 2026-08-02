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

  const conversations = await prisma.conversation.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: {
        select: {
          messages: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const conversationIds = conversations.map((c) => c.id);

  const traceCounts =
    conversationIds.length > 0
      ? await prisma.agentTrace.groupBy({
          by: ["messageId"],
          where: {
            message: {
              conversationId: { in: conversationIds },
            },
          },
          _count: { id: true },
        })
      : [];

  const messageToConversation = new Map<string, string>();
  if (conversationIds.length > 0) {
    const msgs = await prisma.message.findMany({
      where: { conversationId: { in: conversationIds } },
      select: { id: true, conversationId: true },
    });
    for (const m of msgs) {
      messageToConversation.set(m.id, m.conversationId);
    }
  }

  const traceCountByConversation = new Map<string, number>();
  for (const tc of traceCounts) {
    const convId = messageToConversation.get(tc.messageId);
    if (convId) {
      traceCountByConversation.set(
        convId,
        (traceCountByConversation.get(convId) ?? 0) + tc._count.id
      );
    }
  }

  return NextResponse.json(
    conversations.map((c) => ({
      id: c.id,
      title: c.title,
      userId: c.userId,
      messageCount: c._count.messages,
      traceCount: traceCountByConversation.get(c.id) ?? 0,
      lastActiveAt: (
        c.messages[0]?.createdAt ?? c.createdAt
      ).toISOString(),
      createdAt: c.createdAt.toISOString(),
    }))
  );
}
