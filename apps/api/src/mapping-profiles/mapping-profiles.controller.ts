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
import { CreateMappingProfileDto } from "./dto/create-mapping-profile.dto";
import { UpdateMappingProfileDto } from "./dto/update-mapping-profile.dto";
import { MappingProfilesService } from "./mapping-profiles.service";

@Controller("mapping-profiles")
@UseGuards(JwtAuthGuard)
export class MappingProfilesController {
  constructor(private readonly service: MappingProfilesService) {}

  @Post()
  create(@Body() dto: CreateMappingProfileDto) {
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
  update(@Param("id") id: string, @Body() dto: UpdateMappingProfileDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
