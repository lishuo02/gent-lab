# A2A 基础 Demo

跑法（需要两个终端）：

```bash
# 终端 1：启动 A2A Server（NoteAgent，监听 41241 端口）
npm run dev:a2a:server

# 终端 2：Client 发现 Agent Card，发一条消息
npm run dev:a2a -- "什么是 A2A？"
```

验证的最小闭环：
1. **发现**：Client 通过 `GET /.well-known/agent-card.json` 拿到 Agent 的名字、描述、技能列表
2. **连接 + 发消息**：Client 用 `ClientFactory` 建立连接，`sendMessage` 走标准 JSON-RPC
3. **结果**：Server 的 `AgentExecutor.execute` 处理消息、发布一条 `message` 事件作为回复

本 Demo 只用非流式的 `sendMessage`，不涉及 Task 状态机（submitted/working/completed）和 Artifact —— 那些是 2027 Q1 深入 A2A 时才需要的部分。
