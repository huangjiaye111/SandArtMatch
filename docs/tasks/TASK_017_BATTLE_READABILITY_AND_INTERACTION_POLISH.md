# TASK 017: Battle Readability And Interaction Polish

## 目标

在不修改领域规则和状态机结算顺序的前提下，将已冻结的“清爽沙画工坊 Sand Workshop”战斗视觉规范接入 TASK015/TASK016 First Playable，提升战斗可读性、按钮反馈和主要游戏状态辨识。

本任务只服务战斗内 First Playable 表现，不扩大到正式全套美术、非战斗系统或多关卡流程。

## 前置任务

- `TASK_015_FIRST_PLAYABLE.md`
- `TASK_016_FIRST_PLAYABLE_HARDENING.md`

## 参考文档

- `AGENTS.md`
- `docs/DECISIONS.md`
- `docs/INDEX.md`
- `docs/planning/MVP_ROADMAP.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`
- `docs/ui/BATTLE_LAYOUT.md`
- `docs/tasks/TASK_015_FIRST_PLAYABLE.md`
- `docs/tasks/TASK_016_FIRST_PLAYABLE_HARDENING.md`
- `docs/art/ART_DIRECTION.md`
- `docs/art/COLOR_PALETTE.md`
- `docs/art/UI_STYLE_GUIDE.md`
- `docs/art/ASSET_LIST.md`
- `docs/art/ART_DECISIONS.md`

## 背景

First Playable 已经完成固定测试关从 Battle 场景进入、点击桶、自动吸沙、重力、合成、满桶离场、Undo、胜利和死局的闭环。TASK016 聚焦稳定性、确定性、输入锁、Undo 边界、生命周期和性能基线。

TASK017 的重点是把当前“最小可玩”的表现升级为“玩家能一眼判断状态”的战斗体验：沙色清楚、桶状态清楚、传送带槽位清楚、按钮状态清楚、结果面板清楚，并为色盲辅助和非颜色状态表达建立第一版可验收标准。

## 实现范围

- 接入战斗背景和主要承托面板，使 Battle 场景从占位视觉切换到“清爽沙画工坊”基调。
- 接入沙画区域边框和基础显示层，确保沙粒、空白、完成状态在浅背景上可辨。
- 接入传送带底板、带面方向信息和默认 6 个槽位显示。
- 接入普通桶体、桶内填充显示、桶口/桶底/阴影/满桶标记。
- 接入 2 行 x 4 列桶池槽位的默认、可点击、禁用或错误反馈。
- 接入 Undo 和 Settings 按钮的 Normal、Pressed、Disabled、Selected 或等价状态。
- 接入胜利和死局结果面板，保持只在胜利或死局时阻断战斗操作。
- 接入选中、禁用、满桶、可合成、无效点击、输入锁定中的视觉反馈。
- 增加色盲辅助和非颜色状态表达：描边、符号、纹理、位置变化或短动画至少覆盖关键状态。
- 建立 750 x 1334 基线和竖屏基础适配检查，保证沙画区、6 槽传送带、2 x 4 桶池和底部按钮不重叠。
- 建立微信小游戏性能预算和人工记录要求，限制半透明叠层、粒子、Shader、节点堆积和大贴图。
- 使用 Cocos Creator 编辑器和 Funplay MCP 检查场景、Prefab 和引用，不直接手写 `.scene` 或 `.prefab`。
- 补充或调整自动测试，验证表现层状态映射不绕过 `BattleStateMachine`，并保持 domain 测试不加载 Cocos 场景。
- 补充 Cocos 人工验收清单，覆盖状态辨识、按钮反馈、竖屏适配、Console 和性能基线。

## 第一批资产

TASK017 首批资产只覆盖战斗内 P0/P1 可读性需求。命名和目录以 `docs/art/ASSET_LIST.md` 为准，允许实现时根据现有资源管线做等价命名，但必须记录映射关系。

P0 必做：

