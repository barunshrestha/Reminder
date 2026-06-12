import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class IntegrationInvoiceDto {
  @IsString()
  @IsNotEmpty()
  client_name!: string;

  @IsString()
  @IsNotEmpty()
  invoice_number!: string;

  @IsNumberString()
  total_amount!: string;

  @IsNumberString()
  balance_due!: string;

  @IsString()
  @IsNotEmpty()
  due_date!: string;

  @IsOptional()
  @IsString()
  date_of_service?: string;

  @IsOptional()
  @IsEmail()
  client_email?: string;

  @IsOptional()
  @IsString()
  external_client_id?: string;

  @IsOptional()
  @IsString()
  comments?: string;

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

export class BulkInvoicesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntegrationInvoiceDto)
  invoices!: IntegrationInvoiceDto[];

  @IsOptional()
  @IsBoolean()
  complete_sync?: boolean;
}
