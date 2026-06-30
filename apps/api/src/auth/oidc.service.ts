import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import * as client from "openid-client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

const OIDC_STATE_COOKIE = "oidc_state";
const OIDC_VERIFIER_COOKIE = "oidc_verifier";

export type OidcCookieWriter = {
  setCookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string): void;
};

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private configPromise: Promise<client.Configuration | null> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  isEnabled(): boolean {
    return Boolean(
      process.env.OIDC_ISSUER_URL &&
        process.env.OIDC_CLIENT_ID &&
        process.env.OIDC_CLIENT_SECRET &&
        process.env.OIDC_CALLBACK_URL,
    );
  }

  async getConfig(): Promise<client.Configuration | null> {
    if (!this.isEnabled()) {
      return null;
    }
    if (!this.configPromise) {
      this.configPromise = client
        .discovery(
          new URL(process.env.OIDC_ISSUER_URL!),
          process.env.OIDC_CLIENT_ID!,
          process.env.OIDC_CLIENT_SECRET!,
        )
        .catch((error) => {
          this.logger.error(`OIDC discovery failed: ${error}`);
          return null;
        });
    }
    return this.configPromise;
  }

  async createAuthorizationRequest(cookies: OidcCookieWriter): Promise<string> {
    const config = await this.getConfig();
    if (!config) {
      throw new Error("OIDC is not configured");
    }
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = crypto.randomBytes(16).toString("hex");
    cookies.setCookie(OIDC_VERIFIER_COOKIE, codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
    });
    cookies.setCookie(OIDC_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
    });
    const scopes = process.env.OIDC_SCOPES ?? "openid profile email";
    return client.buildAuthorizationUrl(config, {
      redirect_uri: process.env.OIDC_CALLBACK_URL!,
      scope: scopes,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    }).href;
  }

  async handleCallback(
    callbackUrl: string,
    cookies: {
      getCookie(name: string): string | undefined;
      clearCookie(name: string): void;
    },
  ) {
    const config = await this.getConfig();
    if (!config) {
      throw new Error("OIDC is not configured");
    }
    const state = cookies.getCookie(OIDC_STATE_COOKIE);
    const codeVerifier = cookies.getCookie(OIDC_VERIFIER_COOKIE);
    cookies.clearCookie(OIDC_STATE_COOKIE);
    cookies.clearCookie(OIDC_VERIFIER_COOKIE);
    if (!state || !codeVerifier) {
      throw new Error("OIDC session expired");
    }

    const tokens = await client.authorizationCodeGrant(config, new URL(callbackUrl), {
      expectedState: state,
      pkceCodeVerifier: codeVerifier,
    });
    const claims = tokens.claims();
    const sub = claims?.sub;
    const email =
      typeof claims?.email === "string"
        ? claims.email.toLowerCase()
        : undefined;
    if (!sub || !email) {
      throw new Error("OIDC token missing sub or email");
    }

    let user = await this.prisma.user.findFirst({
      where: { OR: [{ ssoSubject: sub }, { email }] },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          ssoSubject: sub,
          ssoProvider: "oidc",
          emailVerifiedAt: new Date(),
        },
      });
    } else if (!user.ssoSubject) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { ssoSubject: sub, ssoProvider: "oidc" },
      });
    }

    return this.auth.issueTokenForUser(user);
  }
}

export { OIDC_STATE_COOKIE, OIDC_VERIFIER_COOKIE };
