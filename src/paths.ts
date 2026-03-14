import path from "path";
import os from "os";

const DEFAULT_HOME_DIR = ".notebookllm-ts";
const HOME_ENV = "NOTEBOOKLLM_TS_HOME";

export function getHomeDir(): string {
  const envHome = process.env[HOME_ENV];
  if (envHome) return envHome;
  return path.join(os.homedir(), DEFAULT_HOME_DIR);
}

export function getStoragePath(homeDir?: string): string {
  return path.join(homeDir ?? getHomeDir(), "storage_state.json");
}

export function getContextPath(homeDir?: string): string {
  return path.join(homeDir ?? getHomeDir(), "context.json");
}

export function getConfigPath(homeDir?: string): string {
  return path.join(homeDir ?? getHomeDir(), "config.json");
}

export function getBrowserProfileDir(homeDir?: string): string {
  return path.join(homeDir ?? getHomeDir(), "browser_profile");
}

export async function ensureHomeDir(homeDir?: string): Promise<string> {
  const dir = homeDir ?? getHomeDir();
  const { mkdir } = await import("fs/promises");
  await mkdir(dir, { recursive: true });
  return dir;
}
