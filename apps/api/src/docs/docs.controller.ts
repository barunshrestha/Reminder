import { Controller, Get, Header, NotFoundException } from "@nestjs/common";
import { readFile } from "fs/promises";
import { resolve } from "path";

@Controller("docs")
export class DocsController {
  @Get("openapi.yaml")
  @Header("Content-Type", "text/yaml; charset=utf-8")
  async openApi(): Promise<string> {
    const candidates = [
      resolve(process.cwd(), "openapi.yaml"),
      resolve(process.cwd(), "../../openapi.yaml"),
    ];
    for (const path of candidates) {
      try {
        const content = await readFile(path, "utf8");
        return content;
      } catch {
        continue;
      }
    }
    throw new NotFoundException("openapi.yaml not found");
  }
}
