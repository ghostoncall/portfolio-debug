import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { projects } from "@/content/site";

const items = [
  { to: "/", label: "Overview" },
  { to: "/projects", label: "Projects", children: true },
  { to: "/blog", label: "Blog" },
  { to: "/skills", label: "Skills & Certificates" },
  { to: "/experience", label: "Experience" },
  { to: "/contact", label: "Contact" },
] as const;

const itemClass =
  "block py-1.5 font-sans text-xl font-bold leading-tight tracking-tight text-foreground transition-opacity hover:opacity-60";

export function SideMenu() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(pathname.startsWith("/projects"));

  return (
    <nav aria-label="Site index" className="border-t border-foreground/30">
      {items.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const hasChildren = "children" in item;
        return (
          <div key={item.to} className="border-b border-foreground/30">
            <div
              onClick={
                hasChildren
                  ? () => setOpen((o) => !o)
                  : () => {
                      navigate({ to: item.to });
                    }
              }
              className={`flex cursor-pointer items-center justify-between gap-2 px-3 ${
                active ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              <Link
                to={item.to}
                className={`${itemClass} ${active ? "text-primary-foreground hover:opacity-100" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span>{item.label}</span>
                {hasChildren && (
                  <sup className="ml-1 align-super text-xs font-normal">(+{projects.length})</sup>
                )}
              </Link>
              {hasChildren && (
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  aria-expanded={open}
                  aria-label={open ? "Collapse projects" : "Expand projects"}
                  className={`px-1 text-xl font-light leading-none ${active ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {open ? "−" : "+"}
                </button>
              )}
            </div>
            {hasChildren && open && (
              <ul className="space-y-1 px-3 pb-4 pt-2">
                {projects.map((p) => (
                  <li key={p.slug}>
                    <Link
                      to="/projects/$slug"
                      params={{ slug: p.slug }}
                      className="text-sm text-muted-foreground hover:text-foreground"
                      activeProps={{ className: "text-foreground underline underline-offset-4" }}
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
