// Session commands: login, use, status, clear, auth

import { Command } from "commander";
import chalk from "chalk";
import { makeClient, action, handleError, printOrJson, resolveHomeDir } from "./options.ts";
import { login, hasValidStorage } from "../auth/login.ts";
import { getStoragePath, getContextPath, getHomeDir } from "../paths.ts";
import { loadCookieHeader } from "../auth/storage.ts";
import { fetchTokens } from "../auth/tokens.ts";
import type { GlobalOptions } from "../types.ts";

export function buildSessionCommands(program: Command): void {
  // login
  program
    .command("login")
    .description("Open a browser to log in to Google NotebookLM and save the session")
    .option("--timeout <seconds>", "Login timeout in seconds", "300")
    .option("--headless", "Run browser in headless mode (for CI — requires manual cookie paste)")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const homeDir = resolveHomeDir(globalOpts);
        const timeout = parseInt(opts.timeout, 10) * 1000;
        await login({ homeDir, timeout, headless: opts.headless });
      }),
    );

  // use <id>
  program
    .command("use <id>")
    .description("Set the active notebook by ID (supports partial match)")
    .action(
      action(async (id, opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await client.useNotebook(id);
        console.log(chalk.green(`Active notebook set to: ${notebookId}`));
      }),
    );

  // status
  program
    .command("status")
    .description("Show current session context")
    .option("--paths", "Also show config file paths")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const homeDir = resolveHomeDir(globalOpts) ?? getHomeDir();
        const client = makeClient(globalOpts);
        const ctx = await client.loadContext();
        const storagePath = getStoragePath(homeDir);
        const contextPath = getContextPath(homeDir);
        const hasAuth = await hasValidStorage(storagePath);

        const statusData = {
          notebookId: ctx.notebookId ?? null,
          conversationId: ctx.conversationId ?? null,
          authenticated: hasAuth,
          homeDir,
          ...(opts.paths
            ? {
                storagePath,
                contextPath,
              }
            : {}),
        };

        printOrJson(statusData, opts.json || globalOpts.json, (data) => {
          console.log(chalk.bold("Session Status"));
          console.log(`  Notebook ID:   ${data.notebookId ?? chalk.dim("(none)")}`);
          console.log(`  Conversation:  ${data.conversationId ?? chalk.dim("(none)")}`);
          console.log(
            `  Authenticated: ${data.authenticated ? chalk.green("yes") : chalk.red("no")}`,
          );
          console.log(`  Home dir:      ${data.homeDir}`);
          if (opts.paths) {
            console.log(`  Storage:       ${data.storagePath}`);
            console.log(`  Context:       ${data.contextPath}`);
          }
        });
      }),
    );

  // clear
  program
    .command("clear")
    .description("Clear the active notebook context")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        await client.clearContext();
        console.log(chalk.green("Context cleared."));
      }),
    );

  // auth
  const authCmd = new Command("auth").description("Authentication management commands");

  authCmd
    .command("check")
    .description("Check whether your auth session is valid")
    .option("--test", "Make a real API call to verify auth works end-to-end")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const homeDir = resolveHomeDir(globalOpts) ?? getHomeDir();
        const storagePath = getStoragePath(homeDir);
        const hasStorage = await hasValidStorage(storagePath);

        let tokenCheck = false;
        let tokenError: string | null = null;

        if (hasStorage && opts.test) {
          try {
            const cookieHeader = await loadCookieHeader(storagePath);
            await fetchTokens(cookieHeader);
            tokenCheck = true;
          } catch (e) {
            tokenError = e instanceof Error ? e.message : String(e);
          }
        }

        const result = {
          hasStorageFile: hasStorage,
          storagePath,
          tokenValid: opts.test ? tokenCheck : null,
          error: tokenError,
        };

        printOrJson(result, opts.json || globalOpts.json, (data) => {
          console.log(chalk.bold("Auth Check"));
          console.log(
            `  Storage file: ${data.hasStorageFile ? chalk.green("found") : chalk.red("missing")}`,
          );
          console.log(`  Path: ${data.storagePath}`);
          if (opts.test) {
            console.log(
              `  Token test:   ${data.tokenValid ? chalk.green("passed") : chalk.red("failed")}`,
            );
            if (data.error) console.log(chalk.red(`  Error: ${data.error}`));
          }
          if (!data.hasStorageFile) {
            console.log(chalk.yellow('\nRun `notebooklm login` to authenticate.'));
          }
        });
      }),
    );

  program.addCommand(authCmd);
}
