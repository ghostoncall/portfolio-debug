import { useState } from "react";
import type { Block } from "@/content/site";
import { Media } from "@/components/media";

function Placeholder({ label, ratio = "16/9" }: { label: string; ratio?: string | undefined }) {
  return (
    <div
      className="flex w-full items-center justify-center border border-dashed border-border bg-muted"
      style={{ aspectRatio: ratio }}
    >
      <span className="label-caps text-muted-foreground">{label}</span>
    </div>
  );
}

function CodeBlock({
  code,
  language,
  caption,
}: {
  code: string;
  language: string;
  caption?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <figure className="my-8">
      <div className="border border-border bg-muted">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="label-caps text-muted-foreground">{language}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="label-caps text-link hover:underline"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-foreground">
          <code>{code}</code>
        </pre>
      </div>
      {caption && <figcaption className="mt-2 text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "media": {
      const { type: _type, ...props } = block;
      return <Media {...props} />;
    }
    case "text":
      return <p className="prose-editorial my-5 text-foreground">{block.body}</p>;
    case "heading":
      return <h2 className="mt-12 mb-4 text-3xl text-foreground">{block.text}</h2>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          className={`prose-editorial my-5 space-y-2 pl-6 ${block.ordered ? "list-decimal" : "list-disc"}`}
        >
          {block.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </Tag>
      );
    }
    case "image":
      return (
        <figure className="my-10">
          {block.src ? (
            <img
              src={block.src}
              alt={block.alt}
              loading="lazy"
              className="w-full object-cover"
              style={{ aspectRatio: block.ratio ?? "16/9" }}
            />
          ) : (
            <Placeholder label="Image" ratio={block.ratio} />
          )}
          {(block.caption || block.credit) && (
            <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
              <span>{block.caption}</span>
              {block.credit && <span className="label-caps">{block.credit}</span>}
            </figcaption>
          )}
        </figure>
      );
    case "video":
      return (
        <figure className="my-10">
          {block.embed ? (
            <iframe
              src={block.embed}
              title={block.caption ?? "Video"}
              className="aspect-video w-full"
              allowFullScreen
            />
          ) : block.src ? (
            <video src={block.src} controls className="aspect-video w-full bg-primary" />
          ) : (
            <Placeholder label="Video" />
          )}
          {block.caption && (
            <figcaption className="mt-2 text-sm text-muted-foreground">{block.caption}</figcaption>
          )}
        </figure>
      );
    case "link":
      return (
        <a
          href={block.href}
          target="_blank"
          rel="noreferrer"
          className="group my-6 block border-t border-b border-border py-4 transition-colors hover:bg-muted"
        >
          {block.source && <span className="label-caps text-muted-foreground">{block.source}</span>}
          <span className="block font-serif text-lg text-foreground group-hover:underline">
            {block.title} →
          </span>
          {block.description && (
            <span className="text-sm text-muted-foreground">{block.description}</span>
          )}
        </a>
      );
    case "code":
      return <CodeBlock {...block} />;
    case "file":
      return (
        <div className="my-4 flex items-center gap-4 border border-border p-4">
          <div className="flex h-14 w-11 shrink-0 items-center justify-center bg-primary">
            <span className="label-caps text-primary-foreground">{block.kind ?? "File"}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-foreground">{block.name}</p>
            {block.description && (
              <p className="text-sm text-muted-foreground">{block.description}</p>
            )}
          </div>
          {block.href ? (
            <a
              href={block.href}
              target="_blank"
              rel="noreferrer"
              className="label-caps text-link hover:underline"
            >
              View
            </a>
          ) : (
            <span className="label-caps text-muted-foreground">Pending</span>
          )}
        </div>
      );
    case "quote":
      return (
        <blockquote className="my-12 border-l-2 border-foreground pl-6">
          <p className="font-display text-3xl italic leading-snug text-foreground">
            “{block.text}”
          </p>
          {block.cite && (
            <cite className="label-caps mt-3 block not-italic text-muted-foreground">
              {block.cite}
            </cite>
          )}
        </blockquote>
      );
    case "callout":
      return (
        <aside className="my-8 bg-muted p-6">
          {block.title && <p className="label-caps mb-2 text-foreground">{block.title}</p>}
          <p className="prose-editorial text-foreground">{block.body}</p>
        </aside>
      );
  }
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  );
}
