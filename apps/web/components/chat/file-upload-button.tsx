"use client";

import { useRef, useCallback, useState, useEffect } from "react";

type UploadState = "idle" | "uploading" | "processing" | "ready" | "failed";

export function FileUploadButton({
  conversationId,
}: {
  conversationId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");

  useEffect(() => {
    if (!activeDocId || state !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/${activeDocId}`);
        if (!res.ok) return;
        const doc = await res.json();
        if (doc.status === "READY") {
          setState("ready");
          setActiveDocId(null);
        } else if (doc.status === "FAILED") {
          setState("failed");
          setActiveDocId(null);
        }
      } catch {
        // keep polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeDocId, state]);

  const handleUpload = useCallback(
    async (file: File) => {
      setState("uploading");
      setFilename(file.name);

      try {
        const presignRes = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/pdf",
            size: file.size,
          }),
        });

        if (!presignRes.ok) {
          const err = await presignRes.json();
          throw new Error(err.error || "Failed to get upload URL");
        }

        const { uploadUrl, documentId } = await presignRes.json();

        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file,
        });

        setState("processing");
        setActiveDocId(documentId);
      } catch (err) {
        console.error("Upload failed:", err);
        setState("failed");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [conversationId]
  );

  const label = {
    idle: "+",
    uploading: "...",
    processing: "...",
    ready: "+",
    failed: "!",
  }[state];

  const title = {
    idle: "Upload document",
    uploading: `Uploading ${filename}...`,
    processing: `Processing ${filename}...`,
    ready: `${filename} ready`,
    failed: `Failed to process ${filename}`,
  }[state];

  const stateColor =
    state === "failed"
      ? "border-red-500 text-red-500"
      : state === "processing"
        ? "border-yellow-500 text-yellow-500"
        : state === "ready"
          ? "border-green-500 text-green-500"
          : "border-[var(--border)] text-[var(--muted)]";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
      <button
        type="button"
        onClick={() => {
          if (state === "ready" || state === "failed") setState("idle");
          inputRef.current?.click();
        }}
        disabled={state === "uploading" || state === "processing"}
        className={`rounded-lg border bg-[var(--card)] px-4 py-3 text-sm transition-colors hover:bg-[var(--accent)] disabled:opacity-50 ${stateColor}`}
        title={title}
      >
        {label}
      </button>
    </>
  );
}
