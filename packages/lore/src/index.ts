#!/usr/bin/env bun
import path from "node:path";
import { build } from "./build.ts";
import { dev } from "./dev.ts";
import { serve } from "./serve.ts";

// Parse: lore [build|dev|serve] [dir]
const args = process.argv.slice(2);

let command: "build" | "dev" | "serve" = "build";
let dirArg: string | undefined;

if (args[0] === "dev" || args[0] === "build" || args[0] === "serve") {
  command = args[0] as "build" | "dev" | "serve";
  dirArg = args[1];
} else {
  dirArg = args[0];
}

const docsDir = dirArg ? path.resolve(dirArg) : process.cwd();
const outDir = path.join(process.cwd(), "build");

if (command === "dev") {
  await dev(docsDir, outDir);
} else if (command === "serve") {
  await serve(docsDir, outDir);
} else {
  await build(docsDir, outDir);
}
