/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { createFileRoute, Outlet, Link, redirect, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAdminUser, getSiteIdentity } from "@/lib/server-fns";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export const Route = createFileRoute("/onlyme")({
  // Server-enforced guard: every /onlyme page requires a Supabase session.
  // The login page is the only exception.
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/onlyme/login") return;

    const user = await getAdminUser();
    if (!user) {
      throw redirect({
        to: "/onlyme/login",

        search: { from: location.pathname } as any,
      });
    }
  },
  loader: async () => {
    const site = await (getSiteIdentity as any)();
    return { site };
  },
  component: OnlymeLayout,
});

function OnlymeLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { site } = Route.useLoaderData() as { site: any };
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setSidebarCollapsed(localStorage.getItem("onlyme:sidebarCollapsed") === "true");
    } catch {
      // Ignore storage errors
    }
  }, []);

  if (pathname === "/onlyme/login") {
    return <Outlet />;
  }

  async function handleSignOut() {
    try {
      await getSupabaseBrowser().auth.signOut();
    } catch {
      // Ignore network errors — still send the user to the login screen.
    } finally {
      window.location.href = "/onlyme/login";
    }
  }

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("onlyme:sidebarCollapsed", String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  const navItems = [
    { to: "/onlyme", label: "Dashboard", icon: "📊" },
    { to: "/onlyme/settings", label: "Settings", icon: "⚙️" },
    { to: "/onlyme/pages", label: "Pages", icon: "📄" },
    { to: "/onlyme/projects", label: "Projects", icon: "💼" },
    { to: "/onlyme/skills", label: "Skills", icon: "🧩" },
    { to: "/onlyme/certificates", label: "Certificates", icon: "🎓" },
    { to: "/onlyme/experience", label: "Experience", icon: "🛠️" },
    { to: "/onlyme/blogs", label: "Blogs", icon: "📝" },
    { to: "/onlyme/media", label: "Media", icon: "🖼️" },
    { to: "/onlyme/export", label: "Backup", icon: "💾" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "w-16 md:w-16" : "hidden w-72 md:flex"
        } flex-col bg-muted/50 md:flex`}
      >
        <div className="flex-1 p-3 space-y-1">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            title="Toggle sidebar"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {!sidebarCollapsed && (
                    <>
                      <span className="text-xl">{item.icon}</span>
                      <span>{item.label}</span>
                    </>
                  )}
                  {sidebarCollapsed && <span className="text-xl">{item.icon}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 text-xs text-destructive underline hover:bg-destructive/10 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-serif text-foreground">{site?.edition}</p>
            <h1 className="text-4xl font-bold text-foreground">Admin</h1>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
