# TASK 003: Sand Grid

## 目标

实现纯 TypeScript 二维逻辑沙粒网格，为暴露检测、重力、吸沙和胜负判断提供基础。

## 前置任务

- `TASK_001_PROJECT_AUDIT.md`

## 实现范围

- 定义网格尺寸、坐标、颜色 id、空格表示。
- 支持读取、写入、清除、统计沙粒。
- 支持从测试配置创建网格。
- 支持深拷贝或序列化快照。

## 明确不做的内容

- 不实现重力。
- 不实现暴露检测。
- 不实现 Cocos 可视化。
- 不创建真实美术资源。

## 参考文档

- `docs/gameplay/CORE_RULES.md`
- `docs/technical/DATA_SCHEMA.md`
- `docs/technical/ARCHITECTURE.md`

## 建议文件

- `assets/scripts/domain/core/SandGrid.ts`
- `assets/scripts/domain/config/LevelConfig.ts`
- `tests/domain/SandGrid.test.ts`

## 验收条件

- 网格是二维逻辑结构。
- 能稳定表示有沙和空格。
- 越界访问行为明确并有测试。
- 清空所有沙粒后可被胜利判断使用。
- 不依赖 Cocos Node 或 Component。

## 测试要求

- 单元测试覆盖创建、读写、清除、统计、克隆。
- 测试至少包含多颜色网格和空网格。

## Cocos编辑器人工操作

- 无。

## 禁止事项

- 禁止 import `cc`。
- 禁止把视觉粒子当作逻辑沙粒。
- 禁止在网格逻辑中访问场景节点。
- 禁止提前绑定具体渲染方案。
