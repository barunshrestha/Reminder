"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

type DropZoneProps = {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
};

export function DropZone({ disabled, onFiles }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length || disabled) {
        return;
      }
      const accepted = Array.from(list).filter((file) =>
        /\.(xlsx|xls|csv)$/i.test(file.name),
      );
      if (accepted.length > 0) {
        onFiles(accepted);
      }
    },
    [disabled, onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) {
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border bg-transparent",
        disabled && "opacity-60",
      )}
    >
      <p className="mb-3 text-sm">
        Drag and drop spreadsheets here, or choose files
      </p>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        multiple
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        .xlsx, .xls, or .csv — multiple files supported
      </p>
    </div>
  );
}
