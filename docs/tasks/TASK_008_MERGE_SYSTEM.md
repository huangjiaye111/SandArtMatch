# TASK 008: Merge System

## 目标

实现三同色桶合成规则，MVP 默认不要求相邻，并允许不同容量参与合成。

## 前置任务

- `TASK_006_BUCKET_DOMAIN.md`
- `TASK_007_CONVEYOR.md`

## 实现范围

- 查找可合成的三个同色桶。
- 明确超过三个同色桶时的优先级。
- 定义合成后桶的容量、填充量和状态的 MVP 临时规则。
- 支持在 settlement loop 中被调用。

## 明确不做的内容

- 不实现合成动画。
- 不实现特殊桶合成。
- 不要求相邻。
- 不实现 UI 提示。

## 参考文档

- `docs/gameplay/CORE_RULES.md`
- `docs/gameplay/BATTLE_STATE_MACHINE.md`
- `docs/technical/DATA_SCHEMA.md`

## 建议文件

- `assets/scripts/domain/bucket/Merge.ts`
- `assets/scripts/domain/bucket/Bucket.ts`
- `assets/scripts/domain/bucket/Conveyor.ts`
- `tests/domain/Merge.test.ts`

## 验收条件

- 三个同色桶可合成。
- 三个容量不同的同色桶可合成。
- 不相邻同色桶可合成。
- 不足三个或颜色不同不会合成。
- 合成结果可被快照和 Undo 恢复。

## 测试要求

- 单元测试覆盖正常合成、不同容量、不相邻、不足三个、超过三个的优先级。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止把相邻作为 MVP 默认要求。
- 禁止在 domain 中触发动画。
- 禁止引入未冻结的特殊桶规则。
