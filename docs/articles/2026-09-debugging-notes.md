# 踩坑笔记：跑通 4 个 Agent Demo 时遇到的坑

配合 [《从零跑通 Agent Loop、Tool Calling、MCP、A2A》](./2026-09-agent-loop-tool-calling-mcp-a2a.md) 一起看。这篇只记录实际调试中卡住的地方，以及怎么定位和解决的，方便以后遇到同类问题直接查。

## 坑 1：无参数工具导致 `JSON.parse` 崩溃

**现象**：调用 `list_files`（一个不需要任何参数的工具）时，`JSON.parse(toolCall.function.arguments)` 抛出 `SyntaxError: Unexpected end of JSON input`。

**原因**：模型对无参数工具返回的 `arguments` 是空字符串 `""`，而不是 `"{}"`。`JSON.parse("")` 必然报错。

**解决**：调用前判断一下空字符串：

```ts
const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
```

这个坑在 `01-basic` 和 `02-tool-calling` 里都出现过——只要工具集里有一个零参数工具，就一定会踩到，属于写 Tool Calling 代码时应该默认加的防御。

## 坑 2：第三方代理对某些模型强制走 SSE 流，即使没传 `stream: true`

**现象**：用 OpenAI SDK 调 `chat.completions.create()`（非流式），换成 `claude-sonnet-5` 模型后报错：

```
TypeError: Cannot read properties of undefined (reading '0')
```

**排查过程**：先怀疑是 SDK 类型问题，直接打印原始响应发现问题所在——返回的不是一个 JSON 对象，而是一整段 SSE 格式的文本（`data: {...}\n\ndata: {...}\n\n`），SDK 按非流式解析所以拿到的 `response.choices` 是 `undefined`。

**根因**：这个第三方代理服务对某些模型（比如 claude 系列）内部会强制转成流式返回，不管请求方有没有传 `stream: true`。

**解决**：干脆统一走流式接口，用 SDK 自带的 helper 把 chunk 自动拼接成完整消息：

```ts
const stream = client.chat.completions.stream({ model, messages, tools });
const response = await stream.finalChatCompletion();
```

**教训**：调用第三方 OpenAI 兼容代理时，不要假设它对所有模型的行为都和官方 API 一致——尤其是流式/非流式这种底层传输细节，遇到奇怪的响应结构先打印原始返回再排查，别急着改业务逻辑。

## 坑 3：代理商的模型名是"重命名"过的，且不同渠道要分别开启

**现象**：`model: "gpt-4o-mini"` 直接报错 "模型配置不存在"；换成官方 `claude-sonnet-5` 又报错 "仅支持 AWS-Q 渠道，请将秘钥的 Claude 渠道设置为 AWS-Q"。

**原因**：这类中转/代理服务通常会把上游模型重新包装、改名（比如 `gpt-5.6-sol`），而且不同模型家族可能需要在后台单独给这个 API Key 开启对应的"渠道"权限，跟官方文档里的模型命名和权限模型完全不是一回事。

**解决**：没有捷径，只能去代理服务后台的文档/控制面板查它自己支持的模型名单，以及这个 key 对应渠道有没有开对。代码层面只是把模型名做成环境变量可配置（`OPENAI_MODEL`），方便切换测试，而不是硬编码。

## 坑 4：MCP 客户端要用 `--experimental-strip-types` 直接跑 `.ts` 子进程

**现象**：`StdioClientTransport` 需要指定一个 `command` 去启动 MCP Server 子进程，如果直接写 `command: "node", args: ["server.ts"]`，Node 无法识别 TypeScript 语法。

**解决**：用 Node 22 自带的实验性 TS 支持，`args: ["--experimental-strip-types", serverPath]`，不需要额外装 `ts-node` 或者先编译成 `.js`。

**教训**：Node 22 之后原生 TS 支持已经能覆盖很多轻量场景，不是所有项目都需要引入完整的编译工具链。

## 坑 5：网络间歇性连不上 `github.com:443`（但 `api.github.com` 能通）

**现象**：`git push` 报 `Failed to connect to github.com port 443`，但同时 `curl https://api.github.com` 返回 200。

**排查**：`ping github.com` 是通的（说明 DNS 解析和基础网络层没问题），但 443 端口的 HTTPS 连接经常超时，过一会儿又能连上——是间歇性的网络波动，不是本地代理配置或者 GitHub token 权限问题。

**处理方式**：本地先正常 commit，网络恢复后再统一 push，不用为了这种间歇性问题去折腾代理设置。

## 小结

这次踩的坑基本都不是"Agent 知识"本身的坑，而是"接第三方服务时的兼容性坑"：无参数工具的边界情况、代理商和官方 API 的差异、Node 原生跑 TS、网络的不稳定性。这提醒我一件事——手册里说"每学一个技术必须留下可运行 Demo"，这些工程细节往往比"看懂协议是什么"更耗时间，也更值得记录下来。
