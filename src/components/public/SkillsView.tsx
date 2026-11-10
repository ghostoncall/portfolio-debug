/* eslint-disable @typescript-eslint/no-explicit-any */
// Public skills view — categories in sort order, visible skills grouped.

import * as React from "react";

export function SkillsView({ content }: { content: any }) {
  const categories = content.categories ?? [];
  const skills = (content.skills ?? []).filter((s: any) => s.visible !== false);

  return (
    <div className="space-y-10">
      {categories.map((cat: any) => {
        const catSkills = skills.filter((s: any) => s.categoryId === cat.id);
        if (!catSkills.length) return null;
        return (
          <section key={cat.id} className="mb-10">
            <h2 className="mb-3 text-3xl text-foreground">{cat.name}</h2>
            <table className="w-full border-t border-border text-left">
              <tbody>
                {catSkills.map((s: any) => (
                  <tr key={s.id} className="border-b border-border">
                    <td className="w-1/3 py-3 pr-4 font-serif text-foreground">{s.name}</td>
                    <td className="py-3 text-muted-foreground">
                      {s.detail ?? s.description ?? ""}
                    </td>
                    {s.level && <td className="py-3 text-xs text-muted-foreground">{s.level}</td>}
                    {s.years != null && (
                      <td className="py-3 text-xs text-muted-foreground text-right">
                        {s.years} yrs
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
