import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { Language } from "../types.ts";
import { getConfigPath, ensureHomeDir } from "../paths.ts";

export class SettingsAPI extends ClientCore {
  async listLanguages(): Promise<Language[]> {
    const raw = await this.rpc(RPCMethod.LIST_LANGUAGES, []);
    return parseLanguageList(raw);
  }

  async getLanguage(notebookId: string): Promise<string> {
    const raw = await this.rpc(RPCMethod.GET_LANGUAGE, [notebookId]);
    if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
    return String(raw ?? "en");
  }

  async setLanguage(notebookId: string, languageCode: string): Promise<void> {
    await this.rpc(RPCMethod.SET_LANGUAGE, [notebookId, languageCode]);
  }

  /** Get language from local config file. */
  async getLocalLanguage(homeDir?: string): Promise<string | null> {
    const configPath = getConfigPath(homeDir);
    const file = Bun.file(configPath);
    if (!(await file.exists())) return null;
    try {
      const config = JSON.parse(await file.text());
      return config.language ?? null;
    } catch {
      return null;
    }
  }

  /** Set language in local config file. */
  async setLocalLanguage(languageCode: string, homeDir?: string): Promise<void> {
    await ensureHomeDir(homeDir);
    const configPath = getConfigPath(homeDir);
    const file = Bun.file(configPath);
    let config: Record<string, unknown> = {};
    if (await file.exists()) {
      try {
        config = JSON.parse(await file.text());
      } catch {
        // Start fresh
      }
    }
    config.language = languageCode;
    await Bun.write(configPath, JSON.stringify(config, null, 2));
  }
}

// --- Parsers ---

function parseLanguageList(raw: unknown): Language[] {
  if (!Array.isArray(raw)) return [];
  const outer = raw as unknown[];
  const list = Array.isArray(outer[0]) ? (outer[0] as unknown[]) : outer;
  return list.filter(Array.isArray).map((item) => {
    const arr = item as unknown[];
    return {
      code: String(arr[0] ?? ""),
      name: String(arr[1] ?? ""),
    };
  });
}
