import { ClientFactory } from "@a2a-js/sdk/client";
import { Message, Role, SendMessageResult, Task } from "@a2a-js/sdk";

async function main() {
  // 1. 发现：Client 通过 well-known agent-card.json 拿到 Agent 能力描述
  const factory = new ClientFactory();
  const client = await factory.createFromUrl("http://localhost:41241");

  const card = await client.getAgentCard();
  console.log(`[a2a] discovered agent: ${card.name} — ${card.description}`);
  console.log(`[a2a] skills: ${card.skills.map((s) => s.name).join(", ")}`);

  // 2. 连接：发一条消息给 Agent
  const question = process.argv[2] ?? "什么是 A2A？";
  const result: SendMessageResult = await client.sendMessage({
    tenant: "",
    message: {
      messageId: crypto.randomUUID(),
      role: Role.ROLE_USER,
      parts: [{ content: { $case: "text", value: question }, metadata: undefined, filename: "", mediaType: "text/plain" }],
      taskId: "",
      contextId: "",
      extensions: [],
      metadata: {},
      referenceTaskIds: [],
    },
    configuration: undefined,
    metadata: {},
  });

  // 3. 拿到结果：Server 可能直接回一条 Message，也可能回一个 Task（本 Demo 走的是前者）
  const message = "parts" in result ? (result as Message) : (result as Task).status?.message;
  const text = message?.parts.find((p) => p.content?.$case === "text")?.content?.value;
  console.log(`\n[final answer] ${text}`);
}

main();
