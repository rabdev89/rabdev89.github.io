import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold tracking-tight">DocuMind</h1>
      <p className="max-w-md text-center text-[var(--muted)]">
        Upload your documents and chat with an AI agent team that retrieves,
        analyzes, and cites your content.
      </p>
      <a
        href="/sign-in"
        className="rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
      >
        Get started
      </a>
    </main>
  );
}
