import express from "express";
import { AgentCard, Message, Role } from "@a2a-js/sdk";
import {
  AgentExecutor,
  AgentEvent,
  DefaultRequestHandler,
  ExecutionEventBus,
  InMemoryTaskStore,
  RequestContext,
} from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";

// 09 月目标只验证 A2A 基础：Agent Card 如何描述自己、Client 如何发现、
// 消息如何通过标准协议来回——不涉及流式任务状态机（那是更完整的场景）。

const noteAgentCard: AgentCard = {
  name: "Note Agent",
  description: "一个只会回答 agent-lab 笔记相关问题的示例 A2A Agent",
  supportedInterfaces: [
    {
      url: "http://localhost:41241/",
      protocolBinding: "JSONRPC",
      tenant: "",
      protocolVersion: "1.0",
    },
  ],
  provider: { organization: "agent-lab", url: "https://github.com/lishuo02/gent-lab" },
  version: "0.1.0",
  capabilities: { streaming: false, pushNotifications: false, extensions: [], extendedAgentCard: false },
  securitySchemes: {},
  securityRequirements: [],
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  skills: [
    {
      id: "note_qa",
      name: "笔记问答",
      description: "回答关于 agent-lab 学习笔记的简单问题",
      tags: ["agent-lab", "demo"],
      examples: ["什么是 A2A？"],
      inputModes: ["text"],
      outputModes: ["text"],
      securityRequirements: [],
    },
  ],
  documentationUrl: "",
  signatures: [],
};

class NoteAgentExecutor implements AgentExecutor {
  cancelTask = async () => {};

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const userText =
      requestContext.userMessage.parts.find((p) => p.content?.$case === "text")?.content?.value ??
      "";

    const reply = this.answer(userText);

    // 最小闭环：Agent 直接回一条 Message，不走 Task 状态机
    const replyMessage: Message = {
      messageId: crypto.randomUUID(),
      role: Role.ROLE_AGENT,
      parts: [{ content: { $case: "text", value: reply }, metadata: undefined, filename: "", mediaType: "text/plain" }],
      taskId: requestContext.taskId,
      contextId: requestContext.contextId,
      extensions: [],
      metadata: {},
      referenceTaskIds: [],
    };
    eventBus.publish(AgentEvent.message(replyMessage));
  }

  private answer(question: string): string {
    if (question.includes("A2A")) {
      return "A2A（Agent-to-Agent）是让不同 Agent 之间互相发现能力、发消息、协作的标准协议。Agent Card 用来描述一个 Agent 有什么技能，Client 靠它找到并连接 Server。";
    }
    return `我只是个 A2A 基础 Demo，收到了你的消息：「${question}」`;
  }
}

async function main() {
  const taskStore = new InMemoryTaskStore();
  const agentExecutor = new NoteAgentExecutor();
  const requestHandler = new DefaultRequestHandler(noteAgentCard, taskStore, agentExecutor);

  const app = express();
  app.use("/.well-known/agent-card.json", agentCardHandler({ agentCardProvider: requestHandler }));
  app.use(jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

  const PORT = 41241;
  app.listen(PORT, () => {
    console.log(`[NoteAgent] listening on http://localhost:${PORT}`);
    console.log(`[NoteAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
  });
}

main();
