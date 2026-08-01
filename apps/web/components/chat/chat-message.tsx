export interface Citation {
  page: number;
  section: string;
  filename: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  const cleanContent = message.content.replace(
    /\[\[page\s+\d+,\s*section\s+"[^"]*",\s*filename\s+"[^"]*"\]\]/g,
    ""
  );

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
          isUser
            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "bg-[var(--accent)]"
        }`}
      >
        <p className="whitespace-pre-wrap">{cleanContent.trim()}</p>

        {message.citations && message.citations.length > 0 && (
          <div className="mt-3 border-t border-[var(--border)] pt-2">
            <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">
              Sources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((c, i) => (
                <CitationChip key={i} citation={c} index={i + 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CitationChip({
  citation,
  index,
}: {
  citation: Citation;
  index: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-[var(--primary)]/10 px-2 py-1 text-xs text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20"
      title={`${citation.filename} — page ${citation.page}${citation.section ? `, ${citation.section}` : ""}`}
    >
      <span className="font-semibold">[{index}]</span>
      <span className="truncate max-w-[120px]">{citation.filename}</span>
      <span className="text-[var(--muted)]">p.{citation.page}</span>
    </span>
  );
}
