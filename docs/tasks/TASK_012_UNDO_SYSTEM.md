# TASK 012: Undo System

## 目标

实现 Undo，恢复沙粒、桶、传送带、battle phase 和随机状态。

## 前置任务

- `TASK_002_SEEDED_RANDOM.md`
- `TASK_010_BATTLE_STATE_MACHINE.md`
- `TASK_011_DEADLOCK_DETECTOR.md`

## 实现范围

- 定义 battle snapshot。
- 在玩家动作前保存稳定快照。
- 实现 undo action 并通过状态机路由。
- 恢复 random state、grid、bucket、conveyor、outcome。

## 明确不做的内容

- 不实现多步 UI 动画回放。
- 不实现付费撤回。
- 不实现撤回次数经济。
- 不恢复 Cocos 临时动画状态。

## 参考文档

- `docs/gameplay/CORE_RULES.md`
- `docs/gameplay/BATTLE_STATE_MACHINE.md`
- `docs/technical/DATA_SCHEMA.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`

## 建议文件

- `assets/scripts/domain/battle/UndoStack.ts`
- `assets/scripts/domain/battle/BattleState.ts`
- `assets/scripts/domain/battle/BattleStateMachine.ts`
- `tests/domain/Undo.test.ts`

## 验收条件

- Undo 经由 `BattleStateMachine`。
- Undo 后沙粒、桶、传送带完全恢复。
- Undo 后 random state 完全恢复。
- Undo 后继续执行同一动作，结果与第一次一致。

## 测试要求

- 集成测试覆盖一次撤回和连续撤回。
- 测试撤回后 determinism。
- 测试无历史时 undo 行为。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止只恢复 UI 而不恢复 core state。
- 禁止遗漏 random state。
- 禁止 UI 直接改 history。
- 禁止把 snapshot 做成 Cocos 对象。
