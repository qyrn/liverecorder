import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  dbPath: resolve(root, "liverecorder.db"),
};
