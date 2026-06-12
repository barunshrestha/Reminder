import {
  Controller,
  Get,
  Header,
  Param,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DocumentsService } from "./documents.service";

@Controller("documents")
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get(":id/download")
  download(@Param("id") id: string): Promise<StreamableFile> {
    return this.service.getDocumentStream(id);
  }

  @Get(":id/preview")
  @Header("Content-Type", "text/html; charset=utf-8")
  preview(@Param("id") id: string) {
    return this.service.getHtmlPreview(id);
  }
}
