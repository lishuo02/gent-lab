import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

async function main() {
  // 1. 启动 MCP Server 子进程，通过 stdio 建立连接
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--experimental-strip-types", path.resolve(__dirname, "server.ts")],
  });
  const mcpClient = new Client({ name: "agent-lab-mcp-client", version: "0.1.0" });
  await mcpClient.connect(transport);

  // 2. 通过 MCP 协议发现 Server 暴露了哪些工具（tools/list）
  const { tools: mcpTools } = await mcpClient.listTools();
  console.log(
    "[mcp] discovered tools:",
    mcpTools.map((t) => t.name).join(", "),
  );

  // 3. 把 MCP 工具描述转换成 LLM 能理解的 tool schema
  const llmTools: OpenAI.Chat.Completions.ChatCompletionTool[] = mcpTools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: tool.inputSchema as Record<string, unknown>,
    },
  }));

  const question =
    process.argv[2] ?? "现在 MCP Server 那边几点了？再看看有哪些笔记，读一下讲 MCP 是什么的那篇";
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "user", content: question },
  ];

  // Agent Loop：模型看到的是"MCP 工具"，但它不知道背后是另一个进程在跑
  while (true) {
    const stream = llm.chat.completions.stream({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-sol",
      messages,
      tools: llmTools,
    });
    const response = await stream.finalChatCompletion();
    const message = response.choices[0].message;
    messages.push(message);

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      console.log("\n[final answer]", message.content);
      break;
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") continue;
      const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
      console.log(`[tool call via MCP] ${toolCall.function.name}(${JSON.stringify(args)})`);

      // 4. 通过 MCP 协议真正调用 Server 上的工具（tools/call）
      const result = await mcpClient.callTool({ name: toolCall.function.name, arguments: args });
      const content = Array.isArray(result.content)
        ? result.content.map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c))).join("\n")
        : JSON.stringify(result.content);

      messages.push({ role: "tool", tool_call_id: toolCall.id, content });
    }
  }

  await mcpClient.close();
}

main();