- 战斗背景底图或等价纯色/轻纹理背景。
- 操作台面或主要承托底板。
- 沙画区域边框或结果展示框基础图。
- 传送带底座。
- 传送带带面。
- 传送带方向箭头。
- 传送带槽位默认态。
- 传送带槽位可放置或选中态。
- 普通透明桶空态。
- 普通桶部分填充 Mask 或裁剪区域。
- 普通桶满态标记。
- 普通桶选中态描边。
- 普通桶禁用态覆盖。
- 桶底阴影。
- 沙层基础形。
- 沙层顶部弧线。
- 吸沙嘴默认态。
- 吸沙流短线。
- 桶池空槽默认态。
- 桶池槽位可点击或选中态。
- 主按钮或圆形图标按钮基础九宫格，至少覆盖 Undo 和 Settings 所需状态。
- 结果面板底板。
- 胜利状态标题或装饰。
- 死局状态标题或装饰。
- 选中外圈。
- 错误红描边或无效点击反馈叠层。
- 可合成暖金外圈或短连线。

P1 建议：

- 顶部状态栏底板。
- 底部按钮承托条。
- 吸沙嘴激活态。
- 吸沙路径提示。
- 深色沙顶部亮边。
- 禁用斜纹覆盖。
- 满桶小符号。
- 色盲辅助低透明纹理样张：点纹、横纹、短斜纹、细波纹。
- 按钮图标：Undo、Settings、Close 或 Retry。

## 建议 Prefab

后续实现 TASK017 时，优先通过 Cocos Creator 编辑器创建或更新 Prefab，并保留 `.meta` 和 UUID 引用。

建议 Prefab：

- `BattleBackgroundView`：背景、主要承托底板、顶部和底部轻量承托层。
- `SandArtworkFrameView`：沙画边框、沙粒显示容器、完成态基础高光。
- `ConveyorView`：传送带底座、带面、方向箭头、6 个槽位容器。
- `ConveyorSlotView`：空槽、可放置、占用、锁定、错误短闪状态。
- `BucketView`：普通桶体、填充 Mask、满桶标记、选中描边、禁用覆盖、底部阴影。
- `BucketPoolSlotView`：桶池槽位默认、可点击、禁用、错误状态。
- `ToolbarButtonView`：Undo 和 Settings 可复用按钮状态。
- `ResultPanelView`：遮罩、面板、胜利/死局状态、主按钮和次按钮。
- `InteractionFeedbackView`：无效点击、选中、可合成、吸沙路径等短时反馈。

如果当前项目已有同名或近似组件，应优先扩展现有组件和 Prefab，而不是并行创建重复体系。

## 场景修改范围

允许修改：

- `assets/scenes/Battle.scene` 中 Battle 战斗界面的视觉节点层级、Sprite 引用、Prefab 实例和状态反馈节点。
- `assets/prefabs/battle/*.prefab` 或等价战斗 Prefab。
- `assets/scripts/cocos/battle/**` 中与视觉状态绑定、按钮状态、Prefab 实例化、适配布局和反馈播放有关的表现层代码。
- `assets/scripts/cocos/**/*.ts` 中已有战斗 UI 公共组件的窄范围调整。
- `tests/domain/**` 和表现层可测试适配文件中与状态映射相关的测试。

不允许修改：

- 不修改吸沙、重力、合成、满桶离场、胜利或死局规则。
- 不修改 `BattleStateMachine` 的结算顺序，除非 TASK016 已暴露阻塞 Bug 且先更新任务说明。
- 不修改商店、签到、排行榜、每日挑战、正式广告 SDK、社交系统或多关卡流程。
- 不直接手写或批量重写 `.scene` / `.prefab` 序列化内容。
- 不为特殊桶制作完整正式美术。
- 不新增生产依赖。

## 交互状态要求

- 可点击桶：有明确点击热区、轻描边或亮度提升，不与禁用态混淆。
- 选中桶：上浮 4 到 8 px 或等价位置反馈，加天蓝外描边或选中外圈。
- 禁用桶：降低透明度或饱和度，并叠加斜纹、锁符号或等价非颜色提示。
- 满桶：桶内填充到口沿，并显示满态标记，不只依赖填充高度。
- 可合成：使用暖金短脉冲、短连线或角标提示，动画 300 到 500 ms 内。
- 无效点击：使用 80 到 180 ms 珊瑚红描边、轻微抖动或短提示，不改变 gameplay 状态。
- 输入锁定：按钮和桶进入可辨的不可操作态，不能继续触发动作。
- Undo 可用：按钮 Normal 态清楚，可点击后有 Pressed 反馈。
- Undo 不可用：按钮 Disabled 态清楚，并且点击不会调用状态机动作。
- Settings：按钮 Normal/Pressed/Disabled 至少具备两态以上反馈，打开面板不改变战斗 domain 状态。

