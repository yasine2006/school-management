import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnv() {
  try {
    const content = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {}
}

export default function globalSetup() {
  loadEnv();
  if (process.env.E2E_SKIP_RESET === "1") {
    console.log("E2E_SKIP_RESET=1 — keeping the current database");
    return;
  }
  execSync("npx prisma migrate reset --force --skip-generate", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
}
