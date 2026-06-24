import { IsEmail, IsOptional, IsString } from "class-validator";

export class TestVendorEmailDto {
  @IsOptional()
  @IsEmail()
  to?: string;
}
