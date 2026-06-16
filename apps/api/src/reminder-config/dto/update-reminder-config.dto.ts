import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class UpdateReminderConfigDto {
  @IsOptional()
  @IsIn(["standard", "gentle", "custom"])
  tierPreset?: "standard" | "gentle" | "custom";

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  overdueTiers?: number[];

  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;

  @IsOptional()
  @IsIn(["daily", "weekly", "manual"])
  processingPreset?: "daily" | "weekly" | "manual";

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weeklyDay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  runHour?: number;

  @IsOptional()
  @IsBoolean()
  syncBeforeCheck?: boolean;

  @IsOptional()
  timezone?: string;
}
