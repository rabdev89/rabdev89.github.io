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
      _count: { select: { messages: true } },
      messages: {
        where: { role: "user" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { content: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    conversations.map((c) => {
      const firstMsg = c.messages[0]?.content;
      const title =
        c.title ||
        (firstMsg
          ? firstMsg.length > 40
            ? firstMsg.slice(0, 40) + "..."
            : firstMsg
          : null);
      return {
        id: c.id,
        title,
        messageCount: c._count.messages,
        createdAt: c.createdAt.toISOString(),
      };
    })
  );
}
