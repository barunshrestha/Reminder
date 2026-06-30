import {

  Body,

  Controller,

  Get,

  Post,

  Query,

  Req,

  Res,

  UseGuards,

} from "@nestjs/common";

import type { Request, Response } from "express";

import { Public } from "./public.decorator";

import { SkipTenant } from "../tenancy/tenancy.decorator";

import { AuthService } from "./auth.service";

import { CurrentUser } from "./current-user.decorator";

import { LoginDto } from "./dto/login.dto";

import { RegisterDto } from "./dto/register.dto";

import { JwtAuthGuard } from "./jwt-auth.guard";

import { OidcService } from "./oidc.service";



const COOKIE_NAME = "session";



@Controller("auth")

export class AuthController {

  constructor(

    private readonly auth: AuthService,

    private readonly oidc: OidcService,

  ) {}



  @Get("config")

  @Public()

  getConfig() {

    return {

      oidcEnabled: this.oidc.isEnabled(),

      passwordLoginEnabled: true,

    };

  }



  @Post("register")

  @Public()

  async register(@Body() dto: RegisterDto) {

    return this.auth.register(dto);

  }



  @Post("login")

  @Public()

  async login(

    @Body() dto: LoginDto,

    @Res({ passthrough: true }) res: Response,

  ) {

    const result = await this.auth.login(dto, dto.tenant_id);

    if ("mfaRequired" in result) {

      return result;

    }

    this.setSessionCookie(res, result.token);

    return { user: result.user, tenantId: result.tenantId, tenantSlug: result.tenantSlug };

  }



  @Post("magic-link")

  @Public()

  requestMagicLink(@Body() body: { email: string }) {

    return this.auth.createMagicLink(body.email);

  }



  @Post("magic-link/redeem")

  @Public()

  async redeemMagicLink(

    @Body() body: { token: string },

    @Res({ passthrough: true }) res: Response,

  ) {

    const { token, user, tenantId } = await this.auth.redeemMagicLink(

      body.token,

    );

    this.setSessionCookie(res, token);

    return { user, tenantId };

  }



  @Post("invites/accept")

  @Public()

  async acceptInvite(

    @Body() body: { token: string; password: string },

    @Res({ passthrough: true }) res: Response,

  ) {

    const { token, user, tenantId } = await this.auth.acceptInvite(

      body.token,

      body.password,

    );

    this.setSessionCookie(res, token);

    return { user, tenantId };

  }



  @Get("oidc/login")

  @Public()

  async oidcLogin(@Res() res: Response) {

    const url = await this.oidc.createAuthorizationRequest({

      setCookie: (name, value, options) => res.cookie(name, value, options),

      clearCookie: (name) => res.clearCookie(name),

    });

    return res.redirect(url);

  }



  @Get("oidc/callback")

  @Public()

  async oidcCallback(@Req() req: Request, @Res() res: Response) {

    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3001";

    try {

      const { token } = await this.oidc.handleCallback(

        `${req.protocol}://${req.get("host")}${req.originalUrl}`,

        {

          getCookie: (name) => req.cookies?.[name] as string | undefined,

          clearCookie: (name) => res.clearCookie(name),

        },

      );

      this.setSessionCookie(res, token);

      return res.redirect(`${webOrigin}/dashboard`);

    } catch {

      return res.redirect(`${webOrigin}/login?error=sso_failed`);

    }

  }



  @Post("logout")

  @Public()

  logout(@Res({ passthrough: true }) res: Response) {

    res.clearCookie(COOKIE_NAME);

    return { ok: true };

  }



  @UseGuards(JwtAuthGuard)

  @SkipTenant()

  @Get("me")

  me(

    @CurrentUser()

    user: {

      id: string;

      email: string;

      createdAt: Date;

      emailVerifiedAt?: Date | null;

      mfaEnabled?: boolean;

    },

    @Req() req: Request,

  ) {

    const tenantIdHeader = req.headers["x-tenant-id"];

    const preferredTenantId = Array.isArray(tenantIdHeader)

      ? tenantIdHeader[0]

      : tenantIdHeader;

    return this.auth.getSessionProfile(

      user,

      req.cookies?.session as string | undefined,

      preferredTenantId,

    );

  }



  private setSessionCookie(res: Response, token: string) {

    res.cookie(COOKIE_NAME, token, {

      httpOnly: true,

      secure: process.env.NODE_ENV === "production",

      sameSite: "lax",

      maxAge: 7 * 24 * 60 * 60 * 1000,

    });

  }

}


