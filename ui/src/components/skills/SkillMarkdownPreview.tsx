interface SkillMarkdownPreviewProps {
  content: string;
}

const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => ENTITY_MAP[ch] ?? ch);
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function renderMarkdown(md: string): string {
  // Escape HTML entities first, then apply markdown transformations.
  // Code blocks are preserved by placeholder swap so their contents stay escaped.
  const codeBlocks: string[] = [];
  let escaped = escapeHtml(md);

  // Extract code blocks into placeholders (content is already HTML-escaped)
  escaped = escaped.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, _lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(code);
      return `__CODE_BLOCK_${idx}__`;
    },
  );

  let html = escaped
    // Headings (order matters: ### before ## before #)
    .replace(/^### (.+)/gm, '<h3 class="text-sm font-semibold mt-4 mb-2 text-foreground">$1</h3>')
    .replace(/^## (.+)/gm, '<h2 class="text-base font-semibold mt-5 mb-2 text-foreground">$1</h2>')
    .replace(/^# (.+)/gm, '<h1 class="text-lg font-bold mt-6 mb-3 text-foreground">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>')
    // List items
    .replace(/^- (.+)/gm, '<li class="ml-4 text-sm text-muted-foreground leading-relaxed">$1</li>')
    // Numbered list items
    .replace(/^\d+\. (.+)/gm, '<li class="ml-4 text-sm text-muted-foreground leading-relaxed list-decimal">$1</li>')
    // Links -- only allow http/https protocols to block javascript: XSS
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_match, text, href) => {
        const rawHref = href.replace(/&amp;/g, "&");
        if (!isSafeUrl(rawHref)) {
          return text;
        }
        return `<a href="${href}" class="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
      },
    )
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="text-sm text-muted-foreground mb-2">');

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, '<ul class="my-2 space-y-1">$1</ul>');

  // Restore code blocks
  html = html.replace(/__CODE_BLOCK_(\d+)__/g, (_match, idx) => {
    const code = codeBlocks[parseInt(idx, 10)] ?? "";
    return `<pre class="bg-[oklch(0.12_0_0)] p-3 rounded-md my-2 text-xs overflow-x-auto"><code>${code}</code></pre>`;
  });

  return `<div class="space-y-1"><p class="text-sm text-muted-foreground mb-2">${html}</p></div>`;
}

export function SkillMarkdownPreview({ content }: SkillMarkdownPreviewProps) {
  if (!content) {
    return (
      <p className="text-sm text-muted-foreground italic py-8 text-center">
        No instructions yet.
      </p>
    );
  }

  return (
    <div
      className="prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}
