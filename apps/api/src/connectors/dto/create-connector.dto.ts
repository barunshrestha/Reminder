import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class CreateConnectorDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  sql_query!: string;

  @IsObject()
  column_map!: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
