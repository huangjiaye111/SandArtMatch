# TASK 002: Seeded Random

## 目标

建立纯 TypeScript 的确定性随机模块，供玩法逻辑复现同一 seed 和动作历史下的结果。

## 前置任务

- `TASK_001_PROJECT_AUDIT.md`

## 实现范围

- 创建可序列化、可恢复的 seeded random 状态。
- 提供基础随机 API，例如整数区间、浮点值、选择索引。
- 支持 snapshot/restore，供 Undo 使用。
- 在 gameplay domain 中禁止使用 `Math.random()`。

## 明确不做的内容

- 不接入 Cocos。
- 不做关卡加载。
- 不实现沙粒重力或玩法规则。
- 不添加生产依赖。

## 参考文档

- `docs/DECISIONS.txt`
- `docs/gameplay/CORE_RULES.md`
- `docs/technical/ARCHITECTURE.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`

## 建议文件

- `assets/scripts/domain/core/Random.ts`
- `tests/domain/Random.test.ts`
- 必要时：`assets/scripts/domain/index.ts`
- 必要时：测试脚本配置文件或 `package.json` 中的测试命令。

## 验收条件

- 相同 seed 生成完全相同的序列。
- 不同 seed 通常生成不同序列。
- snapshot 后继续生成、restore 后再次生成，结果一致。
- domain 目录内没有 `Math.random()`。

## 测试要求

- 单元测试覆盖 determinism、snapshot/restore、边界区间。
- 增加搜索检查或测试，确保 gameplay domain 不调用 `Math.random()`。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止 import `cc`。
- 禁止依赖系统时间作为玩法随机源。
- 禁止使用 `Math.random()`。
- 禁止把随机状态藏在不可序列化对象中。
