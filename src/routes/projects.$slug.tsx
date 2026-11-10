/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { getPublishedProject, getPublishedSkillsBundle, getSiteIdentity } from "@/lib/server-fns";
import { ProjectView } from "@/components/public/ProjectView";

export const Route = createFileRoute("/projects/$slug")({
  loader: async ({ params }) => {
    const [project, skillsBundle, site] = await Promise.all([
      (getPublishedProject as any)({ data: { slug: params.slug } }),
      (getPublishedSkillsBundle as any)(),
      (getSiteIdentity as any)(),
    ]);
    if (!project) throw notFound();
    return { project, skills: skillsBundle.skills.skills, site };
  },
  head: ({ loaderData }) => {
    const { project, site } = loaderData || {};
    return {
      meta: project
        ? [
            { title: `${project.title} — ${site?.name ?? "Portfolio"}` },
            { name: "description", content: project.dek },
            { property: "og:title", content: project.title },
            { property: "og:description", content: project.dek },
            { property: "og:type", content: "article" },
            { name: "twitter:card", content: "summary_large_image" },
          ]
        : [{ title: "Project not found" }, { name: "robots", content: "noindex" }],
    };
  },
  notFoundComponent: ProjectNotFound,
  component: ProjectPage,
});

function ProjectNotFound() {
  const { site } = (Route.useLoaderData() as { site: any } | null) || {};
  return (
    <PageShell crumbs={["Projects"]} title="Project not found" site={site}>
      <Link to="/projects" className="text-link hover:underline">
        Back to projects
      </Link>
    </PageShell>
  );
}

function ProjectPage() {
  const { project, skills, site } = Route.useLoaderData() as {
    project: any;
    skills: any[];
    site: any;
  };
  return (
    <PageShell crumbs={["Projects", project.title]} title={project.title} site={site}>
      <ProjectView project={project} skills={skills} />
    </PageShell>
  );
}
