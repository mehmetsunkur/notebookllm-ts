#!/usr/bin/env node
// NotebookLM TypeScript CLI entry point
// Usage: notebooklm [options] <command> [args]

import { Command } from "commander";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildSessionCommands } from "./session.js";
import { buildNotebookCommands } from "./notebook.js";
import { buildSourceCommands } from "./source.js";
import { buildChatCommands } from "./chat.js";
import { buildGenerateCommands } from "./generate.js";
import { buildDownloadCommands } from "./download.js";
import { buildArtifactCommands } from "./artifact.js";
import { buildNoteCommands } from "./note.js";
import { buildResearchCommands } from "./research.js";
import { buildLanguageCommands } from "./language.js";
import { buildShareCommands } from "./share.js";
import { buildSkillCommands } from "./skill.js";

// Read version from package.json
let version = "0.1.0";
try {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "../../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  version = pkg.version ?? version;
} catch {
  // Use default
}

const program = new Command();

program
  .name("notebooklm")
  .description("TypeScript CLI for Google NotebookLM")
  .version(version, "-V, --version", "Show version number")
  .option(
    "--storage <path>",
    "Override the home directory for config and auth files (~/.notebookllm-ts/)",
  )
  .option("--verbose", "Enable verbose debug output")
  .option("--json", "Force JSON output for all commands")
  .allowUnknownOption(false);

// Register all command groups
buildSessionCommands(program);
buildNotebookCommands(program);
buildSourceCommands(program);
buildChatCommands(program);
buildGenerateCommands(program);
buildDownloadCommands(program);
buildArtifactCommands(program);
buildNoteCommands(program);
buildResearchCommands(program);
buildLanguageCommands(program);
buildShareCommands(program);
buildSkillCommands(program);

// Show help if no command provided
program.action(() => {
  program.help();
});

program.parseAsync(process.argv).catch((e: unknown) => {
  console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
