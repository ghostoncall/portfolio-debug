/* eslint-disable @typescript-eslint/no-explicit-any */
// Date field: YYYY-MM-DD text input with a Radix Popover + Calendar picker.

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function DateField({
  label,
  value,
  onChange,
  error,
}: {
  label?: string | undefined;
  value?: string | undefined;
  onChange: (value?: string | undefined) => void;
  error?: string | undefined;
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Date | undefined>(
    value && DATE.test(value) ? parseISO(value) : undefined,
  );

  const handleSelect = (date: Date) => {
    setSelected(date);
    setOpen(false);
    onChange(format(date, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-1">
      {label && <span className="block text-xs font-medium text-muted-foreground">{label}</span>}
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between text-left text-sm">
            {value || <span className="text-muted-foreground">Select date</span>}
            <span className="ml-auto text-xs text-muted-foreground">📅</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0 border-border">
          <Calendar mode="single" selected={selected} onSelect={handleSelect as any} initialFocus />
        </PopoverContent>
      </Popover>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
