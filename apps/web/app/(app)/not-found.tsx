import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-bold">Page not found</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block rounded-lg bg-[var(--primary)] px-6 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
