# TASK 001: Project Audit

## 目标

确认当前 Cocos Creator 工程、文档约束、目录现状和后续任务入口，形成实现前基线。

## 前置任务

- 无。

## 实现范围

- 阅读 `AGENTS.txt`、`docs/DECISIONS.txt`、`docs/INDEX.md` 和相关玩法、技术、测试文档。
- 检查 Cocos Creator 版本、设计分辨率、现有 `assets` 结构、场景文件和 `package.json`。
- 确认 `assets/scripts`、`tests`、`docs/tasks` 等目录是否存在。
- 记录任何与文档冲突的工程状态。

## 明确不做的内容

- 不实现任何玩法代码。
- 不修改 Cocos 场景或 prefab。
- 不添加依赖。
- 不调整构建配置。

## 参考文档

- `AGENTS.txt`
- `docs/DECISIONS.txt`
- `docs/INDEX.md`
- `docs/technical/ARCHITECTURE.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`

## 建议文件

- 只读：`package.json`
- 只读：`tsconfig.json`
- 只读：`settings/v2/packages/project.json`
- 只读：`assets/scenes/*.scene`
- 可写：本任务需要的审计记录文档，如后续明确要求创建。

## 验收条件

- 明确当前工程是否为 Cocos Creator 3.8.8。
- 明确设计分辨率是否为 750 x 1334。
- 明确当前是否已有 gameplay/domain 脚本和测试目录。
- 明确哪些场景为空壳、哪些文件不应直接手写。

## 测试要求

- 无自动化测试要求。
- 需要执行只读检查命令并记录结论。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止修改 `.scene`、`.prefab`、`.meta`。
- 禁止创建玩法实现文件。
- 禁止添加 npm 依赖。
- 禁止更改冻结规则。
