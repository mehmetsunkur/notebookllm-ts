import { ClientCore } from "./core.js";
import { RPCMethod } from "../rpc/methods.js";
import type { Language } from "../types.js";
import { getConfigPath, ensureHomeDir } from "../paths.js";

export class SettingsAPI extends ClientCore {
  async listLanguages(): Promise<Language[]> {
    try {
      const raw = await this.rpc(RPCMethod.LIST_LANGUAGES, []);
      const parsed = parseLanguageList(raw);
      if (parsed.length > 0) return parsed;
    } catch {
      // Fall through to a conservative built-in list when server RPC is unavailable.
    }
    return [
      { code: "en", name: "English" },
      { code: "es", name: "Spanish" },
      { code: "fr", name: "French" },
      { code: "de", name: "German" },
      { code: "it", name: "Italian" },
      { code: "pt", name: "Portuguese" },
      { code: "ja", name: "Japanese" },
      { code: "ko", name: "Korean" },
      { code: "zh_Hans", name: "Chinese (Simplified)" },
      { code: "zh_Hant", name: "Chinese (Traditional)" },
    ];
  }

  async getLanguage(notebookId: string): Promise<string> {
    void notebookId;
    const raw = await this.rpc(
      RPCMethod.GET_LANGUAGE,
      [null, [1, null, null, null, null, null, null, null, null, null, [1]]],
      { sourcePath: "/" },
    );
    if (
      Array.isArray(raw) &&
      Array.isArray(raw[0]) &&
      Array.isArray(raw[0][2]) &&
      Array.isArray(raw[0][2][4]) &&
      typeof raw[0][2][4][0] === "string"
    ) {
      return raw[0][2][4][0];
    }
    if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
    return "en";
  }

  async setLanguage(notebookId: string, languageCode: string): Promise<void> {
    void notebookId;
    await this.rpc(
      RPCMethod.SET_LANGUAGE,
      [[[null, [[null, null, null, null, [languageCode]]]]]],
      { sourcePath: "/" },
    );
  }

  /** Get language from local config file. */
  async getLocalLanguage(homeDir?: string): Promise<string | null> {
    const { readFile, access } = await import("fs/promises");
    const configPath = getConfigPath(homeDir);
    const exists = await access(configPath).then(() => true).catch(() => false);
    if (!exists) return null;
    try {
      const config = JSON.parse(await readFile(configPath, "utf-8"));
      return config.language ?? null;
    } catch {
      return null;
    }
  }

  /** Set language in local config file. */
  async setLocalLanguage(languageCode: string, homeDir?: string): Promise<void> {
    const { readFile, writeFile, access } = await import("fs/promises");
    await ensureHomeDir(homeDir);
    const configPath = getConfigPath(homeDir);
    let config: Record<string, unknown> = {};
    const exists = await access(configPath).then(() => true).catch(() => false);
    if (exists) {
      try {
        config = JSON.parse(await readFile(configPath, "utf-8"));
      } catch {
        // Start fresh
      }
    }
    config.language = languageCode;
    await writeFile(configPath, JSON.stringify(config, null, 2));
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
