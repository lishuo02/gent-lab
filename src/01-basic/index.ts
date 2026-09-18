import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = __dirname;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "读取 agent-lab/src/01-basic 目录下的文本文件内容",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "文件名，例如 notes.txt",
          },
        },
        required: ["filename"],
      },
    },
  },
];

async function readFile(filename: string): Promise<string> {
  const resolved = path.resolve(BASE_DIR, filename);
  if (!resolved.startsWith(BASE_DIR)) {
    return `拒绝访问：${filename} 超出允许的目录范围`;
  }
  try {
    return await fs.readFile(resolved, "utf-8");
  } catch (err) {
    return `读取失败：${(err as Error).message}`;
  }
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === "read_file") {
    return readFile(args.filename as string);
  }
  return `未知工具：${name}`;
}

async function runAgentLoop(userInput: string) {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "user", content: userInput },
  ];

  // Agent Loop: 思考 -> (决定调用工具 -> 执行 -> 观察结果) 循环 -> 最终回答
  while (true) {
    // 这个代理对某些模型（如 claude-*）总是返回 SSE 流，即使不传 stream:true，
    // 因此统一走流式接口，用 SDK 的 helper 把 chunk 拼接成完整消息。
    const stream = client.chat.completions.stream({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-sol",
      messages,
      tools,
    });
    const response = await stream.finalChatCompletion();

    const message = response.choices[0].message;
    messages.push(message);

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return message.content;
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") continue;
      const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
      console.log(`[tool call] ${toolCall.function.name}(${toolCall.function.arguments})`);
      const result = await callTool(toolCall.function.name, args);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }
}

const question = process.argv[2] ?? "读一下 notes.txt 里写了什么，用一句话总结";
const answer = await runAgentLoop(question);
console.log("\n[final answer]", answer);
