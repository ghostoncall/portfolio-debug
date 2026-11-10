/* eslint-disable @typescript-eslint/no-explicit-any */
// Editable block array for /onlyme. Each block type gets its own form fields.
// Changes flow up via onChange(blocks) — the parent route persists to staged.

import React, { useState } from "react";
import type { Block } from "@/content/site";

type BlockEditorProps = {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
};

const field =
  "w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm";

const label = (t: string) => (
  <span className="block text-xs font-medium text-muted-foreground mb-1">{t}</span>
);

const textarea = (
  value: string,
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void,
  rows = 3,
) => <textarea value={value} onChange={onChange} rows={rows} className={field} />;

const input = (
  value: string,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  type = "text",
) => <input type={type} value={value} onChange={onChange} className={field} />;

const select = (
  value: string,
  options: { label: string; value: string }[],
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void,
) => (
  <select value={value} onChange={onChange} className={field}>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

const checkbox = (checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={onChange}
    className="rounded border-input bg-background text-primary focus:ring-primary focus:ring-offset-background"
  />
);

function deleteBlock(index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  onChange(blocks.filter((_, i) => i !== index));
}

function addBlock(blocks: Block[], onChange: (b: Block[]) => void, type: Block["type"]) {
  const newBlock: Block =
    type === "text"
      ? { type: "text", body: "" }
      : type === "heading"
        ? { type: "heading", text: "" }
        : type === "list"
          ? { type: "list", items: [""] }
          : type === "image"
            ? { type: "image", alt: "" }
            : type === "video"
              ? { type: "video" }
              : type === "link"
                ? { type: "link", href: "", title: "" }
                : type === "code"
                  ? { type: "code", language: "text", code: "" }
                  : type === "file"
                    ? { type: "file", name: "" }
                    : type === "quote"
                      ? { type: "quote", text: "" }
                      : { type: "callout", body: "" };
  onChange([...blocks, newBlock]);
}

function updateBlock(
  blocks: Block[],
  index: number,
  next: Partial<Block>,
  onChange: (b: Block[]) => void,
) {
  onChange(blocks.map((b, i) => (i === index ? ({ ...b, ...next } as Block) : b)));
}

function MediaEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  const [count, setCount] = useState((block as any).count ?? 1);
  const [layout, setLayout] = useState<"carousel" | "grid" | "stack">(
    ((block as any).layout ?? "carousel") as "carousel" | "grid" | "stack",
  );
  const [ratio, setRatio] = useState<string>((block as any).ratio ?? "16/9");
  const [fit, setFit] = useState<"cover" | "contain">(
    ((block as any).fit ?? "cover") as "cover" | "contain",
  );
  const [caption, setCaption] = useState((block as any).caption ?? "");
  const [credit, setCredit] = useState((block as any).credit ?? "");

  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Media block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Caption")}
          <input value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="col-span-2">
          {label("Credit")}
          <input value={credit} onChange={(e) => setCredit(e.target.value)} />
        </div>
        <div>
          {label("Count (items)")}
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            className={field}
          />
        </div>
        <div>
          {label("Layout")}
          {select(
            layout,
            [
              { label: "Carousel", value: "carousel" },
              { label: "Grid", value: "grid" },
              { label: "Stack", value: "stack" },
            ],
            (e) => setLayout(e.target.value as "carousel" | "grid" | "stack"),
          )}
        </div>
        <div>
          {label("Ratio")}
          {select(
            ratio,
            [
              { label: "16/9", value: "16/9" },
              { label: "4/3", value: "4/3" },
              { label: "1/1", value: "1/1" },
              { label: "3/2", value: "3/2" },
            ],
            (e) => setRatio(e.target.value),
          )}
        </div>
        <div>
          {label("Fit")}
          {select(
            fit,
            [
              { label: "Cover", value: "cover" },
              { label: "Contain", value: "contain" },
            ],
            (e) => setFit(e.target.value as "cover" | "contain"),
          )}
        </div>
      </div>
      <button
        onClick={() => {
          const next: any = {
            type: "media",
            count,
            layout,
            ratio,
            fit,
          };
          if (caption) next.caption = caption;
          if (credit) next.credit = credit;
          updateBlock(blocks, index, next, onChange);
        }}
        className="mt-2 text-xs text-link hover:underline"
      >
        Save media block
      </button>
    </div>
  );
}

