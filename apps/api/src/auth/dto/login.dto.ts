import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  mfa_code?: string;

  @IsOptional()
  @IsString()
  tenant_id?: string;
}
