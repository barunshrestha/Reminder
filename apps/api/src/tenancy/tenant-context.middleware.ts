import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { runWithTenantContext, type TenantContextData } from "./tenant-context";

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const ctx = (req as Request & { tenantContext?: TenantContextData })
      .tenantContext;
    if (ctx) {
      runWithTenantContext(ctx, () => next());
      return;
    }
    next();
  }
}
