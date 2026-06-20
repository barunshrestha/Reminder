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
  @IsString()
  client_phone?: string;

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
  @IsEnum(["email", "phone", "document_only", "na"])
  reminder_delivery_mode?: "email" | "phone" | "document_only" | "na";

  @IsOptional()
  @IsEnum(["open", "paid", "closed"])
  status?: "open" | "paid" | "closed";
}
