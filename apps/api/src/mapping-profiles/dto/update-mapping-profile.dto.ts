import { IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateMappingProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsObject()
  columnMap?: Record<string, string>;
}
