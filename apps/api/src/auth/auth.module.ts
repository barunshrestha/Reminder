import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { OidcService } from "./oidc.service";
import { RolesGuard } from "./roles.guard";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      secret: process.env.SESSION_SECRET ?? "dev-secret-change-me-32chars-min",
      signOptions: { expiresIn: "7d" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OidcService, JwtStrategy, RolesGuard],
  exports: [AuthService, OidcService, RolesGuard],
})
export class AuthModule {}
