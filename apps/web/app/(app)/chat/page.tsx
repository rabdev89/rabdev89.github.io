import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NewChatButton } from "@/components/chat/new-chat-button";

export default async function ChatPage() {
  const { orgId } = await auth();
  if (!orgId) redirect("/dashboard");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Chat with your documents</h1>
      <p className="max-w-md text-center text-[var(--muted)]">
        Start a new conversation and your AI agent team will retrieve, analyze,
        and cite answers from your uploaded documents.
      </p>
      <NewChatButton />
    </div>
  );
}