## 色盲辅助和非颜色表达

- 沙粒颜色继续使用 `docs/art/COLOR_PALETTE.md` 推荐色系，避免功能色与沙色完全重合。
- 关键玩法状态不能只靠颜色表达，至少增加描边、图标、位置、纹理或动画中的一种。
- 色盲辅助样张应覆盖至少 4 种轻纹理，并验证不会让沙层和桶内填充变脏。
- 满桶、禁用、选中、错误、可合成必须具备非颜色辅助。
- 按钮 Pressed 和 Disabled 必须有形态差异：位移、压边、透明度、高光变化或图标变化。
- 深色沙 S09/S12 如进入测试关，必须加顶部亮边、纹理或边界辅助。

## 竖屏基础适配

- 基线分辨率保持 750 x 1334。
- 默认传送带容量保持 6 个槽位，6 个槽在主流竖屏下必须完整可见。
- 桶池保持 2 行 x 4 列，桶之间至少保留可读间距，避免误触。
- 顶部安全区、底部手势区和左右圆角区域不得遮挡主要按钮或结果面板。
- 结果面板建议宽度 600 到 660，高度 420 到 620，不能盖住系统安全区关键操作。
- 至少验证 750 x 1334、窄高屏和短屏三类竖屏尺寸。
- 若需要 Fit Width/Fit Height 策略调整，必须保持沙画区、传送带、桶池和底部工具栏四区结构。

## 微信小游戏性能约束

- 优先使用九宫格、SpriteFrame、Tint、Mask 或裁剪区域，不使用复杂 Shader。
- 不做大规模粒子；吸沙流线和完成闪点只短时播放，数量可控。
- 避免大量实时模糊阴影；圆角、阴影和高光优先预烘焙。
- 战斗常驻半透明叠层保持低数量，结果遮罩只在结果面板显示时启用。
- 普通桶和普通沙层优先复用基础纹理加运行时 Tint，不为每个容量、颜色或填充量导出独立图片。
- 纹理尺寸以 750 x 1334 基线为准，不引入超出当前战斗需求的大图集。
- 稳定战斗 draw call 参考目标低于 80，重反馈瞬间参考目标低于 120；这些阈值仍为待验证基线。
- 长时间连续操作不得出现明显节点泄漏、监听重复绑定或反馈节点堆积。
- 低性能视觉降级不得改变 gameplay domain 结果。

## Funplay MCP 与 Cocos 操作要求

- 修改场景或 Prefab 前，使用 Cocos Creator 打开并检查 `Battle.scene`。
- 可使用 Funplay MCP `get_project_info` 确认当前项目和 Cocos 版本。
- 可使用 Funplay MCP `get_scene_info` 获取 Battle 场景节点摘要，记录核心节点和组件是否存在。
- 可使用 Funplay MCP `inspect_prefab_instance` 检查关键节点是否来自 Prefab 实例，避免破坏 Prefab 链接。
- 可使用 Funplay MCP `validate_prefab_references` 检查战斗 Prefab 引用是否缺失。
- 可使用 Funplay MCP `capture_editor_screenshot` 保存编辑器截图用于人工验收记录。
- 场景和 Prefab 的结构调整必须通过 Cocos Creator 编辑器或可靠编辑器 API 完成，不直接手写 `.scene` 或 `.prefab`。
- 任何 SpriteFrame、Prefab、场景引用变化完成后，必须重新打开 Battle 场景确认引用未丢失。
- 不 regenerate 场景或 Prefab，不删除未知 `.meta` 文件，不批量替换 UUID。

## 自动测试要求

