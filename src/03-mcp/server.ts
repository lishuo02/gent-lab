import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = new McpServer({ name: "agent-lab-mcp-server", version: "0.1.0" });

server.registerTool(
  "list_notes",
  {
    description: "列出 agent-lab/src/03-mcp 目录下的笔记文件",
    inputSchema: {},
  },
  async () => {
    const entries = await fs.readdir(__dirname);
    const notes = entries.filter((f) => f.endsWith(".txt"));
    return { content: [{ type: "text", text: notes.join("\n") }] };
  },
);

server.registerTool(
  "read_note",
  {
    description: "读取指定笔记文件的内容",
    inputSchema: {
      filename: z.string().describe("文件名，例如 note-what-is-mcp.txt"),
    },
  },
  async ({ filename }) => {
    const resolved = path.resolve(__dirname, filename);
    if (!resolved.startsWith(__dirname)) {
      return { content: [{ type: "text", text: "拒绝访问：超出目录范围" }], isError: true };
    }
    try {
      const text = await fs.readFile(resolved, "utf-8");
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return { content: [{ type: "text", text: `读取失败：${(err as Error).message}` }], isError: true };
    }
  },
);

server.registerTool(
  "server_time",
  {
    description: "返回 MCP Server 进程当前的时间戳",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: new Date().toISOString() }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
