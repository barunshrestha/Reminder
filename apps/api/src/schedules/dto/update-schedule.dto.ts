import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @ValidateIf((o: UpdateScheduleDto) => o.rrule === undefined)
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @ValidateIf((o: UpdateScheduleDto) => o.cronExpression === undefined)
  @IsString()
  rrule?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  runSyncBeforeEvaluate?: boolean;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
