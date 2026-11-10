// Shared CMS form controls.
// Editorial style: quiet admin chrome, hairline borders, square corners, small text.

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const field =
  "w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm";

/** Quiet labeled field wrapper: label above, hint/error below. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && <span className="block text-xs font-medium text-muted-foreground">{label}</span>}
      <div>{children}</div>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function InputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(field, props.className ?? "")} />;
}

/** Select with the same visual language as InputField. */
export function SelectField({
  label,
  value,
  onValueChange,
  options,
  className,
  testId,
}: {
  label?: string | undefined;
  value: string;
  onValueChange: (value: string) => void;
  options: { label: string; value: string }[];
  className?: string | undefined;
  testId?: string | undefined;
}) {
  return (
    <Field label={label} className={className}>
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger className={field} data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string | undefined;
  description?: string | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={cn("border border-border p-6 bg-card space-y-4", className)}>
      {title && (
        <div className="space-y-1">
          <h3 className="label-caps text-muted-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
