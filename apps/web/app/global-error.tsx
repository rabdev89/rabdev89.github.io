"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
          }}
        >
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              Something went wrong
            </h2>
            <p style={{ marginTop: "0.5rem", color: "#666", fontSize: "0.875rem" }}>
              A critical error occurred. Please refresh the page.
            </p>
            {error.digest && (
              <p style={{ marginTop: "0.5rem", color: "#999", fontSize: "0.75rem" }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                marginTop: "1rem",
                padding: "0.5rem 1.5rem",
                borderRadius: "0.5rem",
                border: "1px solid #ddd",
                background: "#000",
                color: "#fff",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
