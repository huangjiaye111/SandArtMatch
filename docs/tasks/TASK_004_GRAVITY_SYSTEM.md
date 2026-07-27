# TASK 004: Gravity System

## 目标

实现确定性沙粒重力结算，让逻辑沙粒在网格中按规则下落并稳定。

## 前置任务

- `TASK_002_SEEDED_RANDOM.md`
- `TASK_003_SAND_GRID.md`

## 实现范围

- 实现单步或多步 gravity settle。
- 支持每次结算的步数预算。
- 明确垂直下落和可选斜向下落的优先级。
- 如使用随机 tie-breaker，必须使用 seeded random。

## 明确不做的内容

- 不实现吸沙。
- 不实现暴露检测。
- 不实现动画。
- 不实现性能优化版本。

## 参考文档

- `docs/gameplay/CORE_RULES.md`
- `docs/planning/MVP_ROADMAP.md`
- `docs/technical/PERFORMANCE.md`

## 建议文件

- `assets/scripts/domain/core/Gravity.ts`
- `assets/scripts/domain/core/Random.ts`
- `assets/scripts/domain/core/SandGrid.ts`
- `tests/domain/Gravity.test.ts`

## 验收条件

- 同一输入、同一 seed、同一配置得到同一输出。
- 沙粒不会消失或凭空增加。
- 空网格、满网格、边界列行为稳定。
- 结算步数预算生效。

## 测试要求

- 单元测试覆盖垂直下落、阻挡、边界、稳定状态。
- 确认重复运行结果完全一致。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止使用 `Math.random()`。
- 禁止依赖帧率或真实时间。
- 禁止在 gravity 中操作 Cocos 节点。
- 禁止改变已冻结玩法规则。
