import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { IdentityRegistry, issuePassport, verifyPassport, type SignedPassport } from "./passport.js";

async function main() {
  const registry = new IdentityRegistry();

  const agentKey = generatePrivateKey();
  const agent = privateKeyToAccount(agentKey);

  // 1. 签发一份 Passport：注册身份 + EIP-712 签名，有效期 60 秒
  const passport = await issuePassport(
    registry,
    agent,
    "Note Agent",
    ["read_file", "list_notes", "a2a.note_qa"],
    60,
  );
  console.log("[issue] tokenId:", passport.claims.tokenId.toString());
  console.log("[issue] agent:", passport.claims.agent);
  console.log("[issue] capabilities:", passport.claims.capabilities.join(", "));
  console.log("[issue] signature:", passport.signature);

  // 2. 正常验证：应该通过
  const result1 = await verifyPassport(registry, passport);
  console.log("\n[verify] 正常 Passport:", result1);

  // 3. 篡改能力列表后再验证：EIP-712 签名会失效
  const tampered: SignedPassport = {
    ...passport,
    claims: { ...passport.claims, capabilities: [...passport.claims.capabilities, "admin_override"] },
  };
  const result2 = await verifyPassport(registry, tampered);
  console.log("[verify] 篡改能力列表后:", result2);

  // 4. 过期场景：签发一份有效期只有 0 秒的 Passport，立刻就过期
  const expiredPassport = await issuePassport(registry, agent, "Note Agent", ["read_file"], -1);
  const result3 = await verifyPassport(registry, expiredPassport);
  console.log("[verify] 已过期的 Passport:", result3);

  // 5. 伪造归属场景：换一个完全不同的地址冒充 agent 字段
  const strangerKey = generatePrivateKey();
  const stranger = privateKeyToAccount(strangerKey);
  const forgedPassport: SignedPassport = {
    ...passport,
    claims: { ...passport.claims, agent: stranger.address },
  };
  const result4 = await verifyPassport(registry, forgedPassport);
  console.log("[verify] 伪造 agent 字段冒充身份:", result4);

  console.log("\n[结论] Agent Passport v0.1 打通了：注册身份 -> 签发结构化声明 -> 验证归属+签名+有效期。");
  console.log("这是 Agent Wallet（11月）、AgentPay（12月）要复用的身份基础设施。");
}

main();
