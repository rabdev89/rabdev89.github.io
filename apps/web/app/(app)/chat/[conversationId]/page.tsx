import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";

interface Props {
  params: Promise<{ conversationId: string }>;
}

export default async function ConversationPage({ params }: Props) {
  const { orgId } = await auth();
  if (!orgId) redirect("/dashboard");

  const { conversationId } = await params;

  return <ChatInterface conversationId={conversationId} />;
}
