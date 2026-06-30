import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { JwtService } from "@nestjs/jwt";

import { createHash, randomBytes } from "crypto";

import * as argon2 from "argon2";

import { PrismaService } from "../prisma/prisma.service";

import { verifyTotp } from "./mfa.util";

import { LoginDto } from "./dto/login.dto";

import { RegisterDto } from "./dto/register.dto";



const MIN_PASSWORD_LENGTH = 12;



export interface AuthTokenPayload {

  sub: string;

  email: string;

  tenantId?: string;

  tenantRole?: "admin" | "operator";

  accountId?: string;

  mfaVerified?: boolean;

  impersonatorId?: string;

}



@Injectable()

export class AuthService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly jwt: JwtService,

  ) {}



  async register(dto: RegisterDto) {

    this.assertPasswordPolicy(dto.password);

    const existing = await this.prisma.user.findUnique({

      where: { email: dto.email.toLowerCase() },

    });

    if (existing) {

      throw new ConflictException("Email already registered");

    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({

      data: {

        email: dto.email.toLowerCase(),

        passwordHash,

      },

    });

    return this.toPublicUser(user);

  }



  async login(dto: LoginDto, tenantId?: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (!user || !user.passwordHash) {
        throw new UnauthorizedException("Invalid credentials");
      }
      const valid = await argon2.verify(user.passwordHash, dto.password);
      if (!valid) {
        throw new UnauthorizedException("Invalid credentials");
      }

      if (user.mfaEnabled && user.mfaSecret) {
        if (!dto.mfa_code) {
          return { mfaRequired: true as const, user: this.toPublicUser(user) };
        }
        if (!verifyTotp(user.mfaSecret, dto.mfa_code)) {
          throw new UnauthorizedException("Invalid MFA code");
        }
      }

      return this.issueTokenForUser(user, tenantId, { mfaVerified: true });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2021" || error.code === "P2022")
      ) {
        throw new InternalServerErrorException(
          "Database is not migrated for multi-tenant SaaS. Run: npx prisma db push --force-reset && npm run db:seed",
        );
      }
      throw error;
    }
  }



  async issueTokenForUser(

    user: {

      id: string;

      email: string;

      createdAt: Date;

      emailVerifiedAt?: Date | null;

      mfaEnabled?: boolean;

    },

    tenantId?: string,

    options?: { mfaVerified?: boolean; impersonatorId?: string },

  ) {

    let payload: AuthTokenPayload = {

      sub: user.id,

      email: user.email,

      mfaVerified: options?.mfaVerified ?? !user.mfaEnabled,

      impersonatorId: options?.impersonatorId,

    };



    let tenantSlug: string | undefined;



    if (tenantId) {

      const membership = await this.prisma.tenantMembership.findUnique({

        where: { tenantId_userId: { tenantId, userId: user.id } },

        include: { tenant: { select: { accountId: true, slug: true } } },

      });

      if (membership) {

        payload = {

          ...payload,

          tenantId,

          tenantRole: membership.role,

          accountId: membership.tenant.accountId,

        };

        tenantSlug = membership.tenant.slug;

      }

    } else {

      const firstMembership = await this.prisma.tenantMembership.findFirst({

        where: { userId: user.id },

        include: { tenant: { select: { accountId: true, id: true, slug: true } } },

        orderBy: { createdAt: "asc" },

      });

      if (firstMembership) {

        payload = {

          ...payload,

          tenantId: firstMembership.tenantId,

          tenantRole: firstMembership.role,

          accountId: firstMembership.tenant.accountId,

        };

        tenantSlug = firstMembership.tenant.slug;

      }

    }



    const token = await this.jwt.signAsync(payload);

    return {
      token,
      user: this.toPublicUser(user),
      tenantId: payload.tenantId,
      tenantSlug,
    };

  }



  async validateUserById(userId: string) {

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {

      return null;

    }

    return this.toPublicUser(user);

  }



  async getSessionProfile(

    user: {

      id: string;

      email: string;

      createdAt: Date;

      emailVerifiedAt?: Date | null;

      mfaEnabled?: boolean;

    },

    sessionToken?: string,

    preferredTenantId?: string,

  ) {

    let tenantId: string | undefined;

    let role: "admin" | "operator" | undefined;



    if (sessionToken) {

      try {

        const payload =

          await this.jwt.verifyAsync<AuthTokenPayload>(sessionToken);

        tenantId = payload.tenantId;

        role = payload.tenantRole;

      } catch {

        // Session token may be expired or invalid during profile lookup.

      }

    }



    const lookupTenantId = preferredTenantId ?? tenantId;

    if (lookupTenantId) {

      const membership = await this.prisma.tenantMembership.findUnique({

        where: {

          tenantId_userId: { tenantId: lookupTenantId, userId: user.id },

        },

      });

      if (membership) {

        tenantId = membership.tenantId;

        role = membership.role;

      }

    }



    if (!tenantId) {

      const membership = await this.prisma.tenantMembership.findFirst({

        where: { userId: user.id },

        orderBy: { createdAt: "asc" },

        include: { tenant: { select: { slug: true } } },

      });

      tenantId = membership?.tenantId;

      role = membership?.role;

    }



    const tenant = tenantId

      ? await this.prisma.tenant.findUnique({

          where: { id: tenantId },

          select: { slug: true },

        })

      : null;



    return {

      user: {

        ...this.toPublicUser(user),

        tenantId,

        tenantSlug: tenant?.slug,

        role,

      },

    };

  }



  async createMagicLink(email: string) {

    const user = await this.prisma.user.findUnique({

      where: { email: email.toLowerCase() },

    });

    if (!user) {

      return { ok: true };

    }

    const token = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.authToken.create({

      data: {

        userId: user.id,

        type: "magic_link",

        tokenHash,

        expiresAt,

      },

    });

    return {

      ok: true,

      magicLink: `${process.env.WEB_ORIGIN ?? "http://localhost:3001"}/login/magic?token=${token}`,

    };

  }



  async redeemMagicLink(token: string) {

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const record = await this.prisma.authToken.findFirst({

      where: {

        tokenHash,

        type: "magic_link",

        usedAt: null,

        expiresAt: { gt: new Date() },

      },

      include: { user: true },

    });

    if (!record) {

      throw new UnauthorizedException("Invalid or expired magic link");

    }

    await this.prisma.authToken.update({

      where: { id: record.id },

      data: { usedAt: new Date() },

    });

    if (!record.user.emailVerifiedAt) {

      await this.prisma.user.update({

        where: { id: record.user.id },

        data: { emailVerifiedAt: new Date() },

      });

    }

    return this.issueTokenForUser(record.user, undefined, { mfaVerified: true });

  }



  async acceptInvite(token: string, password: string) {

    this.assertPasswordPolicy(password);

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const invite = await this.prisma.userInvite.findFirst({

      where: {

        tokenHash,

        acceptedAt: null,

        expiresAt: { gt: new Date() },

      },

    });

    if (!invite) {

      throw new UnauthorizedException("Invalid or expired invite");

    }



    let user = await this.prisma.user.findUnique({

      where: { email: invite.email.toLowerCase() },

    });

    const passwordHash = await argon2.hash(password);

    if (!user) {

      user = await this.prisma.user.create({

        data: {

          email: invite.email.toLowerCase(),

          passwordHash,

          emailVerifiedAt: new Date(),

        },

      });

    } else {

      user = await this.prisma.user.update({

        where: { id: user.id },

        data: { passwordHash },

      });

    }



    await this.prisma.$transaction([

      this.prisma.tenantMembership.upsert({

        where: {

          tenantId_userId: { tenantId: invite.tenantId, userId: user.id },

        },

        create: {

          tenantId: invite.tenantId,

          userId: user.id,

          role: invite.role,

        },

        update: { role: invite.role },

      }),

      this.prisma.userInvite.update({

        where: { id: invite.id },

        data: { acceptedAt: new Date() },

      }),

    ]);



    return this.issueTokenForUser(user, invite.tenantId, { mfaVerified: true });

  }



  assertPasswordPolicy(password: string) {

    if (password.length < MIN_PASSWORD_LENGTH) {

      throw new ConflictException(

        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,

      );

    }

  }



  private toPublicUser(user: {

    id: string;

    email: string;

    createdAt: Date;

    emailVerifiedAt?: Date | null;

    mfaEnabled?: boolean;

  }) {

    return {

      id: user.id,

      email: user.email,

      createdAt: user.createdAt,

      emailVerifiedAt: user.emailVerifiedAt ?? null,

      mfaEnabled: user.mfaEnabled ?? false,

    };

  }

}


