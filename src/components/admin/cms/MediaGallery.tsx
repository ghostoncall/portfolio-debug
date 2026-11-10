/* eslint-disable @typescript-eslint/no-explicit-any */
// Sortable media gallery: add from library or by URL, inline alt/caption, reorder, remove.

import * as React from "react";
import { MediaItem } from "@/components/media";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortableList } from "./SortableList";
import { Field } from "./FormSection";

export function MediaGallery({
  items,
  onChange,
  accept = "image",
}: {
  items: MediaItem[];
  onChange: (next: MediaItem[]) => void;
  accept?: "image" | "any" | undefined;
}) {
  const [open, setOpen] = React.useState(false);
  const [newSrc, setNewSrc] = React.useState("");
  const [newAlt, setNewAlt] = React.useState("");

  const addFromUrl = () => {
    if (!newSrc.trim()) return;
    const next: MediaItem = { src: newSrc.trim() };
    if (newAlt.trim()) next.alt = newAlt.trim();
    onChange([...items, next]);
    setNewSrc("");
    setNewAlt("");
  };

  const addFromAsset = (asset: any) => {
    const next: MediaItem = { src: asset.url };
    if (asset.alt ?? asset.name) next.alt = asset.alt ?? asset.name;
    onChange([...items, next]);
    setOpen(false);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, src: string, alt: string) => {
    onChange(
      items.map((item, i) => {
        const next = { ...item, src };
        if (alt) next.alt = alt;
        else delete next.alt;
        return i === index ? next : item;
      }),
    );
  };

  return (
    <Field label="Gallery" hint={undefined} error={undefined} className={undefined}>
      <div className="space-y-3">
        <SortableList<MediaItem>
          items={items}
          getId={(item: MediaItem, i: number) => String(i)}
          onReorder={(next) => onChange(next)}
          renderItem={(item, { index, moveUp, moveDown }) => (
            <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-background">
              <button
                onClick={() => moveUp()}
                disabled={index === 0}
                className="text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => moveDown()}
                disabled={index === items.length - 1}
                className="text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"
                aria-label="Move down"
              >
                ↓
              </button>
              <input
                value={item.src ?? ""}
                onChange={(e) => updateItem(index, e.target.value, item.alt ?? "")}
                placeholder="URL or path"
                className="flex-1 border-none bg-transparent px-0 text-sm focus:ring-0"
              />
              <input
                value={item.alt ?? ""}
                onChange={(e) => updateItem(index, item.src ?? "", e.target.value)}
                placeholder="Alt text"
                className="w-32 border-none bg-transparent px-0 text-sm focus:ring-0"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => removeItem(index)}
                className="h-8 px-2"
              >
                Remove
              </Button>
            </div>
          )}
        />
        <div className="border border-dashed border-border rounded-lg p-3 text-center text-xs text-muted-foreground">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="w-full justify-start"
          >
            + Add from library
          </Button>
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={newSrc}
              onChange={(e) => setNewSrc(e.target.value)}
              placeholder="Paste image URL…"
              className="flex-1 border-none bg-transparent px-0 text-sm focus:ring-0"
            />
            <Input
              value={newAlt}
              onChange={(e) => setNewAlt(e.target.value)}
              placeholder="Alt text"
              className="w-32 border-none bg-transparent px-0 text-sm focus:ring-0"
            />
            <Button variant="default" size="sm" onClick={addFromUrl}>
              Add
            </Button>
          </div>
        </div>
        <MediaPicker
          open={open}
          onClose={() => setOpen(false)}
          accept={accept}
          onSelect={addFromAsset}
        />
      </div>
    </Field>
  );
}
