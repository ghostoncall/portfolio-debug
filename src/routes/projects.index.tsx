/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { getPublishedProjects, getSiteIdentity } from "@/lib/server-fns";
import { ProjectSummary } from "@/components/public/ProjectSummary";

export const Route = createFileRoute("/projects/")({
  loader: async () => {
    const [projects, site] = await Promise.all([
      (getPublishedProjects as any)(),
      (getSiteIdentity as any)(),
    ]);
    return { projects, site };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Projects — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content: "AI projects: LLM apps, agents, retrieval systems and computer vision.",
        },
        { property: "og:title", content: `AI Projects — ${site?.name ?? "Portfolio"}` },
        { property: "og:description", content: "A catalog of applied AI work." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Projects,
});

function Projects() {
  const { projects, site } = Route.useLoaderData();
  const visible = (projects as any[]).filter((p) => p.status !== "archived");
  return (
    <PageShell crumbs={["Projects"]} title="Selected Projects" site={site}>
      <ul className="border-t border-border">
        {visible.map((p) => (
          <li key={p.slug} className="border-b border-border py-6">
            <ProjectSummary project={p} />
          </li>
        ))}
        {visible.length === 0 && (
          <li className="border-b border-border py-6 text-center text-muted-foreground">
            No projects to display.
          </li>
        )}
      </ul>
    </PageShell>
  );
}
