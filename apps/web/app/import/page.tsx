"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DeleteUploadDialog } from "@/components/import/delete-upload-dialog";
import { DropZone } from "@/components/import/drop-zone";
import { HeaderMapper } from "@/components/import/header-mapper";
import { OverrideDialog } from "@/components/import/override-dialog";
import { UploadList } from "@/components/import/upload-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ApiConflictError,
  deleteSpreadsheetUpload,
  type DeleteUploadMode,
  downloadImportTemplate,
  importSpreadsheet,
  listMappingProfiles,
  listSpreadsheetUploads,
  previewSpreadsheet,
  updateMappingProfile,
  type MappingProfile,
  type SpreadsheetPreview,
  type SpreadsheetUploadItem,
} from "@/lib/api";

type QueueItem = {
  id: string;
  file: File;
  status:
    | "pending"
    | "blocked"
    | "uploading"
    | "conflict"
    | "done"
    | "error"
    | "skipped";
  message?: string;
};

function isDefaultSpreadsheetProfile(name: string): boolean {
  return name.trim().toLowerCase() === "default spreadsheet";
}

export default function ImportPage() {
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [uploads, setUploads] = useState<SpreadsheetUploadItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [preview, setPreview] = useState<SpreadsheetPreview | null>(null);
  const [headerMappings, setHeaderMappings] = useState<Record<string, string>>(
    {},
  );
  const [overrideFile, setOverrideFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  const [deleteTarget, setDeleteTarget] =
    useState<SpreadsheetUploadItem | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [importErrors, setImportErrors] = useState<
    Array<{ row: number; field?: string; message: string }>
  >([]);

  const selectedProfile = profiles.find((p) => p.id === profileId);

  const effectiveColumnMap = useMemo(() => {
    if (!selectedProfile) {
      return {};
    }
    const base = { ...selectedProfile.columnMap };
    for (const [header, field] of Object.entries(headerMappings)) {
      if (field) {
        base[header] = field;
      }
    }
    return base;
  }, [selectedProfile, headerMappings]);

  const refreshUploads = useCallback(async () => {
    const list = await listSpreadsheetUploads();
    setUploads(list);
  }, []);

  useEffect(() => {
    listMappingProfiles()
      .then(setProfiles)
      .catch(console.error);
    refreshUploads().catch(console.error);
  }, [refreshUploads]);

  async function runPreview(file: File) {
    if (!profileId) {
      return;
    }
    const result = await previewSpreadsheet(file, {
      mappingProfileId: profileId,
      columnMap: effectiveColumnMap,
    });
    setPreview(result);
    const initial: Record<string, string> = {};
    for (const header of result.unknownHeaders) {
      initial[header] = headerMappings[header] ?? "";
    }
    setHeaderMappings((prev) => ({ ...prev, ...initial }));
    return result;
  }

  async function uploadOne(file: File, override = false) {
    return importSpreadsheet(file, {
      mappingProfileId: profileId,
      columnMap: effectiveColumnMap,
      override,
    });
  }

  const processQueue = useCallback(
    async (
      items: QueueItem[],
      options?: { startOverrideFile?: File | null; unknownHeaders?: string[] },
    ) => {
      if (!profileId) {
        setStatusMessage("Select a mapping profile first.");
        return;
      }

      setBusy(true);
      setImportErrors([]);
      let overrideTarget = options?.startOverrideFile ?? null;

      for (const item of items) {
        if (item.status === "done" || item.status === "skipped") {
          continue;
        }

        const file =
          overrideTarget?.name === item.file.name ? overrideTarget : item.file;

        setQueue((q) =>
          q.map((row) =>
            row.id === item.id ? { ...row, status: "uploading" } : row,
          ),
        );

        try {
          const result = await uploadOne(file, Boolean(overrideTarget));
          overrideTarget = null;
          if (result.errors.length > 0) {
            setImportErrors((prev) => [...prev, ...result.errors]);
          }
          const summary = `Inserted ${result.inserted}, updated ${result.updated}, skipped ${result.skippedUnchanged}, errors ${result.errors.length}`;
          setQueue((q) =>
            q.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    status: "done",
                    message: summary,
                  }
                : row,
            ),
          );
        } catch (error) {
          if (error instanceof ApiConflictError) {
            setQueue((q) =>
              q.map((row) =>
                row.id === item.id ? { ...row, status: "conflict" } : row,
              ),
            );
            setOverrideFile(file);
            setBusy(false);
            return;
          }
          const message =
            error instanceof Error ? error.message : "Upload failed";
          setQueue((q) =>
            q.map((row) =>
              row.id === item.id
                ? { ...row, status: "error", message }
                : row,
            ),
          );
        }
      }

      setBusy(false);
      await refreshUploads();
      setStatusMessage("Upload queue finished.");
    },
    [
      profileId,
      preview?.unknownHeaders,
      effectiveColumnMap,
      refreshUploads,
    ],
  );

  async function onFilesSelected(files: File[]) {
    if (!profileId) {
      setStatusMessage("Select a mapping profile before adding files.");
      return;
    }

    const newItems: QueueItem[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      status: "pending",
    }));
    setQueue((q) => [...q, ...newItems]);
    setStatusMessage("");

    try {
      const previewResult = await runPreview(files[0]!);
      const unmapped = (previewResult?.unknownHeaders ?? []).filter(
        (h) => !effectiveColumnMap[h],
      );
      if (unmapped.length > 0) {
        setStatusMessage(
          `Unmapped columns (${unmapped.join(", ")}) will be ignored. Map them below to import those fields.`,
        );
      }
      await processQueue(newItems);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Preview failed";
      setStatusMessage(message);
    }
  }

  async function onConfirmOverride() {
    if (!overrideFile) {
      return;
    }
    const pending = queue.filter(
      (item) =>
        item.file.name === overrideFile.name &&
        (item.status === "conflict" || item.status === "blocked"),
    );
    setOverrideFile(null);
    await processQueue(pending, { startOverrideFile: overrideFile });
  }

  function onCancelOverride() {
    if (overrideFile) {
      setQueue((q) =>
        q.map((item) =>
          item.file.name === overrideFile.name && item.status === "conflict"
            ? { ...item, status: "skipped", message: "Skipped (name conflict)" }
            : item,
        ),
      );
    }
    setOverrideFile(null);
    setBusy(false);
  }

  async function uploadPending() {
    const pending = queue.filter(
      (item) => item.status === "pending" || item.status === "blocked",
    );
    await processQueue(pending);
  }

  async function onDownloadTemplate(format: "xlsx" | "csv" = "xlsx") {
    if (!profileId) {
      return;
    }
    const blob = await downloadImportTemplate(profileId, format);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      format === "csv" ? "import-template.csv" : "import-template.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function onSaveMappingToProfile() {
    if (!selectedProfile) {
      return;
    }
    setSavingProfile(true);
    try {
      const merged = { ...selectedProfile.columnMap, ...headerMappings };
      const updated = await updateMappingProfile(selectedProfile.id, {
        columnMap: merged,
      });
      setProfiles((list) =>
        list.map((p) => (p.id === updated.id ? updated : p)),
      );
      setHeaderMappings({});
      if (queue.length > 0) {
        await runPreview(queue[0]!.file);
      }
      setStatusMessage("Mapping profile updated.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function performDeleteUpload(
    upload: SpreadsheetUploadItem,
    mode: DeleteUploadMode,
  ) {
    setDeletingId(upload.id);
    try {
      await deleteSpreadsheetUpload(upload.id, mode);
      setDeleteTarget(null);
      await refreshUploads();
      setStatusMessage(
        mode === "file_only"
          ? `Removed "${upload.originalFilename}" from upload history. Invoice data was kept.`
          : `Deleted "${upload.originalFilename}" and associated invoice data.`,
      );
    } finally {
      setDeletingId(undefined);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="profile">Mapping profile</Label>
            <Select
              value={profileId || undefined}
              onValueChange={(value) => {
                setProfileId(value);
                setPreview(null);
                setHeaderMappings({});
                setQueue([]);
              }}
            >
              <SelectTrigger id="profile">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProfile &&
          isDefaultSpreadsheetProfile(selectedProfile.name) ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onDownloadTemplate("xlsx").catch(console.error)}
              >
                Download Excel template
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onDownloadTemplate("csv").catch(console.error)}
              >
                Download CSV template
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DropZone disabled={!profileId || busy} onFiles={onFilesSelected} />
          {queue.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {queue.map((item) => (
                <li key={item.id}>
                  {item.file.name} —{" "}
                  <span className="text-muted-foreground">{item.status}</span>
                  {item.message ? (
                    <span className="text-muted-foreground">
                      {" "}
                      ({item.message})
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {queue.some(
            (item) => item.status === "pending" || item.status === "blocked",
          ) ? (
            <Button
              type="button"
              disabled={busy || !profileId}
              onClick={() => uploadPending().catch(console.error)}
            >
              Upload pending files
            </Button>
          ) : null}
          {statusMessage ? (
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          ) : null}
          {importErrors.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>
                Row validation errors ({importErrors.length})
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {importErrors.slice(0, 10).map((err, idx) => (
                    <li key={`${err.row}-${err.field ?? ""}-${idx}`}>
                      Row {err.row}
                      {err.field ? ` (${err.field})` : ""}: {err.message}
                    </li>
                  ))}
                </ul>
                {importErrors.length > 10 ? (
                  <p className="mt-2 text-sm">
                    …and {importErrors.length - 10} more
                  </p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {preview && (preview.unknownHeaders.length > 0 || headerMappings) ? (
        <HeaderMapper
          unknownHeaders={
            preview.unknownHeaders.length > 0
              ? preview.unknownHeaders
              : Object.keys(headerMappings)
          }
          canonicalFields={preview.canonicalFields}
          mappings={headerMappings}
          onChange={(header, field) =>
            setHeaderMappings((prev) => ({ ...prev, [header]: field }))
          }
          onSaveToProfile={profileId ? onSaveMappingToProfile : undefined}
          saving={savingProfile}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Upload history</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadList
            uploads={uploads}
            deletingId={deletingId}
            onDeleteRequest={setDeleteTarget}
          />
        </CardContent>
      </Card>

      <DeleteUploadDialog
        filename={deleteTarget?.originalFilename ?? ""}
        open={Boolean(deleteTarget)}
        busy={Boolean(deletingId)}
        onDeleteFileAndData={() =>
          deleteTarget &&
          performDeleteUpload(deleteTarget, "file_and_data").catch(console.error)
        }
        onDeleteFileOnly={() =>
          deleteTarget &&
          performDeleteUpload(deleteTarget, "file_only").catch(console.error)
        }
        onCancel={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      />

      <OverrideDialog
        filename={overrideFile?.name ?? ""}
        open={Boolean(overrideFile)}
        onConfirm={() => onConfirmOverride().catch(console.error)}
        onCancel={onCancelOverride}
      />
    </>
  );
}
