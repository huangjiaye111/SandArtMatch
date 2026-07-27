# TASK 009: Absorb Scheduler

## 目标

实现吸沙结算调度：传送带中的桶自动吸收暴露同色沙，满桶离场并释放槽位。

## 前置任务

- `TASK_004_GRAVITY_SYSTEM.md`
- `TASK_005_EXPOSED_SAND.md`
- `TASK_006_BUCKET_DOMAIN.md`
- `TASK_007_CONVEYOR.md`

## 实现范围

- 在稳定结算中调度暴露检测、吸收、清除沙粒、桶填充。
- 支持每步最大吸收数量或吸收速率配置。
- 满桶离场并释放传送带槽位。
- 输出可供 UI 展示的变化摘要或快照。

## 明确不做的内容

- 不实现状态机完整 phase。
- 不实现死局判断。
- 不实现视觉粒子。
- 不实现音效和动画。

## 参考文档

- `docs/product/GAME_DESIGN.md`
- `docs/gameplay/CORE_RULES.md`
- `docs/gameplay/BATTLE_STATE_MACHINE.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`

## 建议文件

- `assets/scripts/domain/battle/Settlement.ts`
- `assets/scripts/domain/core/Exposure.ts`
- `assets/scripts/domain/core/Gravity.ts`
- `assets/scripts/domain/bucket/Bucket.ts`
- `assets/scripts/domain/bucket/Conveyor.ts`
- `tests/domain/AbsorbScheduler.test.ts`

## 验收条件

- 桶只吸收同色暴露沙。
- 沙被吸收后从逻辑网格移除。
- 桶满后离场并释放槽位。
- 吸收后可继续触发重力。
- 整个过程 deterministic。

## 测试要求

- 单元测试覆盖单桶吸收、多桶不同颜色、容量限制、满桶离场。
- 重复运行同一 fixture 结果一致。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止在 scheduler 中访问 Cocos 节点。
- 禁止跳过暴露检测直接按颜色清空。
- 禁止在槽满时立即失败。
