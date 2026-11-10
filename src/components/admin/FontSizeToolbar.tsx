// Font size selector for the Koenig editor toolbar.
//
// Changes the font size of the current paragraph. The size is preserved in
// body.html via <p style="font-size: ..."> and survives save/reopen.
//
// No Lexical node manipulation — works purely through the HTML output layer,
// avoiding the Lexical instance conflict with koenig-lexical's bundled copy.
//
import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "40px", "48px"];

export function FontSizeToolbar({
  value,
  onChange,
}: {
  value: string;
  onChange: (size: string) => void;
}): ReactElement | null {
  return (
    <div className="flex items-center gap-1 border-l border-border pl-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Size</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs border border-input bg-background px-1.5 py-1 rounded text-foreground focus:border-ring outline-none"
      >
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
}
