import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
} from "class-validator";

export class PatchIntegrationInvoiceDto {
  @IsOptional()
  @IsString()
  client_name?: string;

  @IsOptional()
  @IsNumberString()
  total_amount?: string;

  @IsOptional()
  @IsNumberString()
  balance_due?: string;

  @IsOptional()
  @IsString()
  due_date?: string;

  @IsOptional()
  @IsEmail()
  client_email?: string;

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
  @IsEnum(["email", "document_only"])
  reminder_delivery_mode?: "email" | "document_only";

  @IsOptional()
  @IsEnum(["open", "paid", "closed"])
  status?: "open" | "paid" | "closed";
}
