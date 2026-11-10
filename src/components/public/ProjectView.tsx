/* eslint-disable @typescript-eslint/no-explicit-any */
// Public project detail view — used on /projects/$slug and in admin preview.

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Blocks } from "@/components/blocks";
import { Media } from "@/components/media";

export function ProjectView({ project, skills = [] }: { project: any; skills?: any[] }) {
  const skillMap = React.useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const related = (project.skillIds ?? []).map((id: any) => skillMap.get(id)).filter(Boolean);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[0.68rem] uppercase tracking-wider text-muted-foreground">
          {project.year}
        </span>
        {project.status && (
          <Badge variant="secondary" className="text-[0.65rem] px-2 py-0.5">
            {project.status}
          </Badge>
        )}
        {project.featured && (
          <Badge variant="outline" className="text-[0.65rem] px-2 py-0.5">
            Featured
          </Badge>
        )}
      </div>

      <h1 className="font-display text-4xl text-foreground">{project.title}</h1>
      {project.dek && (
        <p className="font-serif text-xl italic text-muted-foreground">{project.dek}</p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-border py-4 text-sm md:grid-cols-3">
        <div>
          <dt className="label-caps text-muted-foreground">Year</dt>
          <dd>{project.year}</dd>
        </div>
        <div>
          <dt className="label-caps text-muted-foreground">Category</dt>
          <dd>{project.category}</dd>
        </div>
        <div className="col-span-2 md:col-span-1">
          <dt className="label-caps text-muted-foreground">Stack</dt>
          <dd>{project.stack?.join(", ") ?? ""}</dd>
        </div>
        {project.duration && (
          <div>
            <dt className="label-caps text-muted-foreground">Duration</dt>
            <dd>{project.duration}</dd>
          </div>
        )}
        {project.role && (
          <div>
            <dt className="label-caps text-muted-foreground">Role</dt>
            <dd>{project.role}</dd>
          </div>
        )}
      </dl>

      {project.summary && (
        <div className="my-6">
          <h2 className="mb-3 text-2xl text-foreground">Summary</h2>
          <p className="font-serif text-foreground">{project.summary}</p>
        </div>
      )}

      {(project.cover || project.thumbnail) && (
        <figure className="my-6">
          <img
            src={project.cover?.src ?? project.thumbnail?.src}
            alt={project.cover?.alt ?? project.thumbnail?.alt ?? "Cover"}
            className="w-full object-cover"
            style={{ aspectRatio: "16/9" }}
          />
        </figure>
      )}

      {project.gallery && project.gallery.length && (
        <div className="my-6">
          <h2 className="mb-3 text-2xl text-foreground">Gallery</h2>
          <Media items={project.gallery} layout="grid" ratio="16/9" />
        </div>
      )}

      {project.links && project.links.length && (
        <div className="my-6">
          <h2 className="mb-3 text-2xl text-foreground">Links</h2>
          <div className="space-y-2">
            {project.links.map((link: any) => (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group border-t border-b border-border py-3 flex items-center gap-2 hover:bg-muted"
              >
                <span className="label-caps text-muted-foreground">{link.kind}</span>
                <span className="font-serif text-foreground group-hover:underline">
                  {link.label}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {related.length && (
        <div className="my-6">
          <h2 className="mb-3 text-2xl text-foreground">Related skills</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((s: any) => (
              <Badge key={s.id} variant="outline" className="text-xs px-2 py-1">
                {s.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {project.challenges && (
        <div className="my-6">
          <h2 className="mb-3 text-2xl text-foreground">Challenges</h2>
          <p className="font-serif text-foreground">{project.challenges}</p>
        </div>
      )}

      {project.achievements && project.achievements.length && (
        <div className="my-6">
          <h2 className="mb-3 text-2xl text-foreground">Achievements</h2>
          <ul className="list-disc pl-6 space-y-1 font-serif text-foreground">
            {project.achievements.map((a: string, i: number) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {project.blocks && project.blocks.length && <Blocks blocks={project.blocks} />}
    </div>
  );
}
