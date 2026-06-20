/**
 * git 域 IPC handler（20 通道）。
 * ops(status/init/autoCommit/dirty/分支) + history + diff + prune + cloud-folder/session。
 */
import * as ops from "../../capabilities/git/ops";
import * as history from "../../capabilities/git/history";
import { fileDiff } from "../../capabilities/git/diff";
import * as prune from "../../capabilities/git/prune";
import * as cloud from "../../capabilities/git/cloud-folder";
import type { IpcHandlers } from "../register";

export const gitHandlers: IpcHandlers = {
  // ops
  "git:status": ({ folder }) => ops.workspaceStatus(folder),
  "git:init": ({ folder, initialMessage, excludeAssets }) =>
    ops.initWorkspace(folder, initialMessage ?? null, excludeAssets ?? false),
  "git:autoCommit": ({ folder, filePath, message }) =>
    ops.autoCommit(folder, filePath ?? null, message ?? null),
  "git:dirty": ({ workspace }) => ops.hasDirtyChanges(workspace),
  "git:createBranch": ({ workspace, branch }) => ops.createBranch(workspace, branch),
  "git:checkout": ({ workspace, branch }) => ops.checkout(workspace, branch),
  "git:restoreHead": ({ workspace, branch }) => ops.restoreHead(workspace, branch),
  "git:deleteBranch": ({ workspace, branch }) => ops.deleteBranch(workspace, branch),

  // history / diff
  "git:fileHistory": async ({ folder, filePath, limit }) => {
    try {
      return await history.fileHistory(folder, filePath, limit ?? 50);
    } catch (e) {
      if ((e as Error).message.startsWith("file is outside workspace")) return [];
      throw e;
    }
  },
  "git:fileDiff": ({ folder, filePath, sha }) => fileDiff(folder, filePath, sha),
  "git:fileAtVersion": ({ folder, filePath, sha }) =>
    history.fileAtVersion(folder, filePath, sha),
  "git:rollbackFile": ({ folder, filePath, sha }) =>
    history.rollbackFile(folder, filePath, sha),

  // prune
  "git:repoSize": ({ folder }) => prune.repoSize(folder),
  "git:pruneHistory": ({ folder, maxCommits }) => prune.pruneHistory(folder, maxCommits),

  // cloud-folder / session
  "git:cloudDetect": ({ folder }) => cloud.cloudDetect(folder),
  "git:deviceId": () => cloud.deviceIdGetOrCreate(),
  "git:sessionSave": ({ folder, payload }) => cloud.sessionSave(folder, payload),
  "git:sessionLoad": ({ folder, deviceId }) => cloud.sessionLoad(folder, deviceId),
  "git:sessionListOthers": ({ folder, ourDeviceId }) =>
    cloud.sessionListOthers(folder, ourDeviceId),
};
