// Save bar: Save, Publish (or Publish updates), Revert, dirty dot, status.

import * as React from "react";
import { Button } from "@/components/ui/button";

export function SaveBar({
  dirty,
  loading,
  saving,
  hasPublished,
  lastSaved,
  error,
  onSave,
  onPublish,
  onRevert,
}: {
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  hasPublished: boolean;
  lastSaved: Date | null;
  error: string | null;
  onSave: () => void;
  onPublish: () => void;
  onRevert: () => void;
}) {
  const statusText = React.useMemo(() => {
    if (error) return "Error";
    if (saving) return "Saving…";
    if (lastSaved)
      return `Saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return "Draft";
  }, [error, saving, lastSaved]);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <span
          data-testid="cms-dirty"
          className={`inline-block h-2 w-2 rounded-full ${
            dirty ? "bg-primary animate-pulse" : "bg-success"
          }`}
          aria-label={dirty ? "unsaved changes" : "saved"}
        />
        <span className="text-xs text-muted-foreground">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          data-testid="cms-revert"
          onClick={onRevert}
          disabled={saving || loading || !dirty}
          variant="outline"
          size="sm"
        >
          Revert
        </Button>
        <Button
          data-testid="cms-publish"
          onClick={onPublish}
          disabled={saving || loading}
          className="px-4"
        >
          {hasPublished ? "Publish updates" : "Publish"}
        </Button>
        <Button data-testid="cms-save" onClick={onSave} disabled={saving || loading || !dirty}>
          {saving && !loading ? "Saving…" : "Save staged"}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground" data-testid="cms-save-status">
        {statusText}
      </div>
    </div>
  );
}
