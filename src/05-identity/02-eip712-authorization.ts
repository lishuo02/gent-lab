import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { verifyTypedData } from "viem";

const agentPrivateKey = generatePrivateKey();
const agentAccount = privateKeyToAccount(agentPrivateKey);

// EIP-712 的核心：把"要签的内容"从一坨字节变成有结构、有字段名的数据，
// 钱包/审核方可以按字段展示，而不是签一段看不懂的乱码。

// 1. Domain：这份签名属于哪个"应用场景"，防止被拿到别的地方重放
const domain = {
  name: "AgentPassport",
  version: "1",
  chainId: 1,
} as const;

// 2. Types：定义数据结构长什么样
const types = {
  ToolAuthorization: [
    { name: "agent", type: "address" },
    { name: "tool", type: "string" },
    { name: "maxCalls", type: "uint256" },
    { name: "expiry", type: "string" },
  ],
} as const;

// 3. Message：真正要签的内容——一份"Agent 授权调用某个工具"的声明
const message = {
  agent: agentAccount.address,
  tool: "read_file",
  maxCalls: 10n,
  expiry: "2026-10-31",
} as const;

console.log("[eip712] 即将签署的结构化数据：");
console.log(JSON.stringify({ domain, primaryType: "ToolAuthorization", message }, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));

// 用 EIP-712 格式签名（不是签一段普通文本，而是签这份结构化数据）
const signature = await agentAccount.signTypedData({
  domain,
  types,
  primaryType: "ToolAuthorization",
  message,
});

console.log("\n[eip712] signature:", signature);

// 验证：同样需要提供完整的 domain/types/message，才能验证签名是否匹配
const isValid = await verifyTypedData({
  address: agentAccount.address,
  domain,
  types,
  primaryType: "ToolAuthorization",
  message,
  signature,
});
console.log("\n[verify] 授权书签名是否有效:", isValid);

// 篡改一个字段（比如把 maxCalls 从 10 改成 999），验证应该失败
// 这正是 EIP-712 的价值：字段级别的完整性保护，而不是笼统的一段文本
const tamperedMessage = { ...message, maxCalls: 999n };
const isTamperedValid = await verifyTypedData({
  address: agentAccount.address,
  domain,
  types,
  primaryType: "ToolAuthorization",
  message: tamperedMessage,
  signature,
});
console.log("[verify] 篡改 maxCalls 后签名是否仍有效:", isTamperedValid, "(应为 false)");
