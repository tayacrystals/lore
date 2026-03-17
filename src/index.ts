import path from "node:path";
import { build } from "./build.ts";
import { dev } from "./dev.ts";
import { serve } from "./serve.ts";

// Parse: lore [build|dev|serve] [dir]
const args = process.argv.slice(2);

let command: "build" | "dev" | "serve" = "build";
let i = 0;

if (args[i] === "dev" || args[i] === "build" || args[i] === "serve") {
  command = args[i] as "build" | "dev" | "serve";
  i++;
}

const docsDir = args[i] ? path.resolve(args[i]) : process.cwd();
const outDir = path.join(process.cwd(), "build");

if (command === "dev") {
  await dev(docsDir, outDir);
} else if (command === "serve") {
  await serve(docsDir, outDir);
} else {
  await build(docsDir, outDir);
}
