// One-way conversion of the legacy `Block[]` body into HTML that Koenig can
// import as its initial editor state. Used the first time a pre-Koenig post
// is opened; the result is written to `staged.body` only, so the published
// copy (still `Block[]`) keeps rendering unchanged until the author publishes.

import type { Block } from "@/content/site";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${esc(part).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function figure(src: string, alt: string, caption?: string, credit?: string): string {
  const captionText = [caption, credit].filter(Boolean).join(" — ");
  return `<figure class="kg-card kg-image-card">\n<img src="${esc(src)}" alt="${esc(alt)}">\n${
    captionText ? `<figcaption>${esc(captionText)}</figcaption>` : ""
  }\n</figure>`;
}

export function blocksToHtml(blocks: Block[] | undefined): string {
  if (!blocks?.length) return "";
  const out: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "text":
        out.push(paragraphs(block.body));
        break;
      case "heading":
        out.push(`<h2>${esc(block.text)}</h2>`);
        break;
      case "list": {
        const tag = block.ordered ? "ol" : "ul";
        out.push(
          `<${tag}>\n${block.items.map((item) => `<li>${esc(item)}</li>`).join("\n")}\n</${tag}>`,
        );
        break;
      }
      case "image":
        out.push(
          block.src
            ? figure(block.src, block.alt ?? "", block.caption, block.credit)
            : `<p><em>${esc(block.alt || "Image")}</em></p>`,
        );
        break;
      case "media": {
        const items = block.items ?? [];
        const usable = items.filter((item) => item.src);
        if (usable.length) {
          for (const item of usable) {
            const src = item.src as string;
            const isVideo = /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(src);
            if (isVideo) {
              out.push(
                `<figure class="kg-card kg-video-card">\n<video src="${esc(src)}" controls></video>\n${
                  item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ""
                }\n</figure>`,
              );
            } else if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(src)) {
              out.push(
                `<figure class="kg-card kg-audio-card">\n<audio src="${esc(src)}" controls></audio>\n${
                  item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ""
                }\n</figure>`,
              );
            } else {
              out.push(figure(src, item.alt ?? "", item.caption, item.credit));
            }
          }
        } else if (block.caption) {
          out.push(`<p><em>${esc(block.caption)}</em></p>`);
        }
        break;
      }
      case "video":
        if (block.src) {
          out.push(
            `<figure class="kg-card kg-video-card">\n<video src="${esc(block.src)}" controls></video>\n${
              block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ""
            }\n</figure>`,
          );
        } else if (block.embed) {
          out.push(`<p><a href="${esc(block.embed)}">${esc(block.caption ?? block.embed)}</a></p>`);
        }
        break;
      case "link":
        out.push(
          `<p><a href="${esc(block.href)}">${esc(block.title)}</a>${
            block.description ? ` — ${esc(block.description)}` : ""
          }</p>`,
        );
        break;
      case "code":
        out.push(
          `<pre><code class="language-${esc(block.language || "text")}">${esc(block.code)}</code></pre>${
            block.caption ? `<p><em>${esc(block.caption)}</em></p>` : ""
          }`,
        );
        break;
      case "file":
        out.push(
          block.href
            ? `<p><a href="${esc(block.href)}">${esc(block.name)}</a>${
                block.description ? ` — ${esc(block.description)}` : ""
              }</p>`
            : `<p><strong>${esc(block.name)}</strong>${block.description ? ` — ${esc(block.description)}` : ""}</p>`,
        );
        break;
      case "quote":
        out.push(
          `<blockquote><p>${esc(block.text)}</p>${
            block.cite ? `<cite>${esc(block.cite)}</cite>` : ""
          }</blockquote>`,
        );
        break;
      case "callout":
        out.push(
          `<blockquote><p>${block.title ? `<strong>${esc(block.title)}</strong><br>` : ""}${esc(block.body)}</p></blockquote>`,
        );
        break;
    }
  }

  return out.filter(Boolean).join("\n");
}
