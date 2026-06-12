import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
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
  @IsEnum(["email", "document_only"])
  reminder_delivery_mode?: "email" | "document_only";

  @IsOptional()
  @IsEnum(["open", "paid", "closed"])
  status?: "open" | "paid" | "closed";
}
