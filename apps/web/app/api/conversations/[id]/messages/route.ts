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

  const { id: conversationId } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!workspace) {
    return NextResponse.json([]);
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId: workspace.id },
  });

  if (!conversation) {
    return NextResponse.json([]);
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      citations: m.citations,
      createdAt: m.createdAt.toISOString(),
    }))
  );
}
