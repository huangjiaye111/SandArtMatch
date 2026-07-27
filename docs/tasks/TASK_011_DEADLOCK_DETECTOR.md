# TASK 011: Deadlock Detector

## 目标

实现 MVP 死局检测，并确保死局只在吸沙、重力、合成、满桶离场完成后检查。

## 前置任务

- `TASK_010_BATTLE_STATE_MACHINE.md`

## 实现范围

- 定义 MVP 死局 predicate。
- 集成到 battle outcome 检查。
- 明确满传送带与死局的区别。
- 输出失败原因供 UI 展示。

## 明确不做的内容

- 不实现复杂提示系统。
- 不实现自动解法搜索。
- 不实现特殊桶或额外槽影响。
- 不实现失败弹窗 UI。

## 参考文档

- `docs/gameplay/CORE_RULES.md`
- `docs/gameplay/BATTLE_STATE_MACHINE.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`

## 建议文件

- `assets/scripts/domain/battle/Outcome.ts`
- `assets/scripts/domain/battle/BattleStateMachine.ts`
- `tests/domain/DeadlockDetector.test.ts`

## 验收条件

- 满槽本身不立即失败。
- 只有结算稳定后才判断死局。
- 有可继续吸收、可合成、可离场时不判死局。
- 无可用动作且无法推进时判死局。

## 测试要求

- 单元或集成测试覆盖满槽非死局、稳定后死局、可合成非死局、胜利优先于死局。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止在点击瞬间直接失败。
- 禁止把 UI 按钮可点击性作为死局依据。
- 禁止引用 Cocos 节点状态。
