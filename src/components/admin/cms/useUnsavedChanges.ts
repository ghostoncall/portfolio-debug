// Unsaved-changes guard: beforeunload + an in-app confirmLeave callback.

import * as React from "react";

export function useUnsavedChanges(dirty: boolean): {
  confirmLeave: () => boolean;
} {
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const confirmLeave = React.useCallback((): boolean => {
    if (!dirty) return true;
    return window.confirm("You have unsaved changes. Leave this page and discard them?");
  }, [dirty]);

  return { confirmLeave };
}
