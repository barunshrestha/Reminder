import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ApiKeysService } from "./api-keys.service";

@Controller("api-keys")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() body: { name: string }) {
    return this.service.create(body.name ?? "Integration key");
  }

  @Delete(":id")
  revoke(@Param("id") id: string) {
    return this.service.revoke(id);
  }
}
