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
        {isUser ? (
          <p className="whitespace-pre-wrap">{cleanContent.trim()}</p>
        ) : (
          <MessageContent content={cleanContent.trim()} />
        )}

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

interface ContentBlock {
  type: "text" | "code";
  content: string;
  language?: string;
}

function parseBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index).trim();
      if (textBefore) {
        blocks.push({ type: "text", content: textBefore });
      }
    }
    blocks.push({
      type: "code",
      content: match[2].trimEnd(),
      language: match[1] || undefined,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) {
      blocks.push({ type: "text", content: remaining });
    }
  }

  return blocks;
}

function MessageContent({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  if (blocks.length === 0) {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  if (blocks.length === 1 && blocks[0].type === "text") {
    return <FormattedText text={blocks[0].content} />;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <CodeBlock key={i} code={block.content} language={block.language} />
        ) : (
          <FormattedText key={i} text={block.content} />
        )
      )}
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="mt-2 text-sm font-bold">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="mt-1.5 text-sm font-semibold">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-1.5 pl-2">
              <span className="text-[var(--muted)]">&bull;</span>
              <span className="whitespace-pre-wrap">{line.slice(2)}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^(\d+)\.\s/)?.[1];
          return (
            <div key={i} className="flex gap-1.5 pl-2">
              <span className="text-[var(--muted)]">{num}.</span>
              <span className="whitespace-pre-wrap">
                {line.replace(/^\d+\.\s/, "")}
              </span>
            </div>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="font-semibold">
              {line.slice(2, -2)}
            </p>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-1" />;
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInlineCode(line)}
          </p>
        );
      })}
    </div>
  );
}

function renderInlineCode(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <code
        key={match.index}
        className="rounded bg-[var(--border)] px-1 py-0.5 text-xs font-mono"
      >
        {match[1]}
      </code>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function CodeBlock({
  code,
  language,
}: {
  code: string;
  language?: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[var(--border)]">
      {language && (
        <div className="flex items-center justify-between bg-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
          <span>{language}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
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
