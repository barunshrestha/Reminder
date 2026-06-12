import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";

export class UpdateConnectorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sql_query?: string;

  @IsOptional()
  @IsObject()
  column_map?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
