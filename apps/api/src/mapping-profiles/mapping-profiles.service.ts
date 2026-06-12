import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMappingProfileDto } from "./dto/create-mapping-profile.dto";
import { UpdateMappingProfileDto } from "./dto/update-mapping-profile.dto";

@Injectable()
export class MappingProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateMappingProfileDto) {
    return this.prisma.mappingProfile.create({
      data: {
        name: dto.name,
        columnMap: dto.columnMap,
      },
    });
  }

  findAll() {
    return this.prisma.mappingProfile.findMany({
      orderBy: { updatedAt: "desc" },
    });
  }

  async findOne(id: string) {
    const profile = await this.prisma.mappingProfile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException("Mapping profile not found");
    }
    return profile;
  }

  async update(id: string, dto: UpdateMappingProfileDto) {
    await this.findOne(id);
    return this.prisma.mappingProfile.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.columnMap !== undefined ? { columnMap: dto.columnMap } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.mappingProfile.delete({ where: { id } });
    return { deleted: true };
  }
}
