# TASK 007: Conveyor

## 目标

实现纯 TypeScript 传送带槽位逻辑，支持桶进入、占槽、离场释放和默认 6 槽。

## 前置任务

- `TASK_006_BUCKET_DOMAIN.md`

## 实现范围

- 定义 `ConveyorState`。
- 默认容量为 6。
- 支持寻找空槽、放入桶、移出桶。
- 明确满槽时的动作结果。

## 明确不做的内容

- 不实现失败判定。
- 不实现吸沙。
- 不实现动画或位移。
- 不实现临时额外槽。

## 参考文档

- `docs/DECISIONS.txt`
- `docs/gameplay/CORE_RULES.md`
- `docs/technical/DATA_SCHEMA.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`

## 建议文件

- `assets/scripts/domain/bucket/Conveyor.ts`
- `assets/scripts/domain/bucket/Bucket.ts`
- `tests/domain/Conveyor.test.ts`

## 验收条件

- 默认传送带容量是 6。
- 桶进入后占用一个槽位。
- 桶离场后释放槽位。
- 满槽不触发立即失败，只返回无法进入或等待结算的状态。

## 测试要求

- 单元测试覆盖空槽、满槽、移除、顺序。
- 测试满槽不等于失败。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止在传送带逻辑中做死局判断。
- 禁止写入 Cocos 节点位置。
- 禁止改变默认 6 槽规则。
