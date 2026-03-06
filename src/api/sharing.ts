import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { ShareSettings, Collaborator, Permission } from "../types.ts";

export class SharingAPI extends ClientCore {
  async status(notebookId: string): Promise<ShareSettings> {
    const raw = await this.rpc(RPCMethod.SHARE_STATUS, [notebookId, [2]], {
      sourcePath: `/notebook/${notebookId}`,
    });
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
  const outer = raw as unknown[];
  const arr = Array.isArray(outer[0]) ? (outer[0] as unknown[]) : outer;

  const firstUsers = Array.isArray(arr[0]) ? (arr[0] as unknown[]) : [];
  const userEntries =
    firstUsers.length > 0 && typeof firstUsers[0] === "string"
      ? [firstUsers]
      : firstUsers;
  const collaborators = userEntries
    .filter(Array.isArray)
    .map((c) => {
        const carr = c as unknown[];
        return {
          email: String(carr[0] ?? ""),
          permission: ((typeof carr[1] === "number"
            ? (carr[1] === 1 ? "editor" : "viewer")
            : carr[1]) as Permission) ?? "viewer",
        };
      });

  const isPublic = Array.isArray(arr[1]) ? Boolean(arr[1][0]) : Boolean(arr[1] ?? false);
  const shareLink = undefined;
  const viewLevel: ShareSettings["viewLevel"] = "view";

  return { isPublic, shareLink, viewLevel, collaborators };
}
