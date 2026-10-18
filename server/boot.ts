import { existsSync } from "node:fs";
import { config } from "dotenv";

// `pnpm run server` is `tsx server/boot.ts`. Load .env before the server modules read
// process.env. A key already exported in the shell is left as-is.
const envFile = new URL("../.env", import.meta.url);
if (existsSync(envFile)) config({ path: envFile });

await import("./index.ts");
