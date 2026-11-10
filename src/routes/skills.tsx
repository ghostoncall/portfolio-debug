/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { getSiteIdentity } from "@/lib/server-fns";
import { getPublishedSkillsBundle } from "@/lib/server-fns";
import { SkillsView } from "@/components/public/SkillsView";
import { CertificatesView } from "@/components/public/CertificatesView";

export const Route = createFileRoute("/skills")({
  loader: async () => {
    const [site, bundle] = await Promise.all([
      (getSiteIdentity as any)(),
      (getPublishedSkillsBundle as any)(),
    ]);
    return { site, bundle };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Skills & Certificates — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content:
            "AI and engineering skills: LLMs, agents, RAG, deep learning, MLOps, plus certificates.",
        },
        { property: "og:title", content: `Skills — ${site?.name ?? "Portfolio"}` },
        {
          property: "og:description",
          content: "Technical skills and certifications in AI engineering.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SkillsPage,
});

function SkillsPage() {
  const { site, bundle } = Route.useLoaderData() as {
    site: any;
    bundle: { skills: any; certificates: any };
  };
  return (
    <PageShell crumbs={["Skills & Certificates"]} title="Skills & Certificates" site={site}>
      <SkillsView content={bundle.skills} />
      <CertificatesView content={bundle.certificates} />
    </PageShell>
  );
}
