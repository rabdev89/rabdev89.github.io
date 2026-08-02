"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-bold">Something went wrong</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          An unexpected error occurred. Please try again or contact support if
          the problem persists.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-[var(--primary)] px-6 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
