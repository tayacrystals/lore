import path from "node:path";
import { build } from "./build.ts";
import { dev } from "./dev.ts";

// Parse: lore [build|dev] [dir]
const args = process.argv.slice(2);

let command: "build" | "dev" = "build";
let i = 0;

if (args[i] === "dev" || args[i] === "build") {
  command = args[i] as "build" | "dev";
  i++;
}

const docsDir = args[i] ? path.resolve(args[i]) : process.cwd();
const outDir = path.join(process.cwd(), "build");

if (command === "dev") {
  await dev(docsDir, outDir);
} else {
  await build(docsDir, outDir);
}
