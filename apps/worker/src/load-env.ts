import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

export function loadEnv(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
    resolve(process.cwd(), "../../.env"),
    resolve(__dirname, "../../../.env"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      config({ path });
      return;
    }
  }
}
