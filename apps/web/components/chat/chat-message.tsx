export interface Citation {
  docId: string;
  page: number;
  section?: string;
  text: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
          isUser
            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "bg-[var(--accent)]"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.citations.map((c, i) => (
              <span
                key={i}
                className="inline-block rounded bg-[var(--primary)]/10 px-2 py-0.5 text-xs text-[var(--primary)]"
                title={c.text}
              >
                p.{c.page}
                {c.section ? ` — ${c.section}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
