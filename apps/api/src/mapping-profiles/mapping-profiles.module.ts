import { Module } from "@nestjs/common";
import { MappingProfilesController } from "./mapping-profiles.controller";
import { MappingProfilesService } from "./mapping-profiles.service";

@Module({
  controllers: [MappingProfilesController],
  providers: [MappingProfilesService],
  exports: [MappingProfilesService],
})
export class MappingProfilesModule {}