function simpleEditor(
  block: Block,
  index: number,
  blocks: Block[],
  onChange: (b: Block[]) => void,
  type: Block["type"],
  fieldName: "body" | "text" | "alt" | "href" | "title" | "name" | "code",
  labelText: string,
  rows?: number,
) {
  const value = (block as any)[fieldName] ?? "";
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">{type} block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      {label(labelText)}
      {rows
        ? textarea(
            value,
            (e) => updateBlock(blocks, index, { [fieldName]: e.target.value }, onChange),
            rows,
          )
        : input(value, (e) =>
            updateBlock(blocks, index, { [fieldName]: e.target.value }, onChange),
          )}
    </div>
  );
}

function ImageEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  const [ratio, setRatio] = useState<string>((block as any).ratio ?? "16/9");
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Image block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Alt text")}
          {input((block as any).alt ?? "", (e) =>
            updateBlock(blocks, index, { alt: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Src (URL or path)")}
          {input((block as any).src ?? "", (e) =>
            updateBlock(blocks, index, { src: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Caption")}
          {input((block as any).caption ?? "", (e) =>
            updateBlock(blocks, index, { caption: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Credit")}
          {input((block as any).credit ?? "", (e) =>
            updateBlock(blocks, index, { credit: e.target.value }, onChange),
          )}
        </div>
        <div>
          {label("Ratio")}
          {select(
            ratio,
            [
              { label: "16/9", value: "16/9" },
              { label: "4/3", value: "4/3" },
              { label: "1/1", value: "1/1" },
              { label: "3/2", value: "3/2" },
            ],
            (e) => setRatio(e.target.value),
          )}
        </div>
      </div>
      <button
        onClick={() => updateBlock(blocks, index, { ratio }, onChange)}
        className="mt-2 text-xs text-link hover:underline"
      >
        Save image block
      </button>
    </div>
  );
}

function VideoEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Video block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Src (file)")}
          {input((block as any).src ?? "", (e) =>
            updateBlock(blocks, index, { src: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Embed (iframe URL)")}
          {input((block as any).embed ?? "", (e) =>
            updateBlock(blocks, index, { embed: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Caption")}
          {input((block as any).caption ?? "", (e) =>
            updateBlock(blocks, index, { caption: e.target.value }, onChange),
          )}
        </div>
      </div>
    </div>
  );
}

function LinkEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Link block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Href")}
          {input((block as any).href, (e) =>
            updateBlock(blocks, index, { href: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Title")}
          {input((block as any).title, (e) =>
            updateBlock(blocks, index, { title: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Source")}
          {input((block as any).source ?? "", (e) =>
            updateBlock(blocks, index, { source: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Description")}
          {input((block as any).description ?? "", (e) =>
            updateBlock(blocks, index, { description: e.target.value }, onChange),
          )}
        </div>
      </div>
    </div>
  );
}

function CodeEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Code block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          {label("Language")}
          {input((block as any).language, (e) =>
            updateBlock(blocks, index, { language: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Caption")}
          {input((block as any).caption ?? "", (e) =>
            updateBlock(blocks, index, { caption: e.target.value }, onChange),
          )}
        </div>
      </div>
      {label("Code")}
      {textarea(
        (block as any).code,
        (e) => updateBlock(blocks, index, { code: e.target.value }, onChange),
        8,
      )}
    </div>
  );
}

function FileEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">File block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Name")}
          {input((block as any).name, (e) =>
            updateBlock(blocks, index, { name: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Href (URL or path)")}
          {input((block as any).href ?? "", (e) =>
            updateBlock(blocks, index, { href: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Kind (PDF, etc.)")}
          {input((block as any).kind ?? "", (e) =>
            updateBlock(blocks, index, { kind: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Description")}
          {input((block as any).description ?? "", (e) =>
            updateBlock(blocks, index, { description: e.target.value }, onChange),
          )}
        </div>
      </div>
    </div>
  );
}

function QuoteEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Quote block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Text")}
          {input((block as any).text, (e) =>
            updateBlock(blocks, index, { text: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Cite")}
          {input((block as any).cite ?? "", (e) =>
            updateBlock(blocks, index, { cite: e.target.value }, onChange),
          )}
        </div>
      </div>
    </div>
  );
}

function CalloutEditor(
  block: Block,
  index: number,
  blocks: Block[],
  onChange: (b: Block[]) => void,
) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Callout block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Title")}
          {input((block as any).title ?? "", (e) =>
            updateBlock(blocks, index, { title: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Body")}
          {textarea((block as any).body, (e) =>
            updateBlock(blocks, index, { body: e.target.value }, onChange),
          )}
        </div>
      </div>
    </div>
  );
}

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const blockTypes: { type: Block["type"]; label: string }[] = [
    { type: "heading", label: "H Heading" },
    { type: "text", label: "¶ Text" },
    { type: "list", label: "• List" },
    { type: "quote", label: "❝ Quote" },
    { type: "code", label: "</> Code" },
    { type: "image", label: "🖼 Image" },
    { type: "video", label: "▶ Video" },
    { type: "link", label: "🔗 Link" },
    { type: "file", label: "📎 File" },
    { type: "callout", label: "❗ Callout" },
    { type: "media", label: "⛶ Media" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 p-3 border border-border rounded-lg bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground mr-1">Add:</span>
        {blockTypes.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => addBlock(blocks, onChange, type)}
            className="border border-input bg-background px-3 py-1.5 text-xs text-foreground rounded hover:bg-accent transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      {blocks.map((block, index) => {
        switch (block.type) {
          case "media":
            return MediaEditor(block, index, blocks, onChange);
          case "text":
            return simpleEditor(block, index, blocks, onChange, "text", "body", "Body");
          case "heading":
            return simpleEditor(block, index, blocks, onChange, "heading", "text", "Text");
          case "list": {
            const ordered = (block as any).ordered ?? false;
            return (
              <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
                <div className="flex justify-between items-start mb-2">
                  <span className="label-caps text-muted-foreground">List block</span>
                  <button
                    onClick={() => deleteBlock(index, blocks, onChange)}
                    className="text-xs text-destructive underline"
                  >
                    Delete
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {checkbox(ordered, (e) =>
                    updateBlock(blocks, index, { ordered: e.target.checked }, onChange),
                  )}
                  <span className="text-xs text-muted-foreground">Ordered list</span>
                </div>
                {label("Items (one per line)")}
                {textarea(
                  (block as any).items.join("\n"),
                  (e) =>
                    updateBlock(
                      blocks,
                      index,
                      {
                        items: e.target.value.split("\n").filter(Boolean),
                        ordered,
                      },
                      onChange,
                    ),
                  4,
                )}
              </div>
            );
          }
          case "image":
            return ImageEditor(block, index, blocks, onChange);
          case "video":
            return VideoEditor(block, index, blocks, onChange);
          case "link":
            return LinkEditor(block, index, blocks, onChange);
          case "code":
            return CodeEditor(block, index, blocks, onChange);
          case "file":
            return FileEditor(block, index, blocks, onChange);
          case "quote":
            return QuoteEditor(block, index, blocks, onChange);
          case "callout":
            return CalloutEditor(block, index, blocks, onChange);
        }
      })}
    </div>
  );
}
