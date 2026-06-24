"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_VISIBLE_COLUMNS,
  INVOICE_COLUMNS,
  type InvoiceColumnId,
  loadVisibleColumns,
  saveVisibleColumns,
} from "@/lib/invoice-columns";

type InvoiceColumnFilterProps = {
  visibleColumns: InvoiceColumnId[];
  onChange: (columns: InvoiceColumnId[]) => void;
  showSendEmailOption?: boolean;
};

export function InvoiceColumnFilter({
  visibleColumns,
  onChange,
  showSendEmailOption = false,
}: InvoiceColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<InvoiceColumnId[]>(visibleColumns);

  useEffect(() => {
    if (!open) {
      setDraft(visibleColumns);
    }
  }, [open, visibleColumns]);

  const availableColumns = INVOICE_COLUMNS.filter(
    (column) => column.id !== "sendEmail" || showSendEmailOption,
  );

  function toggleColumn(id: InvoiceColumnId) {
    setDraft((current) => {
      if (current.includes(id)) {
        if (id === "invoice" && current.length === 1) {
          return current;
        }
        return current.filter((columnId) => columnId !== id);
      }
      const next = [...current, id];
      return INVOICE_COLUMNS.map((column) => column.id).filter((columnId) =>
        next.includes(columnId),
      );
    });
  }

  function apply() {
    onChange(draft);
    saveVisibleColumns(draft);
    setOpen(false);
  }

  function resetDefaults() {
    const defaults = showSendEmailOption
      ? DEFAULT_VISIBLE_COLUMNS
      : DEFAULT_VISIBLE_COLUMNS.filter((id) => id !== "sendEmail");
    setDraft(defaults);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="mr-2 size-4" />
        Columns
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose columns</DialogTitle>
            <DialogDescription>
              Select which columns appear in the invoice grid. Your choices are
              saved in this browser.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[24rem] space-y-2 overflow-y-auto py-2">
            {availableColumns.map((column) => {
              const checked = draft.includes(column.id);
              const locked = column.id === "invoice" && draft.length === 1;

              return (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-3 rounded-sm border border-stroke px-4 py-3 hover:bg-gray-3 dark:border-strokedark dark:hover:bg-meta-4"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggleColumn(column.id)}
                    className="size-4 accent-primary"
                  />
                  <span className="text-sm text-black dark:text-white">
                    {column.label}
                  </span>
                </label>
              );
            })}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={resetDefaults}>
              Reset defaults
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={apply}>
                Apply
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function useInvoiceVisibleColumns(showSendEmailOption = false) {
  const [visibleColumns, setVisibleColumns] = useState<InvoiceColumnId[]>(
    DEFAULT_VISIBLE_COLUMNS,
  );

  useEffect(() => {
    const stored = loadVisibleColumns().filter(
      (id) => id !== "sendEmail" || showSendEmailOption,
    );
    setVisibleColumns(stored);
  }, [showSendEmailOption]);

  return [visibleColumns, setVisibleColumns] as const;
}
