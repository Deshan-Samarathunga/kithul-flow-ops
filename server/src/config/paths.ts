import fs from "fs";
import path from "path";

const dataRoot = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : path.resolve(process.cwd());

export function resolveAppData(...segments: string[]) {
  return path.resolve(dataRoot, ...segments);
}

export function ensureAppDataDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
