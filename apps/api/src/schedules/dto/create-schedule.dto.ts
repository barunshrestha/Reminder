import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateIf((o: CreateScheduleDto) => !o.rrule)
  @IsString()
  @IsNotEmpty()
  cronExpression?: string;

  @ValidateIf((o: CreateScheduleDto) => !o.cronExpression)
  @IsString()
  @IsNotEmpty()
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
