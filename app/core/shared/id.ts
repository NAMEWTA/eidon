import { monotonicFactory } from "ulid";

const RUN_ID_PATTERN = /^\d{8}-\d{6}-[0-9a-f]{6}$/;

// ULID（Crockford base32，26 字符，排除 I/L/O/U）——节点身份格式。
// 必须与 contracts/node.ts 的 NodeIdSchema 正则保持一致（两处独立持有以维持 shared 为纯叶子）。
const NODE_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

// 单调工厂：同一毫秒内严格递增，保证字典序=创建顺序（排序稳定、删缓存重建可复现顺序）。
const nextNodeUlid = monotonicFactory();

/** 生成节点身份 ULID：存入 `.node/node.json` 的 id，随目录移动不变（见 AGENTS.md §3.1）。 */
export const createNodeId = (): string => nextNodeUlid();

/** 校验字符串是否为合法节点身份 ULID（形状与 contracts 的 NodeIdSchema 一致）。 */
export const isNodeId = (value: string): boolean => NODE_ID_PATTERN.test(value);

export const isRunId = (value: string): boolean => RUN_ID_PATTERN.test(value);

export const createRunId = (now = new Date(), suffix = randomHex(3)): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return [
    now.getUTCFullYear().toString().padStart(4, "0"),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    "-",
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
    "-",
    suffix,
  ].join("");
};

const randomHex = (bytes: number): string => {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return [...data].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
