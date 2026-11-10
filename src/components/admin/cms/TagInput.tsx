// Searchable tag input: Enter/comma adds, Backspace removes last, chip remove button.

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TagInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addTag = () => {
    const next = draft.trim();
    if (!next) return;
    if (value.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...value, next]);
    setDraft("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex w-full flex-wrap gap-2 items-center border border-input rounded-lg px-3 py-2 bg-background focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
      {value.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground"
        >
          {tag}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeTag(tag)}
            aria-label={`Remove ${tag}`}
            className="p-0 -ml-1"
          >
            ×
          </Button>
        </span>
      ))}
      <Input
        ref={inputRef}
        id={id}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-auto flex-1 min-w-[120px] border-none bg-transparent px-0 py-1 text-sm outline-none focus:ring-0"
      />
    </div>
  );
}
