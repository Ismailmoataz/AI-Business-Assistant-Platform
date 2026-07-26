import { BarChart3, FileSearch, ListChecks, MessageSquareText, Sparkles } from "lucide-react";

const suggestions = [
  { icon: FileSearch, label: "Summarize our latest company policy" },
  { icon: ListChecks, label: "What should I prioritize this week?" },
  { icon: BarChart3, label: "Compare the risks in our active projects" },
];

export function EmptyConversation({ onSuggestion }: { onSuggestion: (value: string) => void }) {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-10 text-center">
      <div className="relative mb-7 grid size-24 place-items-center rounded-[28px] border bg-card shadow-card">
        <div className="absolute -left-8 top-2 h-10 w-16 -rotate-6 rounded-xl border bg-background/90 shadow-sm" />
        <div className="absolute -right-9 bottom-1 h-12 w-20 rotate-6 rounded-xl border bg-accent/70 shadow-sm" />
        <span className="relative grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <MessageSquareText className="size-6" />
        </span>
        <Sparkles className="absolute -right-3 -top-3 size-5 text-primary" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Orbit AI workspace</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">What can I help you move forward?</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
        Ask questions grounded in your company knowledge, turn scattered context into a clear plan, or explore a new idea.
      </p>
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
        {suggestions.map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSuggestion(label)}
            className="group rounded-2xl border bg-card p-4 text-left text-sm leading-5 shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="mb-3 grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4" />
            </span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
