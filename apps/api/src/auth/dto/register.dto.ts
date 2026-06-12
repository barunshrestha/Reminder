import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  password!: string;

  @IsOptional()
  @IsEnum(["admin", "operator"])
  role?: "admin" | "operator";
}
