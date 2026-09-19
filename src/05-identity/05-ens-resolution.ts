import { createPublicClient, http } from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";

// ENS 已经在以太坊主网真实运行多年，这里不做模拟——
// 直接用公共 RPC 节点做只读查询，是 100% 真实的链上数据。
//
// 核心价值：把 0x... 这种没人记得住的地址，映射成人类可读的名字，
// 正向解析（名字 -> 地址）和反向解析（地址 -> 名字）都支持。

const client = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com"),
});

async function main() {
  // 1. 正向解析：name -> address（这是最常见的用法，比如钱包里输入 vitalik.eth 转账）
  const ensName = "vitalik.eth";
  const resolvedAddress = await client.getEnsAddress({ name: normalize(ensName) });
  console.log(`[forward] ${ensName} -> ${resolvedAddress}`);

  // 2. 反向解析：address -> name（拿到一个地址，反查它有没有设置"主 ENS 名字"）
  if (resolvedAddress) {
    const reverseName = await client.getEnsName({ address: resolvedAddress });
    console.log(`[reverse] ${resolvedAddress} -> ${reverseName}`);
  }

  // 3. 查询 ENS 文本记录：ENS 不只能存地址，还能存头像、简介、社交账号等 key-value
  //    对 Agent 场景的启发：未来 Agent 的 ENS 名字下，也可以挂类似
  //    "agent-card-url"、"a2a-endpoint" 这样的自定义文本记录
  const description = await client.getEnsText({ name: normalize(ensName), key: "description" });
  console.log(`[text record] description: ${description}`);

  console.log("\n[结论] ENS 把地址变成了人类可读、可记忆、可反查的名字。");
  console.log("如果给一个 Agent 注册 myagent.eth，配合 ERC-8004 的身份 NFT，");
  console.log("就能做到：看到一个名字 -> 反查地址 -> 反查链上身份注册文件 -> 验证签名，一条完整的信任链路。");
}

main();
