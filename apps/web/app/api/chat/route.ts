import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { prisma } from "@documind/db";

const AGENT_URL = process.env.AGENT_SERVICE_URL ?? "http://localhost:8001";

export async function POST(request: NextRequest) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { conversationId, message } = body as {
    conversationId: string;
    message: string;
  };

  if (!conversationId || !message) {
    return new Response("Missing conversationId or message", { status: 400 });
  }

  let workspace = await prisma.workspace.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { clerkOrgId: orgId, name: orgId },
    });
  }

  const agentRes = await fetch(`${AGENT_URL}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspace_id: workspace.id,
      user_id: userId,
      conversation_id: conversationId,
      message,
    }),
  });

  if (!agentRes.ok || !agentRes.body) {
    return new Response("Agent service unavailable", { status: 502 });
  }

  return new Response(agentRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
