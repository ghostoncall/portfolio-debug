/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { exportBackup } from "@/lib/server-fns";

export const Route = createFileRoute("/onlyme/export")({
  component: Export,
});

function Export() {
  const [exporting, setExporting] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "ok" | "error">("idle");

  async function handleExport() {
    setExporting(true);
    try {
      const backup = await (exportBackup as any)({ data: {} });
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
          ← Back
        </Link>
        <h2 className="text-lg font-medium text-foreground">Backup</h2>
      </div>

      <div className="border border-border rounded-lg p-6">
        <p className="text-sm text-muted-foreground mb-6">
          Downloads all published content (pages, projects, blogs, settings) as a JSON file. This is
          your backup — Supabase's free tier does not include automated backups, so download this
          regularly.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="bg-primary px-6 py-3 text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:opacity-90"
        >
          {exporting ? "Downloading…" : "Download backup JSON"}
        </button>
        {status === "ok" && <p className="mt-2 text-sm text-success">Downloaded.</p>}
        {status === "error" && <p className="mt-2 text-sm text-destructive">Export failed.</p>}
      </div>
    </div>
  );
}

import React from "react";
