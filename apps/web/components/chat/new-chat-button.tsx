"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function NewChatButton() {
  const router = useRouter();

  const handleNew = useCallback(() => {
    const id = crypto.randomUUID();
    router.push(`/chat/${id}`);
  }, [router]);

  return (
    <button
      onClick={handleNew}
      className="rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
    >
      New conversation
    </button>
  );
}
