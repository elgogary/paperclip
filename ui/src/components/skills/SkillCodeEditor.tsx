interface SkillCodeEditorProps {
  content: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function SkillCodeEditor({ content, onChange, readOnly = false }: SkillCodeEditorProps) {
  return (
    <textarea
      className="w-full min-h-[400px] p-4 bg-[oklch(0.12_0_0)] border border-border rounded-md
                 font-mono text-xs text-foreground leading-relaxed resize-y outline-none
                 focus:border-foreground/30 placeholder:text-muted-foreground"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder="Write your skill instructions in markdown..."
      spellCheck={false}
    />
  );
}
