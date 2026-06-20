import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";

export class PatchVendorInvoiceDto {
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
