import { ConflictException } from "@nestjs/common";

export class UploadConflictException extends ConflictException {
  constructor(
    public readonly existingUploadId: string,
    public readonly filename: string,
  ) {
    super({
      conflict: true,
      existingUploadId,
      filename,
      message: `Upload "${filename}" already exists. Set override=true to replace.`,
    });
  }
}
