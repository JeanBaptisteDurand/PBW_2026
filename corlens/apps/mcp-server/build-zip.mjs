#!/usr/bin/env node
// Builds a self-contained zip of the CorLens MCP server.
// Output: ./corlens-mcp.zip

import { execSync } from "child_process";
import { cpSync, mkdirSync, rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "zip-staging/corlens-mcp");
const ZIP = resolve(__dirname, "corlens-mcp.zip");

// Clean
if (existsSync(resolve(__dirname, "zip-staging"))) rmSync(resolve(__dirname, "zip-staging"), { recursive: true });
if (existsSync(ZIP)) rmSync(ZIP);

// Bundle with esbuild
console.log("Bundling with esbuild...");
execSync(
  `npx esbuild src/index.ts --bundle --platform=node --target=node18 --format=cjs --outfile=zip-staging/corlens-mcp/server.js`,
  { cwd: __dirname, stdio: "inherit" }
);

// Copy package files
console.log("Copying package files...");
cpSync(resolve(__dirname, "package/.env"), resolve(OUT, ".env"));
cpSync(resolve(__dirname, "package/start.sh"), resolve(OUT, "start.sh"));
cpSync(resolve(__dirname, "package/start.bat"), resolve(OUT, "start.bat"));
cpSync(resolve(__dirname, "package/README.md"), resolve(OUT, "README.md"));

// Make start.sh executable
execSync(`chmod +x "${resolve(OUT, "start.sh")}"`);

// Create zip
console.log("Creating zip...");
execSync(`cd zip-staging && zip -r ../corlens-mcp.zip corlens-mcp/`, {
  cwd: __dirname,
  stdio: "inherit",
});

// Clean staging
rmSync(resolve(__dirname, "zip-staging"), { recursive: true });

console.log(`Done! ${ZIP}`);
