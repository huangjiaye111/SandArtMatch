# TASK 005: Exposed Sand

## 目标

实现暴露沙粒检测，确保桶只吸收暴露且同色的逻辑沙粒。

## 前置任务

- `TASK_003_SAND_GRID.md`

## 实现范围

- 定义 MVP 暴露算法。
- 建议首版采用底部空气连通检测，后续可替换。
- 提供查询暴露坐标和按颜色筛选的能力。
- 明确检测结果是计算值还是缓存值。

## 明确不做的内容

- 不实现吸沙调度。
- 不实现桶容量。
- 不实现视觉高亮。
- 不冻结后续关卡设计的最终暴露算法。

## 参考文档

- `docs/gameplay/CORE_RULES.md`
- `docs/technical/DATA_SCHEMA.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`

## 建议文件

- `assets/scripts/domain/core/Exposure.ts`
- `assets/scripts/domain/core/SandGrid.ts`
- `tests/domain/Exposure.test.ts`

## 验收条件

- 只返回当前可吸收的沙粒。
- 可按 colorId 过滤暴露沙粒。
- 空格、封闭区域、边界区域行为有明确测试。
- 结果不依赖 Cocos 场景。

## 测试要求

- 单元测试覆盖底部连通、被遮挡沙粒、多颜色筛选。
- 至少包含一个手写小网格 fixture。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止把视觉可见性等同于逻辑暴露。
- 禁止在检测中读取 Sprite、Node、坐标变换。
- 禁止使用不可复现随机。
