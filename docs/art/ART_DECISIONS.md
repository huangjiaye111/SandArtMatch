# Art Decisions

## Status

Approved for Battle Art v0.1.

## Direction

清爽沙画工坊 Sand Workshop，少量采用海岸陶盘方向的轻自然材质。

## Decisions

- TASK017 不长期显示顶部目标预览。
- 桶容量使用连续填充或 Mask，不为每个容量制作独立切图。
- 颜色之外使用符号、文本或轻纹理辅助辨识。
- 合成后继续留在战斗中，只有胜利和死局显示结果面板。
- 普通沙层和普通桶优先使用基础纹理加运行时 Tint。
- MVP 只支持单方向传送带和吸沙视觉。
- 胜利结果使用实时游戏沙画，不额外制作每关结果图。
- 概念设计以 First Playable 截图作为布局结构参考。
- 按钮正式状态为 Normal、Pressed、Disabled、Selected。
- 桶正式状态为 Empty、Partial、Full、Disabled、Selected。
- UI 通用底板、按钮和面板优先使用九宫格，阴影和圆角预烘焙。
- TASK017 只制作战斗内首批资源，不制作商店、签到、广告、排行榜、多关卡地图或正式关卡结果图。
