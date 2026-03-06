// Download commands: audio, video, slide-deck, infographic, report,
//                   mind-map, data-table, quiz, flashcards

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { makeClient, action, requireNotebookId } from "./options.ts";
import type { GlobalOptions, ArtifactType } from "../types.ts";
import { writeFile } from "fs/promises";
import { join } from "path";

const ARTIFACT_TYPES: Record<string, ArtifactType> = {
  audio: "audio",
  video: "video",
  "slide-deck": "slide_deck",
  infographic: "infographic",
  report: "report",
  "mind-map": "mind_map",
  "data-table": "data_table",
  quiz: "quiz",
  flashcards: "flashcards",
};

function addDownloadOptions(cmd: Command): Command {
  return cmd
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--all", "Download all matching artifacts")
    .option("--latest", "Download the most recent artifact")
    .option("--earliest", "Download the oldest artifact")
    .option("--name <pattern>", "Filter by name pattern")
    .option("-a, --artifact <id>", "Download specific artifact by ID")
    .option("--dry-run", "Show what would be downloaded without downloading")
    .option("--force", "Overwrite existing files")
    .option("--format <fmt>", "Output format (for quiz/flashcards: json|markdown|html)");
}

async function downloadArtifactByType(
  artifactTypeName: string,
  outputPath: string | undefined,
  opts: Record<string, unknown>,
  globalOpts: GlobalOptions,
): Promise<void> {
  const client = makeClient(globalOpts);
  const notebookId = await requireNotebookId(client, opts.notebook as string | undefined);
  const artifactType = ARTIFACT_TYPES[artifactTypeName];

  let artifacts = await client.artifacts.list(notebookId, artifactType);

  if (opts.name) {
    const pattern = opts.name as string;
    artifacts = artifacts.filter((a) => a.title.toLowerCase().includes(pattern.toLowerCase()));
  }

  if (artifacts.length === 0) {
    console.log(chalk.yellow(`No ${artifactTypeName} artifacts found.`));
    return;
  }

  let targets = artifacts;
  if (opts.artifact) {
    targets = artifacts.filter((a) => a.id.startsWith(opts.artifact as string));
  } else if (opts.latest) {
    const sorted = [...artifacts].sort((a, b) => (b.createdMs ?? 0) - (a.createdMs ?? 0));
    targets = [sorted[0]];
  } else if (opts.earliest) {
    const sorted = [...artifacts].sort((a, b) => (a.createdMs ?? 0) - (b.createdMs ?? 0));
    targets = [sorted[0]];
  } else if (!opts.all) {
    // Default: download the most recent
    const sorted = [...artifacts].sort((a, b) => (b.createdMs ?? 0) - (a.createdMs ?? 0));
    targets = [sorted[0]];
  }

  if (opts.dryRun) {
    console.log(`Would download ${targets.length} artifact(s):`);
    for (const a of targets) console.log(`  ${a.id} — ${a.title}`);
    return;
  }

  for (const artifact of targets) {
    const outDir = outputPath ?? ".";
    const ext = artifactExtension(artifactTypeName, opts.format as string | undefined);
    const filename = `${sanitizeFilename(artifact.title)}.${ext}`;
    const filePath = join(outDir, filename);

    const spinner = ora(`Downloading ${artifact.title}...`).start();
    try {
      const data = await client.artifacts.download(notebookId, artifact.id);
      await writeFile(filePath, data);
      spinner.succeed(`Saved: ${filePath}`);
    } catch (e) {
      spinner.fail(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

export function buildDownloadCommands(program: Command): void {
  const dlCmd = new Command("download").description("Download generated artifacts");

  for (const [typeName] of Object.entries(ARTIFACT_TYPES)) {
    addDownloadOptions(
      dlCmd
        .command(`${typeName} [path]`)
        .description(`Download ${typeName} artifact(s)`),
    ).action(
      action(async (path, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        await downloadArtifactByType(typeName, path, opts, globalOpts);
      }),
    );
  }

  program.addCommand(dlCmd);
}

function artifactExtension(typeName: string, format?: string): string {
  if (format) return format;
  const map: Record<string, string> = {
    audio: "mp3",
    video: "mp4",
    "slide-deck": "pptx",
    infographic: "png",
    report: "pdf",
    "mind-map": "png",
    "data-table": "csv",
    quiz: "json",
    flashcards: "json",
  };
  return map[typeName] ?? "bin";
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim().replace(/\s+/g, "_");
}
