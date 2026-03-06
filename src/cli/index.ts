#!/usr/bin/env bun
// NotebookLM TypeScript CLI entry point
// Usage: notebooklm [options] <command> [args]

import { Command } from "commander";
import { readFileSync } from "fs";
import { join } from "path";
import { buildSessionCommands } from "./session.ts";
import { buildNotebookCommands } from "./notebook.ts";
import { buildSourceCommands } from "./source.ts";
import { buildChatCommands } from "./chat.ts";
import { buildGenerateCommands } from "./generate.ts";
import { buildDownloadCommands } from "./download.ts";
import { buildArtifactCommands } from "./artifact.ts";
import { buildNoteCommands } from "./note.ts";
import { buildResearchCommands } from "./research.ts";
import { buildLanguageCommands } from "./language.ts";
import { buildShareCommands } from "./share.ts";
import { buildSkillCommands } from "./skill.ts";

// Read version from package.json
let version = "0.1.0";
try {
  const pkgPath = join(import.meta.dir, "../../package.json");
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
