import { loadEnv } from "./load-env";

loadEnv();

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3001",
    credentials: true,
  });
  app.use(cookieParser());
  app.use(
    "/api/v1/billing/webhooks/stripe",
    (req: Request, _res: Response, next: NextFunction) => {
      if (req.readable && !(req as Request & { rawBody?: Buffer }).rawBody) {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          (req as Request & { rawBody?: Buffer }).rawBody = Buffer.concat(chunks);
          next();
        });
        return;
      }
      next();
    },
  );
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
