"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type OverrideDialogProps = {
  filename: string;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function OverrideDialog({
  filename,
  open,
  onConfirm,
  onCancel,
}: OverrideDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace existing file?</DialogTitle>
          <DialogDescription>
            <strong>{filename}</strong> was uploaded before. Replacing will
            update invoice data from the new file and remove invoices that are
            no longer in this file (unless they also appear in another upload).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={onConfirm}>
            Replace file and data
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Skip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
