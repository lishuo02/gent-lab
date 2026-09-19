# 05-identity: Agent Passport v0.1

2026 年 10 月主线：Identity（对应 [AI Agent 职业规划手册](../../README.md) 第四节 10 月计划）。

## 文件说明

| 文件 | 概念 | 说明 |
|---|---|---|
| `01-eoa-sign-verify.ts` | EOA 签名/验证 | 私钥 → 地址 → 签名 → 验证，最基础的链上身份机制 |
| `02-eip712-authorization.ts` | EIP-712 | 结构化数据签名，字段级防篡改，比签一段纯文本更安全、更可读 |
| `03-eip1271-smart-account.ts` | EIP-1271 | 模拟智能合约账户的自定义签名验证逻辑（2-of-2 多签场景） |
| `04-erc8004-identity-registry.ts` | ERC-8004 | 模拟 Identity Registry：注册 Agent、拿到 tokenId、验证归属 |
| `05-ens-resolution.ts` | ENS | 真实查询以太坊主网 ENS（不是模拟），正向/反向解析 + 文本记录 |
| `passport.ts` | 整合模块 | 把以上概念组合成可复用的 Agent Passport（签发/验证） |
| `index.ts` | Demo 入口 | 演示签发、正常验证、篡改、过期、伪造归属四种场景 |

## 跑法

```bash
# 单独跑每个概念 Demo
npx tsx src/05-identity/01-eoa-sign-verify.ts
npx tsx src/05-identity/02-eip712-authorization.ts
npx tsx src/05-identity/03-eip1271-smart-account.ts
npx tsx src/05-identity/04-erc8004-identity-registry.ts
npx tsx src/05-identity/05-ens-resolution.ts   # 需要网络，查询真实主网数据

# 跑整合后的 Agent Passport v0.1
npm run dev:identity
```

## 实现说明 / 简化点

- **EIP-1271、ERC-8004** 用内存态 TypeScript 类模拟核心行为，没有部署真实 Solidity 合约（避免引入完整的合约开发工具链）；协议逻辑（接口签名、验证流程）是按官方规范实现的，可以直接迁移到真实合约场景
- **ENS** 是唯一直接查询真实以太坊主网的部分，用公共 RPC 节点只读查询，无需私钥、无需花 Gas
- `passport.ts` 里的验证逻辑目前只支持 EOA（走 `verifyTypedData`/ecrecover）；如果 `agent` 字段将来是 Smart Account，需要换成调用 `isValidSignature`（03 步演示过的逻辑）——这是特意留出的扩展点，对应 11 月 Wallet 阶段
