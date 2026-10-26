import os from "node:os";
import path from "node:path";

export function dataDirectory(): string {
  return path.join(os.homedir(), ".local", "share", "local-designer");
}

export function designsDirectory(): string {
  return process.env.LOCAL_DESIGNER_DESIGNS ?? path.join(dataDirectory(), "designs");
}
