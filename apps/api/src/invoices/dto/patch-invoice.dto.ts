import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";

export class PatchVendorInvoiceDto {
  @IsOptional()
  @IsString()
  client_name?: string;

  @IsOptional()
  @IsNumberString()
  balance_due?: string;

  @IsOptional()
  @IsString()
  due_date?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  last_tier_sent?: number | null;

  @IsOptional()
  @IsBoolean()
  send_reminder?: boolean;

  @IsOptional()
  @IsBoolean()
  email_opt_out?: boolean;

  @IsOptional()
  @IsBoolean()
  consent_email?: boolean;

  @IsOptional()
  @IsEmail()
  client_email?: string;

  @IsOptional()
  @IsString()
  client_phone?: string;

  @IsOptional()
  @IsEnum(["email", "phone", "document_only", "na"])
  reminder_delivery_mode?: "email" | "phone" | "document_only" | "na";

  @IsOptional()
  @IsEnum(["open", "paid", "closed"])
  status?: "open" | "paid" | "closed";
}
