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
      name: "list_files",
      description: "列出 agent-lab/src/02-tool-calling 目录下的所有文件名",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "读取指定文件的完整内容",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "文件名，例如 notes-mcp.txt" },
        },
        required: ["filename"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_notes",
      description: "在目录下所有 .txt 文件中搜索包含某关键词的文件名，不返回文件内容",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "要搜索的关键词" },
        },
        required: ["keyword"],
      },
    },
  },
];

function resolveSafe(filename: string): string {
  const resolved = path.resolve(BASE_DIR, filename);
  if (!resolved.startsWith(BASE_DIR)) {
    throw new Error(`拒绝访问：${filename} 超出允许的目录范围`);
  }
  return resolved;
}

async function listFiles(): Promise<string> {
  const entries = await fs.readdir(BASE_DIR);
  return entries.filter((f) => !f.startsWith(".") && f !== "index.ts").join("\n");
}

async function readFile(filename: string): Promise<string> {
  try {
    return await fs.readFile(resolveSafe(filename), "utf-8");
  } catch (err) {
    return `读取失败：${(err as Error).message}`;
  }
}

async function searchNotes(keyword: string): Promise<string> {
  const entries = await fs.readdir(BASE_DIR);
  const txtFiles = entries.filter((f) => f.endsWith(".txt"));
  const matched: string[] = [];
  for (const file of txtFiles) {
    const content = await fs.readFile(path.resolve(BASE_DIR, file), "utf-8");
    if (content.includes(keyword)) matched.push(file);
  }
  return matched.length > 0 ? matched.join("\n") : "未找到匹配文件";
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "list_files":
      return listFiles();
    case "read_file":
      return readFile(args.filename as string);
    case "search_notes":
      return searchNotes(args.keyword as string);
    default:
      return `未知工具：${name}`;
  }
}

async function runAgentLoop(userInput: string) {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "user", content: userInput },
  ];

  // Agent Loop：每一轮都可能触发多个工具调用，模型自己决定要不要继续调用下一个工具
  while (true) {
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

const question =
  process.argv[2] ??
  "这个目录下有哪些笔记文件？找到讲 MCP 的那篇，告诉我它想解决什么问题";
const answer = await runAgentLoop(question);
console.log("\n[final answer]", answer);
