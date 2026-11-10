// Destructive-action confirmation dialog (programmatically opened/closed).

import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  destructive = true,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogDescription>{title}</AlertDialogDescription>
        <p className="text-sm text-muted-foreground">{description}</p>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
