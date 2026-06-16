import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateReminderTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  bodyHtml!: string;
}

export class PreviewReminderTemplateDto {
  @IsInt()
  @Min(1)
  tierDays!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  bodyHtml!: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;
}
