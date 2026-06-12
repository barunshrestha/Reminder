import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ConnectorsService } from "./connectors.service";
import { CreateConnectorDto } from "./dto/create-connector.dto";
import { UpdateConnectorDto } from "./dto/update-connector.dto";

@Controller("connectors")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class ConnectorsController {
  constructor(private readonly service: ConnectorsService) {}

  @Post()
  create(@Body() dto: CreateConnectorDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateConnectorDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Post(":id/sync")
  sync(@Param("id") id: string) {
    return this.service.sync(id);
  }
}
