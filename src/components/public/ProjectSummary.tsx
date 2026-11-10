/* eslint-disable @typescript-eslint/no-explicit-any */
// Public project summary card — used on /projects and the home page.

import { Link } from "@tanstack/react-router";
import * as React from "react";
import { Badge } from "@/components/ui/badge";

export function ProjectSummary({ project }: { project: any }) {
  const statusBadge = project.status === "archived" ? "destructive" : "secondary";
  return (
    <article
      data-testid="public-project-card"
      className="border-b border-border py-6 last:border-0"
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-[0.68rem] uppercase tracking-wider text-muted-foreground">
          {project.year}
        </span>
        {project.status && (
          <Badge variant={statusBadge} className="text-[0.65rem] px-2 py-0.5">
            {project.status}
          </Badge>
        )}
        {project.featured && (
          <Badge variant="outline" className="text-[0.65rem] px-2 py-0.5">
            Featured
          </Badge>
        )}
      </div>
      <Link to="/projects/$slug" params={{ slug: project.slug }} className="block">
        <span className="label-caps text-muted-foreground block mb-1">{project.category}</span>
        <span className="block font-display text-3xl text-foreground group-hover:underline">
          {project.title}
        </span>
        {project.dek && (
          <p className="mt-1 block font-serif text-muted-foreground">{project.dek}</p>
        )}
      </Link>
      {project.stack && project.stack.length && (
        <p className="mt-3 block text-sm text-link">{project.stack.join(" · ")}</p>
      )}
      {project.thumbnail && (
        <figure className="mt-4">
          <img
            src={project.thumbnail.src}
            alt={project.thumbnail.alt ?? project.title}
            className="w-full object-cover"
            style={{ aspectRatio: "16/9" }}
          />
        </figure>
      )}
    </article>
  );
}
