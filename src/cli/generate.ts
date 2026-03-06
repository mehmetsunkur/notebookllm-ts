// Generate commands: audio, video, quiz, flashcards, infographic, slide-deck,
//                   revise-slide, data-table, mind-map, report

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { makeClient, action, printOrJson, requireNotebookId } from "./options.ts";
import type { GlobalOptions } from "../types.ts";

function addCommonGenerateOptions(cmd: Command): Command {
  return cmd
    .option("-n, --notebook <id>", "Notebook ID")
    .option("-s, --source <id...>", "Limit to specific source IDs")
    .option("--language <code>", "Language code (e.g. en, de, fr)")
    .option("--wait", "Wait for generation to complete")
    .option("--retry <n>", "Retry up to N times on failure", "0")
    .option("--json", "Output as JSON");
}

export function buildGenerateCommands(program: Command): void {
  const genCmd = new Command("generate").description("Generate artifacts from notebook content");

  // generate audio
  addCommonGenerateOptions(
    genCmd
      .command("audio [description]")
      .description("Generate an Audio Overview")
      .option("--format <fmt>", "Audio format")
      .option("--length <length>", "Length hint (short|medium|long)"),
  ).action(
    action(async (description, opts, cmd) => {
      const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
      const client = makeClient(globalOpts);
      const notebookId = await requireNotebookId(client, opts.notebook);
      const spinner = ora("Generating audio...").start();
      const result = await client.generate.generateAudio(notebookId, {
        description,
        format: opts.format,
        length: opts.length,
        sourceIds: opts.source,
        language: opts.language,
        wait: opts.wait,
      });
      spinner.succeed("Done.");
      printOrJson(result, opts.json || globalOpts.json, (r) => {
        console.log(chalk.green("Audio generation started."));
        if ("taskId" in r) console.log(`Task ID: ${r.taskId}`);
        if ("id" in r) console.log(`Artifact ID: ${r.id}`);
      });
    }),
  );

  // generate video
  addCommonGenerateOptions(
    genCmd
      .command("video [description]")
      .description("Generate a Video Overview")
      .option("--format <fmt>", "Video format")
      .option("--style <style>", "Video style"),
  ).action(
    action(async (description, opts, cmd) => {
      const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
      const client = makeClient(globalOpts);
      const notebookId = await requireNotebookId(client, opts.notebook);
      const spinner = ora("Generating video...").start();
      const result = await client.generate.generateVideo(notebookId, {
        description,
        format: opts.format,
        style: opts.style,
        sourceIds: opts.source,
        language: opts.language,
        wait: opts.wait,
      });
      spinner.succeed("Done.");
      printOrJson(result, opts.json || globalOpts.json, (r) => {
        console.log(chalk.green("Video generation started."));
        if ("taskId" in r) console.log(`Task ID: ${r.taskId}`);
      });
    }),
  );

  // generate slide-deck
  addCommonGenerateOptions(
    genCmd
      .command("slide-deck [description]")
      .description("Generate a slide deck")
      .option("--format <fmt>", "Slide format")
      .option("--length <length>", "Length hint"),
  ).action(
    action(async (description, opts, cmd) => {
      const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
      const client = makeClient(globalOpts);
      const notebookId = await requireNotebookId(client, opts.notebook);
      const spinner = ora("Generating slide deck...").start();
      const result = await client.generate.generateSlideDeck(notebookId, {
        description,
        format: opts.format,
        length: opts.length,
        sourceIds: opts.source,
        language: opts.language,
        wait: opts.wait,
      });
      spinner.succeed("Done.");
      printOrJson(result, opts.json || globalOpts.json, (r) => {
        console.log(chalk.green("Slide deck generation started."));
        if ("taskId" in r) console.log(`Task ID: ${r.taskId}`);
      });
    }),
  );

  // generate revise-slide
  addCommonGenerateOptions(
    genCmd
      .command("revise-slide <description>")
      .description("Revise a specific slide in an existing slide deck")
      .requiredOption("--artifact <id>", "Artifact ID of the slide deck")
      .requiredOption("--slide <n>", "Slide number to revise"),
  ).action(
    action(async (description, opts, cmd) => {
      const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
      const client = makeClient(globalOpts);
      const notebookId = await requireNotebookId(client, opts.notebook);
      const spinner = ora("Revising slide...").start();
      const result = await client.generate.reviseSlide(notebookId, {
        description,
        artifactId: opts.artifact,
        slideNumber: parseInt(opts.slide, 10),
        sourceIds: opts.source,
        language: opts.language,
        wait: opts.wait,
      });
      spinner.succeed("Done.");
      printOrJson(result, opts.json || globalOpts.json, (r) => {
        console.log(chalk.green("Slide revision started."));
        if ("taskId" in r) console.log(`Task ID: ${r.taskId}`);
      });
    }),
  );

  // generate quiz
  addCommonGenerateOptions(
    genCmd
      .command("quiz [description]")
      .description("Generate a quiz")
      .option("--difficulty <level>", "Difficulty: easy|medium|hard")
      .option("--quantity <n>", "Number of questions"),
  ).action(
    action(async (description, opts, cmd) => {
      const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
      const client = makeClient(globalOpts);
      const notebookId = await requireNotebookId(client, opts.notebook);
      const spinner = ora("Generating quiz...").start();
      const result = await client.generate.generateQuiz(notebookId, {
        description,
        difficulty: opts.difficulty,
        quantity: opts.quantity ? parseInt(opts.quantity, 10) : undefined,
        sourceIds: opts.source,
        language: opts.language,
        wait: opts.wait,
      });
      spinner.succeed("Done.");
      printOrJson(result, opts.json || globalOpts.json, (r) => {
        console.log(chalk.green("Quiz generation started."));
        if ("taskId" in r) console.log(`Task ID: ${r.taskId}`);
      });
    }),
  );

  // generate flashcards
  addCommonGenerateOptions(
    genCmd
      .command("flashcards [description]")
      .description("Generate flashcards")
      .option("--difficulty <level>", "Difficulty: easy|medium|hard")
      .option("--quantity <n>", "Number of cards"),
  ).action(
    action(async (description, opts, cmd) => {
      const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
      const client = makeClient(globalOpts);
      const notebookId = await requireNotebookId(client, opts.notebook);
      const spinner = ora("Generating flashcards...").start();
      const result = await client.generate.generateFlashcards(notebookId, {
        description,
        difficulty: opts.difficulty,
        quantity: opts.quantity ? parseInt(opts.quantity, 10) : undefined,
        sourceIds: opts.source,
        language: opts.language,
        wait: opts.wait,
      });
      spinner.succeed("Done.");
      printOrJson(result, opts.json || globalOpts.json, (r) => {
        console.log(chalk.green("Flashcards generation started."));
        if ("taskId" in r) console.log(`Task ID: ${r.taskId}`);
      });
    }),
  );

  // generate infographic
  addCommonGenerateOptions(
    genCmd
      .command("infographic [description]")
      .description("Generate an infographic")
      .option("--orientation <o>", "Orientation: portrait|landscape")
      .option("--detail <d>", "Detail level: low|medium|high"),
  ).action(
    action(async (description, opts, cmd) => {
      const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
      const client = makeClient(globalOpts);
      const notebookId = await requireNotebookId(client, opts.notebook);
      const spinner = ora("Generating infographic...").start();
      const result = await client.generate.generateInfographic(notebookId, {
        description,
        orientation: opts.orientation,
        detail: opts.detail,
        sourceIds: opts.source,
        language: opts.language,
        wait: opts.wait,
      });
      spinner.succeed("Done.");
      printOrJson(result, opts.json || globalOpts.json, (r) => {
        console.log(chalk.green("Infographic generation started."));
        if ("taskId" in r) console.log(`Task ID: ${r.taskId}`);
      });
    }),
  );

  // generate data-table
  addCommonGenerateOptions(
    genCmd
      .command("data-table <description>")
      .description("Generate a data table"),
  ).action(
    action(async (description, opts, cmd) => {
      const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
      const client = makeClient(globalOpts);
      const notebookId = await requireNotebookId(client, opts.notebook);
      const spinner = ora("Generating data table...").start();
      const result = await client.generate.generateDataTable(notebookId, {
        description,
        sourceIds: opts.source,
        language: opts.language,
        wait: opts.wait,
      });
      spinner.succeed("Done.");
      printOrJson(result, opts.json || globalOpts.json, (r) => {
        console.log(chalk.green("Data table generation started."));
        if ("taskId" in r) console.log(`Task ID: ${r.taskId}`);
      });
    }),
  );

  // generate mind-map
  addCommonGenerateOptions(
    genCmd.command("mind-map").description("Generate a mind map"),
  ).action(
    action(async (opts, cmd) => {
      const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
      const client = makeClient(globalOpts);
      const notebookId = await requireNotebookId(client, opts.notebook);
      const spinner = ora("Generating mind map...").start();
      const result = await client.generate.generateMindMap(notebookId, {
        sourceIds: opts.source,
        language: opts.language,
        wait: opts.wait,
      });
      spinner.succeed("Done.");
      printOrJson(result, opts.json || globalOpts.json, (r) => {
        console.log(chalk.green("Mind map generation started."));
        if ("taskId" in r) console.log(`Task ID: ${r.taskId}`);
      });
    }),
  );

  // generate report
  addCommonGenerateOptions(
    genCmd
      .command("report [description]")
      .description("Generate a report")
      .option("--format <fmt>", "Report format")
      .option("--append", "Append to existing report"),
  ).action(
    action(async (description, opts, cmd) => {
      const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
      const client = makeClient(globalOpts);
      const notebookId = await requireNotebookId(client, opts.notebook);
      const spinner = ora("Generating report...").start();
      const result = await client.generate.generateReport(notebookId, {
        description,
        format: opts.format,
        append: opts.append,
        sourceIds: opts.source,
        language: opts.language,
        wait: opts.wait,
      });
      spinner.succeed("Done.");
      printOrJson(result, opts.json || globalOpts.json, (r) => {
        console.log(chalk.green("Report generation started."));
        if ("taskId" in r) console.log(`Task ID: ${r.taskId}`);
      });
    }),
  );

  program.addCommand(genCmd);
}
