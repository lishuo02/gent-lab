# X 推文串草稿

用法：每个 `---` 之间是一条独立推文，按顺序发成一个 thread。字数已尽量控制在单条推文长度内，@ 手册自己判断要不要发中文/英文版。

---

## Thread 1：Agent Loop / Tool Calling / MCP / A2A 总结

（1/8）
开始写 AI Agent 相关代码快一个月了。这条帖子记录一下怎么从零跑通 4 个最小 Demo：Agent Loop、Tool Calling、MCP、A2A。全部代码在 agent-lab 仓库，开源。

（2/8）
先说 Agent Loop：Agent 和普通问答的区别就在于有没有这个循环——
思考 → 判断要不要调工具 → 执行 → 结果喂回去 → 再思考 → 循环直到给出最终答案。

Agent 的"记忆"没那么玄乎，最简单的形式就是不断增长的消息数组。

（3/8）
Tool Calling 这一步我给模型准备了 3 个工具：列目录、读文件、关键词搜索。

有意思的是，面对"这个目录下有什么笔记？找到讲 MCP 的那篇总结一下"这种问题，模型自己规划出了两步：先列目录再读文件——这个规划完全是模型自主完成的，代码里没写任何顺序逻辑。

（4/8）
MCP（Model Context Protocol）解决的问题不一样：前两步的工具都是同进程里硬编码的函数，MCP 让工具可以运行在完全独立的进程里，通过标准协议被动态发现。

我写了一个真的独立 MCP Server 子进程，Client 先问它"你有哪些工具"（tools/list），再跨进程调用（tools/call）。

（5/8）
A2A（Agent-to-Agent）解决的是更高一层的问题："Agent 怎么找到并使用另一个 Agent"，而不是"怎么用工具"。

关键概念是 Agent Card——一份描述 Agent 有什么技能的"名片"，放在固定路径 /.well-known/agent-card.json，其他 Agent 靠它发现你。

（6/8）
拼起来看会发现一条主线：
Agent Loop 关心"一个 Agent 内部怎么循环"
Tool Calling 关心"怎么在多个能力里选"
MCP 关心"工具能力怎么被标准化发现"
A2A 关心"整个 Agent 怎么被标准化发现"

从内部循环到工具标准化到 Agent 标准化，粒度在不断放大。

（7/8）
踩的坑基本都不是"协议本身"的坑，而是工程兼容性坑：无参数工具导致 JSON.parse 崩溃、第三方代理对某些模型强制走 SSE 流、代理商模型名和官方完全不是一套体系。这些细节比看懂协议是什么更耗时间。

（8/8）
代码和详细笔记都在这里：
https://github.com/lishuo02/gent-lab

10 月开始进入 Identity 阶段：ERC-8004、EIP-712、Wallet、ENS——下一个问题是"Agent 怎么证明自己是谁"。

---

## Thread 2（可选，单独发，针对更懂技术的受众）：踩坑笔记精简版

（1/4）
调试 4 个 Agent Demo 时记录的几个具体坑，可能对同样在接 LLM API / MCP SDK 的人有用：

（2/4）
1️⃣ 模型对零参数工具（比如 list_files）返回的 arguments 是空字符串 ""，不是 "{}"。直接 JSON.parse("") 会崩，调用前要判空。

2️⃣ 某些 OpenAI 兼容代理对特定模型（如 claude 系列）会强制走 SSE 流返回，即使没传 stream:true。响应结构对不上时，先打印原始返回再排查，别急着改业务逻辑。

（3/4）
3️⃣ 代理商的模型名是重新包装过的（比如 gpt-5.6-sol），而且不同模型家族可能要在后台单独给 key 开对应"渠道"权限，跟官方文档的模型体系是两套东西。

4️⃣ Node 22 的 --experimental-strip-types 可以直接跑 .ts 文件，MCP client 拉起 server 子进程时不需要额外装 ts-node 或预编译。

（4/4）
完整笔记：
https://github.com/lishuo02/gent-lab/blob/main/docs/articles/2026-09-debugging-notes.md
