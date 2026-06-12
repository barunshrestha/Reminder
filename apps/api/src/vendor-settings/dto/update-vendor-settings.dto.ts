import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpdateVendorSettingsDto {
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  overdue_tiers?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  missed_syncs_before_inactive?: number;

  @IsOptional()
  @IsBoolean()
  include_comments_in_email?: boolean;

  @IsOptional()
  @IsString()
  vendor_physical_address?: string;

  @IsOptional()
  @IsString()
  vendor_name?: string;

  @IsOptional()
  @IsBoolean()
  digest_email_enabled?: boolean;
}
