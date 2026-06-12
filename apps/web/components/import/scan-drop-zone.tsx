"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ScanDropZoneProps = {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
};

export function ScanDropZone({ disabled, onFiles }: ScanDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length || disabled) {
        return;
      }
      const accepted = Array.from(list).filter(
        (file) =>
          file.type.startsWith("image/") ||
          /\.(jpe?g|png|webp|gif)$/i.test(file.name),
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
        Drag and drop invoice images here, scan with your camera, or choose
        files
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
        >
          Scan with camera
        </Button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        One invoice per image — JPEG, PNG, WebP, or GIF
      </p>
    </div>
  );
}
