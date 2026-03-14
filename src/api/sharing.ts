import { ClientCore } from "./core.js";
import { RPCMethod } from "../rpc/methods.js";
import type { ShareSettings, Collaborator, Permission } from "../types.js";

export class SharingAPI extends ClientCore {
  async status(notebookId: string): Promise<ShareSettings> {
    const raw = await this.rpc(RPCMethod.SHARE_STATUS, [notebookId, [2]], {
      sourcePath: `/notebook/${notebookId}`,
    });
    return parseShareSettings(raw);
  }

  async setPublic(notebookId: string, enable: boolean): Promise<ShareSettings> {
    const access = enable ? 1 : 0;
    await this.rpc(
      RPCMethod.SHARE_NOTEBOOK,
      [[[notebookId, null, [access], [access, ""]]], 1, null, [2]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    return this.status(notebookId);
  }

  async setViewLevel(notebookId: string, level: "view" | "comment" | "edit"): Promise<ShareSettings> {
    const viewLevelCode = level === "view" ? 0 : 1;
    await this.rpc(
      RPCMethod.RENAME_NOTEBOOK,
      [notebookId, [[null, null, null, null, null, null, null, null, [[viewLevelCode]]]]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    const current = await this.status(notebookId);
    return { ...current, viewLevel: level };
  }

  async addCollaborator(
    notebookId: string,
    email: string,
    options: { permission?: Permission; notify?: boolean } = {},
  ): Promise<ShareSettings> {
    const permissionCode = permissionToCode(options.permission ?? "viewer");
    await this.rpc(
      RPCMethod.SHARE_NOTEBOOK,
      [[[
        notebookId,
        [[email, null, permissionCode]],
        null,
        [1, ""],
      ]], options.notify === false ? 0 : 1, null, [2]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    return this.status(notebookId);
  }

  async updateCollaborator(
    notebookId: string,
    email: string,
    permission: Permission,
  ): Promise<ShareSettings> {
    return this.addCollaborator(notebookId, email, {
      permission,
      notify: false,
    });
  }

  async removeCollaborator(notebookId: string, email: string): Promise<ShareSettings> {
    await this.rpc(
      RPCMethod.SHARE_NOTEBOOK,
      [[[notebookId, [[email, null, 4]], null, [0, ""]]], 0, null, [2]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    return this.status(notebookId);
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

function permissionToCode(permission: Permission): number {
  if (permission === "editor") return 2;
  return 3;
}
