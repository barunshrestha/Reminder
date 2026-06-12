"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SKIP_VALUE = "__skip__";

type HeaderMapperProps = {
  unknownHeaders: string[];
  canonicalFields: readonly string[];
  mappings: Record<string, string>;
  onChange: (header: string, field: string) => void;
  onSaveToProfile?: () => void;
  saving?: boolean;
};

export function HeaderMapper({
  unknownHeaders,
  canonicalFields,
  mappings,
  onChange,
  onSaveToProfile,
  saving,
}: HeaderMapperProps) {
  if (unknownHeaders.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Map unknown columns</CardTitle>
        <CardDescription>
          These spreadsheet headers are not in the selected mapping profile. Map
          each to a database field before uploading.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Spreadsheet header</TableHead>
              <TableHead>Database field</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unknownHeaders.map((header) => (
              <TableRow key={header}>
                <TableCell>{header}</TableCell>
                <TableCell>
                  <Select
                    value={mappings[header] || SKIP_VALUE}
                    onValueChange={(value) =>
                      onChange(header, value === SKIP_VALUE ? "" : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— skip —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP_VALUE}>— skip —</SelectItem>
                      {canonicalFields.map((field) => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {onSaveToProfile ? (
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={onSaveToProfile}
          >
            {saving ? "Saving…" : "Save mapping to profile"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
