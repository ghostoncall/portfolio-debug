// Preview pane: editor / split / preview toggle, persisted in localStorage.

import * as React from "react";

export type CmsPreviewMode = "editor" | "split" | "preview";

export function PreviewPane({
  mode,
  onModeChange,
  renderEditor,
  renderPreview,
}: {
  mode: CmsPreviewMode;
  onModeChange: (mode: CmsPreviewMode) => void;
  renderEditor: () => React.ReactNode;
  renderPreview: () => React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const persisted = mounted
    ? (localStorage.getItem("onlyme:cmsPreviewMode") as CmsPreviewMode | null)
    : null;
  const current = persisted ?? mode;

  const toggle = (m: CmsPreviewMode) => {
    onModeChange(m);
    try {
      localStorage.setItem("onlyme:cmsPreviewMode", m);
    } catch {
      // Ignore storage errors.
    }
  };

  const isPreview = current === "preview";
  const isSplit = current === "split";

  return (
    <div
      className="flex flex-col gap-2 border border-border rounded-lg p-4 bg-muted/30"
      data-testid="cms-preview"
    >
      <div className="flex items-center gap-1">
        <button
          onClick={() => toggle("editor")}
          className={`px-3 py-1 text-xs border rounded-md text-xs transition-colors ${
            current === "editor"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-accent"
          }`}
        >
          Editor
        </button>
        <button
          onClick={() => toggle("split")}
          className={`px-3 py-1 text-xs border rounded-md text-xs transition-colors ${
            current === "split"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-accent"
          }`}
        >
          Split
        </button>
        <button
          onClick={() => toggle("preview")}
          className={`px-3 py-1 text-xs border rounded-md text-xs transition-colors ${
            current === "preview"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-accent"
          }`}
        >
          Preview
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {isSplit ? (
          <div className="grid grid-cols-2 gap-4 min-h-[400px]">
            <div className="border border-border p-3 bg-background">{renderEditor()}</div>
            <div className="border border-border p-3 bg-background">{renderPreview()}</div>
          </div>
        ) : isPreview ? (
          <div className="border border-border p-3 bg-background min-h-[400px]">
            {renderPreview()}
          </div>
        ) : (
          <div className="border border-border p-3 bg-background min-h-[400px]">
            {renderEditor()}
          </div>
        )}
      </div>
    </div>
  );
}
