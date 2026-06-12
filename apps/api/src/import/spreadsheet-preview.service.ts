import { Injectable } from "@nestjs/common";
import { MappingProfilesService } from "../mapping-profiles/mapping-profiles.service";
import {
  CANONICAL_IMPORT_FIELDS,
  extractHeaders,
  extractSampleRows,
  findUnknownHeaders,
} from "./spreadsheet-parser";

export interface SpreadsheetPreviewResult {
  headers: string[];
  sampleRows: Record<string, string>[];
  unknownHeaders: string[];
  columnMap: Record<string, string>;
  canonicalFields: readonly string[];
}

@Injectable()
export class SpreadsheetPreviewService {
  constructor(private readonly mappingProfiles: MappingProfilesService) {}

  async preview(
    buffer: Buffer,
    filename: string,
    options: {
      mappingProfileId?: string;
      columnMap?: Record<string, string>;
    },
  ): Promise<SpreadsheetPreviewResult> {
    const columnMap = await this.resolveColumnMap(options);
    const headers = extractHeaders(buffer, filename);
    const sampleRows = extractSampleRows(buffer, filename, 5);
    const unknownHeaders = findUnknownHeaders(headers, columnMap);

    return {
      headers,
      sampleRows,
      unknownHeaders,
      columnMap,
      canonicalFields: CANONICAL_IMPORT_FIELDS,
    };
  }

  private async resolveColumnMap(options: {
    mappingProfileId?: string;
    columnMap?: Record<string, string>;
  }): Promise<Record<string, string>> {
    if (options.columnMap) {
      return options.columnMap;
    }
    if (options.mappingProfileId) {
      const profile = await this.mappingProfiles.findOne(
        options.mappingProfileId,
      );
      return profile.columnMap as Record<string, string>;
    }
    return {};
  }
}
