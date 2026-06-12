import { IsObject, IsString, MinLength } from "class-validator";

export class CreateMappingProfileDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** Source column header → canonical field name */
  @IsObject()
  columnMap!: Record<string, string>;
}
