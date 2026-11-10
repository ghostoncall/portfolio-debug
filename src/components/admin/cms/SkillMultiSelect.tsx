// Searchable multi-select for skills: checkbox list with selected chips.

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export type SkillOption = {
  id: string;
  name: string;
  category?: string;
  categoryId?: string;
};

export function SkillMultiSelect({
  skills,
  value,
  onChange,
  placeholder,
}: {
  skills: SkillOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const selected = new Set(value);

  const filtered = skills.filter(
    (s) =>
      !query ||
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      (s.category ?? "").toLowerCase().includes(query.toLowerCase()),
  );

  const toggle = (id: string) => {
    if (selected.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <div className="relative w-full">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((id) => {
          const skill = skills.find((s) => s.id === id);
          return (
            <span
              key={id}
              className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground flex items-center gap-1.5"
            >
              {skill?.name ?? id}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((v) => v !== id));
                }}
                className="p-0 -ml-1 text-destructive hover:bg-destructive/10"
              >
                ×
              </Button>
            </span>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className="text-xs px-2 py-1.5"
        >
          {open ? "Close" : "Select skills"}
        </Button>
      </div>
      {open && (
        <div className="z-50 mt-1 max-h-64 overflow-y-auto border border-border rounded-lg bg-background shadow-lg">
          <div className="px-3 py-2 border-b border-border">
            <Input
              placeholder={placeholder ?? "Search skills…"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-sm border-none bg-transparent px-0 py-1 focus:ring-0"
            />
          </div>
          <div className="py-1">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent"
              >
                <Checkbox
                  checked={selected.has(s.id)}
                  onCheckedChange={() => toggle(s.id)}
                  className="shrink-0"
                />
                <span className="flex-1 text-sm">{s.name}</span>
                {s.category && (
                  <span className="ml-auto text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                    {s.category}
                  </span>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No matching skills</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
