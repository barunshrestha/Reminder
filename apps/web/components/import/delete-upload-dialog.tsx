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

type DeleteUploadDialogProps = {
  filename: string;
  open: boolean;
  busy?: boolean;
  onDeleteFileAndData: () => void;
  onDeleteFileOnly: () => void;
  onCancel: () => void;
};

export function DeleteUploadDialog({
  filename,
  open,
  busy,
  onDeleteFileAndData,
  onDeleteFileOnly,
  onCancel,
}: DeleteUploadDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !busy) {
          onCancel();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete upload?</DialogTitle>
          <DialogDescription>
            Choose what to remove for <strong>{filename}</strong>:
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            <strong>Delete file and data</strong> — removes the stored file and
            deletes invoices that were only imported from this upload.
          </li>
          <li>
            <strong>Delete file only</strong> — removes the file from upload
            history; imported invoices stay in the system.
          </li>
        </ul>
        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          <Button
            type="button"
            disabled={busy}
            onClick={onDeleteFileAndData}
          >
            Delete file and data
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onDeleteFileOnly}
          >
            Delete file only
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
