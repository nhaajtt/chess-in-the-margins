// Runs the browser tests: node scripts/e2e/run.mjs [--online] [--concurrency N] [extra node --test arguments]
//   (default)  every *.test.mjs here except online.test.mjs
//   --online   only online.test.mjs, which starts the rooms service locally
// Test files run side by side, each with its own browser; the default is up to four at once.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return null; args.splice(i, 1); return true; };
const online = flag("--online");
let concurrency = Math.max(1, Math.min(4, os.cpus().length - 1));
const ci = args.indexOf("--concurrency");
if (ci >= 0) { concurrency = Number(args[ci + 1]) || concurrency; args.splice(ci, 2); }

const files = fs.readdirSync(here).filter((f) => f.endsWith(".test.mjs") && (f === "online.test.mjs") === Boolean(online)).sort().map((f) => path.join(here, f));
const child = spawn(process.execPath, ["--test", "--test-reporter=spec", `--test-concurrency=${concurrency}`, ...args, ...files], { stdio: "inherit" });
child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 1));
