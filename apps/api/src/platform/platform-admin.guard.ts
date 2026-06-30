import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenException();
    }

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { userId },
    });
    if (!admin) {
      throw new ForbiddenException("Platform admin access required");
    }

    return true;
  }
}
