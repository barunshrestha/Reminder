import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";
import { runWithTenantContext, type TenantContextData } from "./tenant-context";

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<
      Request & { tenantContext?: TenantContextData }
    >();
    const ctx = request.tenantContext;
    if (!ctx) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      runWithTenantContext(ctx, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
