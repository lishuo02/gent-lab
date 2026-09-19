import { type Account, type Address, verifyTypedData } from "viem";

// Agent Passport v0.1
//
// 把本月学的五个概念串成一条完整的身份闭环：
// 1. EOA（第 01 步）—— Agent 的操作身份，能签名证明自己
// 2. EIP-712（第 02 步）—— Passport 本身就是一份结构化、可读、防篡改的签名声明
// 3. EIP-1271（第 03 步）—— 验证逻辑设计成"问持有者账户"，为将来换成
//    Smart Account（多签/策略钱包）预留空间，而不是写死只支持 EOA
// 4. ERC-8004（第 04 步）—— tokenId + registrationFile 的注册表模式
// 5. ENS（第 05 步）—— 可选挂载一个人类可读的名字
//
// 这是 v0.1：核心闭环打通，还没有接入真实链上合约（那是后面 Wallet 阶段的事）。

export const PASSPORT_DOMAIN = {
  name: "AgentPassport",
  version: "1",
} as const;

export const PASSPORT_TYPES = {
  AgentPassport: [
    { name: "tokenId", type: "uint256" },
    { name: "agent", type: "address" },
    { name: "name", type: "string" },
    { name: "capabilities", type: "string[]" },
    { name: "issuedAt", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

export interface PassportClaims {
  tokenId: bigint;
  agent: Address;
  name: string;
  capabilities: string[];
  issuedAt: bigint;
  expiresAt: bigint;
}

export interface SignedPassport {
  claims: PassportClaims;
  signature: `0x${string}`;
  ensName?: string;
}

/** 内存态的 Identity Registry：注册 Agent，分配 tokenId，记录 owner。 */
export class IdentityRegistry {
  private nextTokenId = 1n;
  private owners = new Map<bigint, Address>();

  register(owner: Address): bigint {
    const tokenId = this.nextTokenId++;
    this.owners.set(tokenId, owner);
    return tokenId;
  }

  ownerOf(tokenId: bigint): Address | undefined {
    return this.owners.get(tokenId);
  }
}

/**
 * 签发一份 Agent Passport：
 * - 先在 Registry 里注册拿到 tokenId（对应 ERC-8004 Identity Registry）
 * - 再用 EIP-712 结构化签名，把 tokenId、能力列表、有效期都签进去
 */
export async function issuePassport(
  registry: IdentityRegistry,
  account: Account,
  name: string,
  capabilities: string[],
  validForSeconds: number,
  ensName?: string,
): Promise<SignedPassport> {
  if (!account.signTypedData) {
    throw new Error("account 必须支持 signTypedData");
  }

  const tokenId = registry.register(account.address);
  const issuedAt = BigInt(Math.floor(Date.now() / 1000));
  const expiresAt = issuedAt + BigInt(validForSeconds);

  const claims: PassportClaims = {
    tokenId,
    agent: account.address,
    name,
    capabilities,
    issuedAt,
    expiresAt,
  };

  const signature = await account.signTypedData({
    domain: PASSPORT_DOMAIN,
    types: PASSPORT_TYPES,
    primaryType: "AgentPassport",
    message: claims,
  });

  return { claims, signature, ensName };
}

export type PassportVerificationResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * 验证一份 Agent Passport：
 * 1. Registry 里记录的 owner 必须和声明的 agent 地址一致（防止伪造 tokenId 归属）
 * 2. EIP-712 签名必须验证通过（防止内容被篡改或签名不是这个地址签的）
 * 3. 没有过期
 *
 * 注意：verifyTypedData 内部走的是 EOA 的 ecrecover 验证；如果 agent 是
 * Smart Account，这里应该换成调用 isValidSignature（第 03 步演示过的逻辑）——
 * 这是 v0.1 特意保留的扩展点，对应 EIP-1271。
 */
export async function verifyPassport(
  registry: IdentityRegistry,
  passport: SignedPassport,
): Promise<PassportVerificationResult> {
  const { claims, signature } = passport;

  const owner = registry.ownerOf(claims.tokenId);
  if (owner !== claims.agent) {
    return { valid: false, reason: "tokenId 的链上 owner 与声明的 agent 地址不一致" };
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now > claims.expiresAt) {
    return { valid: false, reason: "Passport 已过期" };
  }

  const signatureValid = await verifyTypedData({
    address: claims.agent,
    domain: PASSPORT_DOMAIN,
    types: PASSPORT_TYPES,
    primaryType: "AgentPassport",
    message: claims,
    signature,
  });
  if (!signatureValid) {
    return { valid: false, reason: "EIP-712 签名验证失败（内容被篡改或签名无效）" };
  }

  return { valid: true };
}
