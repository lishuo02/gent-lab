import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";

// ERC-8004 的 Identity Registry 建立在 ERC-721（NFT）之上：
// 每个 Agent = 一个 NFT，tokenId 是身份编号，tokenURI 指向一份链下的
// "Agent 注册文件"（本质上和 A2A 的 Agent Card 结构很像）。
//
// 这里不部署真实的 ERC-721 合约，而是用一个内存态的 Registry 类模拟
// 它的核心行为：register -> 拿到 tokenId -> 查 tokenURI -> 验证归属。

interface AgentRegistrationFile {
  name: string;
  description: string;
  agentAddress: `0x${string}`; // 这个 Agent 实际操作用的 EOA/Smart Account 地址
  endpoints: { protocol: string; url: string }[];
  trustModels: string[]; // 比如 ["reputation", "tee-attestation"]
}

class SimulatedIdentityRegistry {
  private nextTokenId = 1n;
  private owners = new Map<bigint, `0x${string}`>();
  private tokenURIs = new Map<bigint, AgentRegistrationFile>();

  // 对应 ERC-8004 的 register()：owner 是这个 Agent 身份 NFT 的持有者
  register(owner: `0x${string}`, registrationFile: AgentRegistrationFile): bigint {
    const tokenId = this.nextTokenId++;
    this.owners.set(tokenId, owner);
    this.tokenURIs.set(tokenId, registrationFile);
    return tokenId;
  }

  ownerOf(tokenId: bigint): `0x${string}` | undefined {
    return this.owners.get(tokenId);
  }

  tokenURI(tokenId: bigint): AgentRegistrationFile | undefined {
    return this.tokenURIs.get(tokenId);
  }
}

async function main() {
  const registry = new SimulatedIdentityRegistry();

  // Agent 的操作身份：还是我们在第一步生成的那种 EOA
  const agentPrivateKey = generatePrivateKey();
  const agentAccount = privateKeyToAccount(agentPrivateKey);

  // 1. 注册：给 Agent 铸造一个身份 NFT，tokenURI 指向注册文件
  //    这份注册文件的结构故意设计得像 A2A 的 Agent Card ——
  //    ERC-8004 的价值就是给这类 Card 一个链上可验证的锚点
  const registrationFile: AgentRegistrationFile = {
    name: "Note Agent",
    description: "agent-lab 里的示例 Agent，现在多了一个链上可验证的身份",
    agentAddress: agentAccount.address,
    endpoints: [{ protocol: "A2A", url: "http://localhost:41241/" }],
    trustModels: ["reputation"],
  };

  const tokenId = registry.register(agentAccount.address, registrationFile);
  console.log("[register] 注册成功，tokenId:", tokenId.toString());

  // 2. 查询：任何人都能通过 tokenId 查到这个 Agent 的注册文件（公开信息）
  const fetchedFile = registry.tokenURI(tokenId);
  console.log("[lookup] tokenURI 内容:", JSON.stringify(fetchedFile, null, 2));

  // 3. 验证归属：光看 tokenURI 不够，还要证明"控制这个 tokenId 的确实是
  //    agentAddress 背后的私钥持有者"——这一步复用第一步学的 EOA 签名
  const owner = registry.ownerOf(tokenId);
  const challenge = `我拥有 ERC-8004 tokenId=${tokenId}，用于证明身份`;
  const proofSignature = await agentAccount.signMessage({ message: challenge });

  const isOwnerValid = owner === agentAccount.address;
  const isProofValid = await verifyMessage({
    address: owner!,
    message: challenge,
    signature: proofSignature,
  });

  console.log("\n[verify] owner 记录是否匹配:", isOwnerValid);
  console.log("[verify] 签名是否证明了私钥持有权:", isProofValid);
  console.log(
    isOwnerValid && isProofValid
      ? "✅ 完整闭环：链上记录的 owner + 链下签名证明，两者一致，身份可信"
      : "❌ 验证失败",
  );

  console.log("\n[结论] ERC-8004 能保证的是：tokenId 对应的注册文件没被篡改、owner 是谁记录在案。");
  console.log("它不能保证 registrationFile 里声称的能力是真实有效的——那是 Reputation/Validation Registry 要解决的问题。");
}

main();
