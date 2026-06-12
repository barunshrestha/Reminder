"use client";

import type { SpreadsheetUploadItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UploadListProps = {
  uploads: SpreadsheetUploadItem[];
  onDeleteRequest: (upload: SpreadsheetUploadItem) => void;
  deletingId?: string;
};

export function UploadList({
  uploads,
  onDeleteRequest,
  deletingId,
}: UploadListProps) {
  if (uploads.length === 0) {
    return <p className="text-sm text-muted-foreground">No uploads yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Filename</TableHead>
          <TableHead>Profile</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead>Stats</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {uploads.map((upload) => (
          <TableRow key={upload.id}>
            <TableCell>{upload.originalFilename}</TableCell>
            <TableCell>{upload.mappingProfile.name}</TableCell>
            <TableCell>{new Date(upload.createdAt).toLocaleString()}</TableCell>
            <TableCell>
              {upload.stats
                ? `+${upload.stats.inserted ?? 0} / ~${upload.stats.updated ?? 0} / skipped ${upload.stats.skipped_unchanged ?? 0}`
                : "—"}
            </TableCell>
            <TableCell>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={deletingId === upload.id}
                onClick={() => onDeleteRequest(upload)}
              >
                {deletingId === upload.id ? "Deleting…" : "Delete"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
