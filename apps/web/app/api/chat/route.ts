import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { prisma } from "@documind/db";
import { chatLimiter } from "@/lib/rate-limit";

const AGENT_URL = process.env.AGENT_SERVICE_URL ?? "http://localhost:8001";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 10_000;

export async function POST(request: NextRequest) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { allowed, retryAfterMs } = chatLimiter.check(orgId);
  if (!allowed) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    });
  }

  const body = await request.json();
  const { conversationId, message } = body as {
    conversationId: string;
    message: string;
  };

  if (!conversationId || !message) {
    return new Response("Missing conversationId or message", { status: 400 });
  }

  if (!UUID_RE.test(conversationId)) {
    return new Response("Invalid conversationId format", { status: 400 });
  }

  if (typeof message !== "string" || message.length > MAX_MESSAGE_LENGTH) {
    return new Response(`Message too long (max ${MAX_MESSAGE_LENGTH} chars)`, {
      status: 400,
    });
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
