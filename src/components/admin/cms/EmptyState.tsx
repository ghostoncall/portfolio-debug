// Empty state for CMS sections.

import * as React from "react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg p-12 text-center bg-muted/50">
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      {description && <p className="text-muted-foreground mt-2">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
