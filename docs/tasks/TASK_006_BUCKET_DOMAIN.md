# TASK 006: Bucket Domain

## 目标

实现纯 TypeScript 沙桶状态模型，包括颜色、容量、当前填充量和状态流转。

## 前置任务

- `TASK_003_SAND_GRID.md`

## 实现范围

- 定义 `BucketState`。
- 支持创建桶、填充桶、判断满桶。
- 支持桶状态：待选、传送带中、已满离场等。
- 支持快照复制。

## 明确不做的内容

- 不实现传送带槽位。
- 不实现三桶合成。
- 不实现 Cocos 桶按钮。
- 不实现特殊桶。

## 参考文档

- `docs/gameplay/CORE_RULES.md`
- `docs/technical/DATA_SCHEMA.md`
- `docs/product/GAME_DESIGN.md`

## 建议文件

- `assets/scripts/domain/bucket/Bucket.ts`
- `tests/domain/Bucket.test.ts`

## 验收条件

- 桶有 colorId、capacity、amount。
- 填充不能超过容量，或超过行为明确。
- 满桶判断稳定。
- 不同容量桶可被后续 merge 系统使用。

## 测试要求

- 单元测试覆盖创建、填充、满桶、复制。
- 测试不同容量和不同颜色。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止包含 Cocos 组件引用。
- 禁止实现特殊桶。
- 禁止让 UI 直接修改桶对象而绕过状态机。
