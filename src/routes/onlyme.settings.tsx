/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { getStaged, updateStaged, publishItem, revertItem } from "@/lib/server-fns";
import type { SiteIdentity } from "@/db/schema";

export const Route = createFileRoute("/onlyme/settings")({
  component: Settings,
});

function Settings() {
  const [data, setData] = React.useState<{ published: SiteIdentity; staged: SiteIdentity } | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "ok" | "error">("idle");
  const [name, setName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [edition, setEdition] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [socials, setSocials] = React.useState<{ label: string; href?: string }[]>([]);

  React.useEffect(() => {
    (getStaged as any)({ data: { table: "settings", slug: "site" } }).then((d: any) => {
      setData(d);
      const staged = d.staged as SiteIdentity;
      setName(staged.name);
      setTitle(staged.title);
      setEdition(staged.edition);
      setEmail(staged.email);
      setSocials(staged.socials as { label: string; href?: string }[]);
    });
  }, []);

  if (!data) return <div className="text-muted-foreground">Loading…</div>;

  async function handleSave() {
    setSaving(true);
    try {
      await (updateStaged as any)({
        data: {
          table: "settings",
          slug: "site",
          content: { name, title, edition, email, socials },
          kind: "site",
        },
      });
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setSaving(true);
    try {
      await (publishItem as any)({ data: { table: "settings", slug: "site" } });
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
      const d = await (getStaged as any)({ data: { table: "settings", slug: "site" } });
      setData(d);
      const staged = d.staged as SiteIdentity;
      setName(staged.name);
      setTitle(staged.title);
      setEdition(staged.edition);
      setEmail(staged.email);
      setSocials(staged.socials as { label: string; href?: string }[]);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert() {
    setSaving(true);
    try {
      await (revertItem as any)({ data: { table: "settings", slug: "site" } });
      const d = await (getStaged as any)({ data: { table: "settings", slug: "site" } });
      setData(d);
      const staged = d.staged as SiteIdentity;
      setName(staged.name);
      setTitle(staged.title);
      setEdition(staged.edition);
      setEmail(staged.email);
      setSocials(staged.socials as { label: string; href?: string }[]);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
          ← Back
        </Link>
        <h2 className="text-lg font-medium text-foreground">Settings</h2>
      </div>

      <div className="border border-border rounded-lg p-6">
        <div className="space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Site name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-input bg-background px-3 py-2 text-foreground focus:border-ring"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-input bg-background px-3 py-2 text-foreground focus:border-ring"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Edition</span>
            <input
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
              className="w-full border border-input bg-background px-3 py-2 text-foreground focus:border-ring"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-input bg-background px-3 py-2 text-foreground focus:border-ring"
            />
          </label>
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-foreground mb-3">Socials</h3>
            <div className="space-y-2">
              {socials.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={s.label}
                    onChange={(e) => {
                      const n = [...socials];
                      n[i] = { ...n[i]!, label: e.target.value };
                      setSocials(n);
                    }}
                    className="flex-1 border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring"
                  />
                  <input
                    value={s.href ?? ""}
                    onChange={(e) => {
                      const n = [...socials];
                      n[i] = { ...n[i]!, href: e.target.value };
                      setSocials(n);
                    }}
                    className="flex-1 border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring"
                  />
                  <button
                    onClick={() => setSocials(socials.filter((_, j) => j !== i))}
                    className="text-xs text-destructive underline"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => setSocials([...socials, { label: "", href: "" }])}
                className="text-xs text-link hover:underline"
              >
                + Add social
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary px-6 py-3 text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:opacity-90"
        >
          Save staged
        </button>
        <button
          onClick={handlePublish}
          disabled={saving}
          className="border border-input bg-background px-6 py-3 text-foreground rounded-lg font-medium disabled:opacity-50 hover:bg-accent"
        >
          Publish
        </button>
        <button
          onClick={handleRevert}
          disabled={saving}
          className="border border-input bg-background px-6 py-3 text-foreground rounded-lg font-medium disabled:opacity-50 hover:bg-accent"
        >
          Revert
        </button>
      </div>

      {status === "ok" && <p className="text-sm text-success">Saved.</p>}
      {status === "error" && <p className="text-sm text-destructive">Error. Try again.</p>}
    </div>
  );
}

import React from "react";
