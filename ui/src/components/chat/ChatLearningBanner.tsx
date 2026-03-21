import { BookOpen, Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type LessonEntry = {
  type: "lesson" | "rule" | "knowledge";
  text: string;
};

type ChatLearningBannerProps = {
  lessons: LessonEntry[];
  onDismiss: () => void;
};

export function ChatLearningBanner({ lessons, onDismiss }: ChatLearningBannerProps) {
  if (lessons.length === 0) return null;

  const typeLabels: Record<string, string> = {
    lesson: "L",
    rule: "S",
    knowledge: "K",
  };

  const typeColors: Record<string, string> = {
    lesson: "bg-blue-100 text-blue-700",
    rule: "bg-amber-100 text-amber-700",
    knowledge: "bg-green-100 text-green-700",
  };

  return (
    <div className="mx-4 mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3 animate-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-primary">
          Agent learned from this chat:
        </span>
      </div>
      <div className="space-y-1.5">
        {lessons.map((lesson, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span
              className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold flex-shrink-0 mt-0.5 ${typeColors[lesson.type] ?? "bg-muted"}`}
            >
              {typeLabels[lesson.type] ?? "?"}
            </span>
            <span className="text-foreground">{lesson.text}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2.5 justify-end">
        <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1">
          <Undo2 className="h-3 w-3" />
          Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[11px] gap-1"
          onClick={onDismiss}
        >
          <Check className="h-3 w-3" />
          OK
        </Button>
      </div>
    </div>
  );
}
