import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";

// 1. 生成一对密钥，代表一个 Agent 的身份（EOA：外部拥有账户）
//    私钥是一个随机的 256 位数字，地址是从公钥推导出来的、公开可见的"身份"
const agentPrivateKey = generatePrivateKey();
const agentAccount = privateKeyToAccount(agentPrivateKey);

console.log("[identity] agent private key (绝对保密，仅用于本地 Demo):", agentPrivateKey);
console.log("[identity] agent address (这是 Agent 对外的身份):", agentAccount.address);

// 2. 用私钥签名一段消息，证明"这个地址的持有者认可了这句话"
//    注意：签名不需要暴露私钥，任何人都能用公开的地址+签名去验证，但只有私钥持有者能生成签名
const message = "我是 Agent Passport Demo，这是我的第一次签名";
const signature = await agentAccount.signMessage({ message });

console.log("\n[sign] message:", message);
console.log("[sign] signature:", signature);

// 3. 验证签名：任何第三方都可以只用 (地址 + 消息 + 签名) 来验证，不需要私钥
const isValid = await verifyMessage({
  address: agentAccount.address,
  message,
  signature,
});

console.log("\n[verify] 签名是否有效:", isValid);

// 4. 篡改消息后再验证一次，应该失败——证明签名和内容是绑定的
const tamperedMessage = message + "（被篡改）";
const isTamperedValid = await verifyMessage({
  address: agentAccount.address,
  message: tamperedMessage,
  signature,
});

console.log("[verify] 篡改后消息的签名是否仍然有效:", isTamperedValid, "(应为 false)");
