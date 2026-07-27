# TASK 010: Battle State Machine

## 目标

实现 `BattleStateMachine`，统一接收玩家动作，协调 core domain 结算，并向 UI 暴露稳定 view state。

## 前置任务

- `TASK_008_MERGE_SYSTEM.md`
- `TASK_009_ABSORB_SCHEDULER.md`

## 实现范围

- 定义 battle phase、action、result、view snapshot。
- 实现 bucket click action。
- 实现 settlement loop：入槽、合成、吸沙、重力、满桶离场、结果检查。
- 为 Undo、死局、关卡加载预留接口。

## 明确不做的内容

- 不实现 Cocos UI。
- 不实现真实动画时序。
- 不实现道具、提示、广告额外槽。
- 不实现非战斗页面。

## 参考文档

- `docs/gameplay/BATTLE_STATE_MACHINE.md`
- `docs/gameplay/CORE_RULES.md`
- `docs/technical/ARCHITECTURE.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`

## 建议文件

- `assets/scripts/domain/battle/BattleState.ts`
- `assets/scripts/domain/battle/BattleStateMachine.ts`
- `assets/scripts/domain/battle/Settlement.ts`
- `assets/scripts/domain/battle/Outcome.ts`
- `tests/domain/BattleStateMachine.test.ts`

## 验收条件

- 桶点击必须通过状态机。
- UI 可通过快照读取状态，无需直接改 domain。
- 结算完成后再检查胜负或死局。
- 满槽不会被状态机立即判失败。
- phase 命名和转移有测试覆盖。

## 测试要求

- 集成测试覆盖点击桶后的完整稳定结算。
- 测试非法动作、满槽动作、胜利动作序列。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止 UI 组件直接修改 battle state。
- 禁止在状态机中 import `cc`。
- 禁止把动画时间作为核心结算前提。
- 禁止实现 MVP 外道具系统。
