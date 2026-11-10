/* eslint-disable @typescript-eslint/no-explicit-any */
// Public experience view — timeline, current roles marked Present.

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Blocks } from "@/components/blocks";
import { format, parseISO } from "date-fns";
import { Media } from "@/components/media";

export function ExperienceView({ content }: { content: any }) {
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const entries = (content.entries ?? [])
    .filter((e: any) => e.visible !== false)
    .sort(
      (a: any, b: any) =>
        Number(b.sort ?? 0) - Number(a.sort ?? 0) ||
        (a.startDate ?? "").localeCompare(b.startDate ?? ""),
    );

  const yearOf = (iso: string | undefined, fallback: string): string => {
    if (typeof iso === "string" && DATE.test(iso)) return format(parseISO(iso), "yyyy");
    return fallback;
  };

  const when = (entry: any): string => {
    if (entry.current && !entry.startDate) return entry.period ?? "Present";
    if (entry.current) return `${yearOf(entry.startDate, "")} — Present`;
    if (!entry.startDate && !entry.endDate) return entry.period ?? "";
    return `${yearOf(entry.startDate, "")} — ${yearOf(entry.endDate, entry.current ? "Present" : "")}`;
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl text-foreground">Experience</h2>
      {entries.map((entry: any) => (
        <section key={entry.id} className="border-b border-border py-6 last:border-0 relative">
          <div className="flex items-center gap-2 mb-1">
            {entry.current && (
              <Badge variant="secondary" className="text-[0.65rem] px-2 py-0.5">
                Current
              </Badge>
            )}
            <span className="text-[0.68rem] uppercase tracking-wider text-muted-foreground">
              {entry.current ? "Present" : when(entry)}
            </span>
            {entry.workMode && (
              <span className="label-caps text-[0.65rem] text-muted-foreground">
                {entry.workMode}
              </span>
            )}
          </div>
          <h2 className="text-3xl text-foreground">{entry.role}</h2>
          <p className="font-serif italic text-muted-foreground">
            {entry.org}
            {entry.website && (
              <>
                {" · "}
                <a
                  href={entry.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link underline"
                >
                  {String(entry.website)
                    .replace(/^https?:\/\/(www\.)?/, "")
                    .replace(/\/$/, "")}
                </a>
              </>
            )}
          </p>
          {entry.location && <p className="text-sm text-muted-foreground mt-1">{entry.location}</p>}
          {entry.overview && <p className="my-4 font-serif text-foreground">{entry.overview}</p>}
          {entry.responsibilities && entry.responsibilities.length && (
            <div className="my-4">
              <h3 className="text-sm label-caps text-muted-foreground mb-1">Responsibilities</h3>
              <ul className="list-disc pl-6 space-y-1 font-serif text-foreground">
                {entry.responsibilities.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {entry.achievements && entry.achievements.length && (
            <div className="my-4">
              <h3 className="text-sm label-caps text-muted-foreground mb-1">Achievements</h3>
              <ul className="list-disc pl-6 space-y-1 font-serif text-foreground">
                {entry.achievements.map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {entry.tech && entry.tech.length && (
            <div className="my-4 flex flex-wrap gap-2">
              {entry.tech.map((t: string, i: number) => (
                <Badge key={i} variant="outline" className="text-xs px-2 py-1">
                  {t}
                </Badge>
              ))}
            </div>
          )}
          {entry.links && entry.links.length > 0 && (
            <div className="my-4 flex flex-wrap gap-4 text-sm">
              {entry.links
                .filter((l: any) => l.href)
                .map((l: any, i: number) => (
                  <a
                    key={l.id ?? i}
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-link underline"
                  >
                    {l.label || l.href} ↗
                  </a>
                ))}
            </div>
          )}
          {entry.logo && (
            <figure className="my-4">
              <img
                src={entry.logo.src}
                alt={entry.logo.alt ?? entry.role}
                className="h-16 object-contain"
              />
            </figure>
          )}
          {entry.media && entry.media.length && (
            <div className="my-4">
              <Media items={entry.media} layout="grid" ratio="16/9" />
            </div>
          )}
          {entry.blocks && entry.blocks.length && <Blocks blocks={entry.blocks} />}
        </section>
      ))}
    </div>
  );
}
