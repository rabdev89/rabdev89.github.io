"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function NewChatButton({
  variant = "default",
}: {
  variant?: "default" | "icon";
}) {
  const router = useRouter();

  const handleNew = useCallback(() => {
    const id = crypto.randomUUID();
    router.push(`/chat/${id}`);
  }, [router]);

  if (variant === "icon") {
    return (
      <button
        onClick={handleNew}
        className="rounded-md p-1 text-[var(--muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        title="New conversation"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="8" y1="3" x2="8" y2="13" />
          <line x1="3" y1="8" x2="13" y2="8" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={handleNew}
      className="rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
    >
      New conversation
    </button>
  );
}
