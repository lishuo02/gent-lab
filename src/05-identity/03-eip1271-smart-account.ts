import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";

// EIP-1271 要解决的问题：EOA 天然能用 ecrecover 验证签名，
// 但智能合约账户没有私钥，无法这样验证。EIP-1271 让合约自己实现
// isValidSignature(hash, signature) -> magicValue 接口，验证逻辑完全自定义。
//
// 这里不部署真实合约（避免引入完整的 Solidity 工具链），
// 用一个 TypeScript 类模拟"智能合约账户"的内部逻辑，
// 重点演示协议本身：验证方不再自己用密码学算法判断，而是"问合约自己"。

const EIP1271_MAGIC_VALUE = "0x1626ba7e"; // 标准规定：认可签名时必须返回这个固定值
const EIP1271_INVALID_VALUE = "0xffffffff";

/**
 * 模拟一个"Agent Smart Account"：规则是 2-of-2 多签——
 * Agent 自己的私钥 + 一个"人类监督者"的私钥，两个都签了才算有效。
 * 这种复合规则，普通 EOA 做不到，只有合约账户能表达。
 */
class SimulatedAgentSmartAccount {
  constructor(
    private agentAddress: `0x${string}`,
    private supervisorAddress: `0x${string}`,
  ) {}

  // 对应 Solidity 里的 isValidSignature(bytes32 hash, bytes memory signature)
  // 这里 signature 约定为 "agentSig|supervisorSig" 用 "." 拼接，仅用于演示
  async isValidSignature(message: string, combinedSignature: string): Promise<string> {
    const [agentSig, supervisorSig] = combinedSignature.split(".");
    // 签名长度固定为 132 个字符（0x + 130 位十六进制）；格式不对的一律视为"缺失/无效"
    const isWellFormedSig = (sig?: string): sig is `0x${string}` =>
      !!sig && sig.length === 132;
    if (!isWellFormedSig(agentSig) || !isWellFormedSig(supervisorSig)) return EIP1271_INVALID_VALUE;

    const agentOk = await verifyMessage({
      address: this.agentAddress,
      message,
      signature: agentSig,
    });
    const supervisorOk = await verifyMessage({
      address: this.supervisorAddress,
      message,
      signature: supervisorSig as `0x${string}`,
    });

    // 合约内部想怎么判断都行——这里的规则是"两个都必须签"
    return agentOk && supervisorOk ? EIP1271_MAGIC_VALUE : EIP1271_INVALID_VALUE;
  }
}

async function main() {
  const agentKey = generatePrivateKey();
  const supervisorKey = generatePrivateKey();
  const agent = privateKeyToAccount(agentKey);
  const supervisor = privateKeyToAccount(supervisorKey);

  const smartAccount = new SimulatedAgentSmartAccount(agent.address, supervisor.address);

  const message = "授权：从 Agent 金库转出 500 USDC 用于支付 API 调用";

  // 场景 1：只有 Agent 自己签名，监督者没签 —— 应该被拒绝
  const agentOnlySig = await agent.signMessage({ message });
  const result1 = await smartAccount.isValidSignature(message, `${agentOnlySig}.0x`);
  console.log("[场景1] 只有 Agent 签名:", result1 === EIP1271_MAGIC_VALUE ? "✅ 有效" : "❌ 无效（符合预期，缺少监督者签名）");

  // 场景 2：Agent 和监督者都签名 —— 应该通过
  const supervisorSig = await supervisor.signMessage({ message });
  const combinedSig = `${agentOnlySig}.${supervisorSig}`;
  const result2 = await smartAccount.isValidSignature(message, combinedSig);
  console.log("[场景2] Agent + 监督者都签名:", result2 === EIP1271_MAGIC_VALUE ? "✅ 有效" : "❌ 无效");

  // 场景 3：换一个不相关的人签"监督者"那部分 —— 应该被拒绝
  const strangerKey = generatePrivateKey();
  const stranger = privateKeyToAccount(strangerKey);
  const strangerSig = await stranger.signMessage({ message });
  const result3 = await smartAccount.isValidSignature(message, `${agentOnlySig}.${strangerSig}`);
  console.log("[场景3] 监督者位置被陌生人签名冒充:", result3 === EIP1271_MAGIC_VALUE ? "✅ 有效" : "❌ 无效（符合预期）");

  console.log("\n[结论] 验证方全程没有用密码学算法自己判断，而是把签名丢给智能账户，");
  console.log("由账户自己的 isValidSignature 逻辑决定是否认可——这就是 EIP-1271 的核心思路。");
}

main();
