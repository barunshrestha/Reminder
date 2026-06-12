import { describe, expect, it } from "vitest";
import { UploadConflictException } from "./upload-conflict.exception";

describe("UploadConflictException", () => {
  it("exposes conflict metadata for 409 responses", () => {
    const error = new UploadConflictException("upload-1", "invoices.xlsx");
    const response = error.getResponse() as {
      conflict: boolean;
      existingUploadId: string;
      filename: string;
    };

    expect(error.getStatus()).toBe(409);
    expect(response.conflict).toBe(true);
    expect(response.existingUploadId).toBe("upload-1");
    expect(response.filename).toBe("invoices.xlsx");
  });
});
