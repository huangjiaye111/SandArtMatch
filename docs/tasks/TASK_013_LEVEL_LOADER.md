# TASK 013: Level Loader

## 目标

实现 MVP 测试关卡加载，使首个可玩原型能从固定配置创建 battle 初始状态。

## 前置任务

- `TASK_010_BATTLE_STATE_MACHINE.md`
- `TASK_012_UNDO_SYSTEM.md`

## 实现范围

- 定义 LevelConfig 的实际 MVP 字段。
- 提供至少一个内置测试关卡。
- 从配置创建 grid、bucket list、conveyor、rules、seed。
- 为 Cocos 层提供加载固定关卡的入口。

## 明确不做的内容

- 不实现关卡选择页面。
- 不实现远程配置。
- 不实现关卡编辑器。
- 不实现存档进度。

## 参考文档

- `docs/technical/DATA_SCHEMA.md`
- `docs/planning/MVP_ROADMAP.md`
- `docs/product/GAME_DESIGN.md`

## 建议文件

- `assets/scripts/domain/config/LevelConfig.ts`
- `assets/scripts/domain/config/TestLevels.ts`
- `assets/scripts/domain/battle/BattleStateMachine.ts`
- `tests/domain/LevelLoader.test.ts`

## 验收条件

- 能加载一个固定测试关卡。
- 关卡包含 seed、grid、bucket、conveyor capacity、rules。
- 加载结果 deterministic。
- 测试关卡可用于 Battle UI skeleton。

## 测试要求

- 单元测试覆盖有效配置加载。
- 测试非法配置的错误处理。
- 测试同一配置多次加载结果一致。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止引入远程服务。
- 禁止把关卡配置存放在 Cocos 场景节点里作为唯一来源。
- 禁止使用 `Math.random()` 生成关卡。
