import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { ShareSettings, Collaborator, Permission } from "../types.ts";

export class SharingAPI extends ClientCore {
  async status(notebookId: string): Promise<ShareSettings> {
    const raw = await this.rpc(RPCMethod.SHARE_STATUS, [notebookId]);
    return parseShareSettings(raw);
  }

  async setPublic(notebookId: string, enable: boolean): Promise<ShareSettings> {
    const raw = await this.rpc(RPCMethod.SHARE_PUBLIC, [notebookId, enable]);
    return parseShareSettings(raw);
  }

  async setViewLevel(notebookId: string, level: "view" | "comment" | "edit"): Promise<ShareSettings> {
    const raw = await this.rpc(RPCMethod.SHARE_VIEW_LEVEL, [notebookId, level]);
    return parseShareSettings(raw);
  }

  async addCollaborator(
    notebookId: string,
    email: string,
    options: { permission?: Permission; notify?: boolean } = {},
  ): Promise<ShareSettings> {
    const raw = await this.rpc(RPCMethod.SHARE_ADD, [
      notebookId,
      email,
      options.permission ?? "viewer",
      options.notify ?? true,
    ]);
    return parseShareSettings(raw);
  }

  async updateCollaborator(
    notebookId: string,
    email: string,
    permission: Permission,
  ): Promise<ShareSettings> {
    const raw = await this.rpc(RPCMethod.SHARE_UPDATE, [notebookId, email, permission]);
    return parseShareSettings(raw);
  }

  async removeCollaborator(notebookId: string, email: string): Promise<ShareSettings> {
    const raw = await this.rpc(RPCMethod.SHARE_REMOVE, [notebookId, email]);
    return parseShareSettings(raw);
  }
}

// --- Parsers ---

function parseShareSettings(raw: unknown): ShareSettings {
  if (!Array.isArray(raw)) {
    return { isPublic: false };
  }
  const arr = raw as unknown[];
  const isPublic = Boolean(arr[0]);
  const shareLink = typeof arr[1] === "string" ? arr[1] : undefined;
  const viewLevel = (arr[2] as ShareSettings["viewLevel"]) ?? undefined;

  const collaborators = Array.isArray(arr[3])
    ? (arr[3] as unknown[]).filter(Array.isArray).map((c) => {
        const carr = c as unknown[];
        return {
          email: String(carr[0] ?? ""),
          permission: (carr[1] as Permission) ?? "viewer",
          addedMs: typeof carr[2] === "number" ? carr[2] : undefined,
        };
      })
    : undefined;

  return { isPublic, shareLink, viewLevel, collaborators };
}
