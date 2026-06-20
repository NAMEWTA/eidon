/**
 * knowledge 域 IPC handler。
 * workspace-index(6) + search(1) + spellcheck(5) + cjk-proofread(1)。
 */
import * as index from "../../capabilities/knowledge/workspace-index";
import { searchInDir } from "../../capabilities/knowledge/search";
import * as spell from "../../capabilities/knowledge/spellcheck";
import { cjkProofread } from "../../capabilities/knowledge/cjk-proofread";
import type { IpcHandlers } from "../register";

export const knowledgeHandlers: IpcHandlers = {
  // workspace index
  "kn:indexInit": ({ workspace }) => index.indexInit(workspace),
  "kn:indexFiles": () => index.indexFiles(),
  "kn:backlinks": ({ target }) => index.backlinks(target),
  "kn:tags": () => index.tags(),
  "kn:resolve": ({ name }) => index.resolve(name),
  "kn:rescan": () => index.rescan(),

  // search
  "kn:search": ({ root, query, maxResults }) =>
    searchInDir(root, query, maxResults ?? 200),

  // spellcheck
  "kn:spellInit": ({ lang }) => spell.spellInit(lang),
  "kn:spellCheck": ({ text }) => spell.spellCheck(text),
  "kn:spellSuggest": ({ word }) => spell.spellSuggest(word),
  "kn:spellAdd": ({ word }) => spell.spellAdd(word),
  "kn:spellLoadUser": () => spell.spellLoadUser(),

  // cjk proofread
  "kn:cjkProofread": ({ text }) => cjkProofread(text),
};
