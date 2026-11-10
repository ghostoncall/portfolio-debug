import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { SiteIdentity } from "@/db/schema";
import { SideMenu } from "@/components/SideMenu";

export function SiteHeader({ site }: { site: SiteIdentity }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          {site.socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-base font-medium text-muted-foreground tracking-tight hover:opacity-80"
            >
              {s.label === "LinkedIn" ? (
                <img
                  src="https://img.icons8.com/ios-filled/50/000000/linkedin.png"
                  alt="LinkedIn"
                  width="20"
                  height="20"
                  className="shrink-0"
                />
              ) : s.label === "GitHub" ? (
                <img
                  src="https://img.icons8.com/fluent/50/000000/github.png"
                  alt="GitHub"
                  width="20"
                  height="20"
                  className="shrink-0"
                />
              ) : null}
              {s.label}
            </a>
          ))}
        </div>
        <Link to="/" className="flex-1 text-center font-serif text-2xl text-foreground">
          {site.name}
        </Link>
        <span className="text-base font-medium text-white tracking-tight bg-black">{site.edition}</span>
      </div>
    </header>
  );
}

export function PageShell({
  crumbs,
  title,
  children,
  site,
}: {
  crumbs: string[];
  title: string;
  children: ReactNode;
  site: SiteIdentity;
}) {
  return (
    <main className="mx-auto max-w-7xl px-6 pb-24">
      <nav className="mt-10 flex flex-wrap gap-1 text-sm text-link">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        {crumbs.map((c) => (
          <span key={c}>
            <span className="mx-1 text-muted-foreground">›</span>
            {c}
          </span>
        ))}
      </nav>
      <h1 className="mt-4 text-5xl leading-tight text-foreground md:text-6xl">{title}</h1>
      <hr className="mt-10 border-border" />

      <div className="mt-8 grid gap-10 md:grid-cols-[18rem_1fr] lg:gap-16">
        <aside>
          <SideMenu />
        </aside>
        <article className="min-w-0 max-w-3xl">{children}</article>
      </div>
    </main>
  );
}

export function SiteFooter({ site }: { site: SiteIdentity }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
        <span className="font-serif">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </span>
        <span className="flex gap-6">
          {site.socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              {s.label}
            </a>
          ))}
        </span>
      </div>
    </footer>
  );
}