- 运行全部现有 domain 测试。
- 运行 TypeScript 检查。
- 保留并通过 `Math.random()` 禁用检查。
- 保留 TASK016 的确定性重放、Undo、死局、输入锁和异常恢复测试。
- 新增或调整表现层可测试映射，验证 UI 状态只由 state snapshot/action result 推导，不直接修改 domain。
- 新增 Undo 按钮 Disabled/Normal 映射测试，确保无历史时不可触发 Undo。
- 新增结果面板状态映射测试，确保只有胜利和死局显示结果面板。
- 新增无效点击或输入锁状态映射测试，确保反馈不改变 gameplay snapshot。
- 自动测试不得要求加载 Cocos 场景。

## Cocos 人工验收

- 打开 `Battle.scene`，确认所有 `@property`、SpriteFrame、Prefab 引用未丢失。
- 运行 Battle 场景，完成至少一次完整通关，确认胜利结果面板显示正确。
- 运行 Battle 场景，触发至少一次死局，确认死局结果面板显示正确。
- 验证 6 个传送带槽位在空、占用、可放置或错误状态下可辨。
- 验证 2 行 x 4 列桶池槽位在默认、选中、禁用和无效点击状态下可辨。
- 验证普通桶 Empty、Partial、Full、Disabled、Selected 状态可辨。
- 验证 Undo 和 Settings 的 Normal、Pressed、Disabled 或等价状态。
- 验证色盲辅助样张或非颜色表达不会遮挡沙粒颜色和容量阅读。
- 验证吸沙流线、合成提示、无效点击反馈不会长时间残留。
- 在至少三个竖屏尺寸下检查沙画区、传送带、桶池和工具栏不重叠。
- 连续快速点击桶、Undo 和 Settings，确认输入锁和按钮状态不会产生重复动作。
- 重复进入 Battle 场景，确认监听没有重复绑定，反馈节点没有堆积。
- 检查 Cocos Console，记录并处理与 Battle 场景相关的 error/warning。
- 使用 Funplay MCP 或 Cocos 可用工具记录场景摘要、Prefab 引用检查和性能基线。

## 验收条件

- First Playable 仍可从 Battle 场景开始玩到胜利或死局。
- 所有玩家动作仍通过 `BattleStateMachine`。
- 吸沙、重力、合成、满桶离场、胜利、死局和 Undo 规则未改变。
- Battle 场景呈现“清爽沙画工坊 Sand Workshop”基础视觉。
- 沙画区域、传送带、6 个槽位、2 x 4 桶池、Undo、Settings 和结果面板均完成第一版可读性接入。
- 普通桶 Empty、Partial、Full、Disabled、Selected 状态一眼可辨。
- 选中、禁用、满桶、无效点击、输入锁、可合成等反馈不只依赖颜色。
- 胜利和死局结果面板清楚阻断战斗操作，且不会引入商店、签到、广告、排行榜或多关卡入口。
- 至少三个竖屏尺寸人工验收通过，主要 UI 不重叠、不遮挡安全区。
- Cocos Console 无与 TASK017 修改直接相关的阻塞 error。
- 场景和 Prefab 引用检查无丢失引用。
- 性能基线已记录，未发现明显节点泄漏、监听泄漏或反馈节点堆积。
- `npm.cmd test` 通过。
- `npm.cmd run typecheck` 通过。

## 明确不做

- 不修改领域规则。
- 不修改状态机结算顺序。
- 不实现商店、签到、广告、排行榜、社交或多关卡。
- 不做复杂 Shader。
- 不做大规模粒子。
- 不直接手写 `.scene` 或 `.prefab`。
- 不制作特殊桶完整美术。
- 不扩大到正式全套美术。
- 不新增生产依赖。
- 不提交 Git，除非另有明确要求。

## 完成后的里程碑判断

完成 TASK017 后，First Playable 应从“稳定可玩”进入“基础可读、可验收、可展示”的 MVP Acceptance And Polish 后半段。若自动测试、Cocos 人工验收、场景引用检查、竖屏适配和性能基线均通过，下一阶段可以准备微信预览包、MVP 验收修补，或继续按批准范围补充更完整的战斗美术资产。
