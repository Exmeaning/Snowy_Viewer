# Moesekai 全站 iOS 26 毛玻璃样式统一进度计划表

> 更新时间：2026-05-23  
> 适用范围：`web/` Next.js 纯 CSR 前端应用  
> 核心目标：将全站所有容器、卡片、按钮、输入框、导航栏、选项卡和弹窗等统一更换为极具科技感、质感通透的 **iOS 26 拟物态毛玻璃 (Glassmorphic) 与微动效** 样式。

---

## 1. 核心视觉设计标准 (iOS 26 Glassmorphic Specification)

为了确保设计的高端感（WOW 效果）与跨页面一致性，我们定义以下核心样式规范：

### 1.1 基础玻璃体与饱和度 (Blur & Saturate)
*   **标准玻璃卡片**：`backdrop-filter: blur(24px) saturate(210%)`
*   **重型磨砂面板（侧边栏、弹窗）**：`backdrop-filter: blur(32px) saturate(190%)`
*   **轻量悬浮提示（Tooltip、小菜单）**：`backdrop-filter: blur(16px) saturate(220%)`

### 1.2 边缘精细亮光 (High-Gloss Borders & Shimmers)
*   使用超细 `1px` 边框，并在内侧融入双重拟物化微弱高光：
    *   **浅色模式**：背景 `rgba(255, 255, 255, 0.42)`，边框 `1px solid rgba(255, 255, 255, 0.45)`，内阴影 `inset 0 1px 0 rgba(255, 255, 255, 0.6)`。
    *   **深色模式**：背景 `rgba(15, 23, 42, 0.48)`，边框 `1px solid rgba(148, 163, 184, 0.18)`，内阴影 `inset 0 1px 0 rgba(255, 255, 255, 0.08)`。

### 1.3 背景环境光晕 blobs (Dynamic Ambient Glows)
*   在 `MainLayout` 全局背景中注入 2-3 个彩色环境光斑（Blob），配合慢速旋转漂浮动画。
*   彩色光斑随着用户切换主题角色（如 Miku 绿、Luka 粉、Kaito 蓝等）自动映射并柔和透出，为毛玻璃容器提供极其深邃的层级深度。

### 1.4 微弹动效 (Spring Micro-animations)
*   所有交互卡片和按钮引入 `framer-motion` 的弹性过渡，或使用纯 CSS `cubic-bezier(0.34, 1.56, 0.64, 1)`。
*   **悬停 (Hover)**：微升并增加外发光、高光边缘增亮。
*   **点击 (Active)**：微弹缩放 `scale-[0.97]`，触觉反馈拉满。

---

## 2. 样式统一总进度快照

| 阶段里程碑 | 覆盖范围 | 状态 | 验证日期 |
| :--- | :--- | :---: | :---: |
| **Milestone 1** | 设计系统规范与 `/design-system` 演示页重构 | **[x] 已完成** | 2026-05-23 |
| **Milestone 2** | 全局布局、顶栏、侧边栏、导航、环境背景光晕 | **[x] 已完成** | 2026-05-23 |
| **Milestone 3** | 核心数据库页面（卡牌、歌曲、活动、扭蛋、角色） | **[x] 已完成** | 2026-05-23 |
| **Milestone 4** | 复杂工具页面（队伍推荐、对比、贴纸制作、联机游戏） | **[x] 已完成** | 2026-05-23 |
| **Milestone 5** | 剧情、漫画阅读器与详情模块 | **[x] 已完成** | 2026-05-23 |
| **Milestone 6** | 个人数据中心、全局设置弹窗、通用模态窗 | `[ ] 未开始` | - |
| **Milestone 7** | 全站视觉收尾、样式兼容、性能审计与生产构建校验 | `[ ] 未开始` | - |

---

## 3. 里程碑任务分解与检查清单

### Milestone 1: 视觉 Token 定义与 `/design-system` 演示页重构
- [x] **全局 CSS 定义**：在 `web/src/app/globals.css` 中 design 并写入首批 `ios-glass-*` 实用类及过渡动画。
- [x] **设计系统重构**：升级 `web/src/app/design-system/client.tsx`：
    - [x] 重构“背景卡片”区域以展示 iOS 26 新旧对比。
    - [x] 重构“按钮与输入框”展示高透玻璃化输入表单。
    - [x] 重构“标签页与下拉菜单”展示柔和毛玻璃交互。
    - [x] 重构“复杂卡片与模态窗”展示全面升级的视觉质感。
- [x] **验证步骤**：
    - [x] 运行本地 lint 通过。
    - [x] 本地 Dev 模式下手动确认轻/深模式均能完美阅读、文字对比度符合 Web 标准。
- [x] **构建与提交**：
    - [x] 完成本地 git commit。

### Milestone 2: 全局布局、导航与环境背景光晕
- [x] **全局背景升级**：在 `web/src/components/MainLayout.tsx` 注入动态彩色漂浮 Blob 背景，并支持角色主题色关联。
- [x] **侧边栏导航重构**：将 Sidebar 改为重型磨砂玻璃，高光选中态。
- [x] **面包屑与顶栏重构**：将顶部面包屑栏和动作按钮改用轻量悬浮毛玻璃。
- [x] **验证步骤**：
    - [x] 运行本地 lint。
    - [x] 验证跨屏幕响应式状态。

### Milestone 3: 核心数据库页面重构
- [x] **卡牌列表与详情**：重构 `/cards` 及 `/cards/[id]` 详情面板、星级与属性容器。
- [x] **歌曲列表与详情**：重构 `/music` 及 `/music/[id]` 别名栏、谱面预览和声优选项。
- [x] **活动列表与详情**：重构 `/events` 及 `/events/[id]` 排行榜、加成角色及单位卡片。
- [x] **扭蛋与角色**：重构 `/gacha` 与 `/character` 模块。

### Milestone 4: 复杂工具页面重构
- [x] **队伍推荐 & 对比器**：重构 `/deck-recommend` 筛选器面板、计算结果与卡组拖拽框。
- [x] **贴纸制作**：重构 `/sticker-maker` 画布控制层及图层选择栏。
- [x] **联机游戏**：重构 `/guess-who` 和 `/guess-jacket` 猜角色/猜曲绘匹配大厅与答题板。

### Milestone 5: 剧情、漫画阅读器与详情
- [x] **故事列表与详情**：重构剧情树、分组标签页及锁头遮罩。
- [x] **故事阅读器**：重构小说对话框、背景切换器、自动播放进度栏。
- [x] **漫画阅读器**：重构 `/comic` / `/manga` 翻页悬浮球及双语对照浮窗。

### Milestone 6: 个人数据、设置与模态窗
- [ ] **个人数据页**：重构 `/profile`、`/my-cards` 及 `/my-musics` 拥有状态标记卡片。
- [ ] **模态弹窗系统**：重构 `components/common/Modal.tsx` 及 `ImagePreviewModal.tsx` 为圆润高饱和玻璃面板。
- [ ] **快捷键与帮助面板**：重构悬浮帮助栏。

### Milestone 7: 视觉收尾与最终交付
- [ ] **全局文字对比度审计**：确保所有毛玻璃背景下的文本易读性。
- [ ] **性能审计**：在高密度模糊滤镜下验证低端设备滚动流畅度（CSS `will-change` 优化）。
- [ ] **静态导出构建校验**：运行 `npm run build:next --prefix web` 确保无瑕疵静态交付。

---

## 4. 开发与提交工作流指南

### 4.1 每次进度的验证与提交步骤
1. 完成某一里程碑的代码修改。
2. 在 `web/` 目录下执行 lint 命令：
   ```bash
   npm run lint --prefix web
   ```
3. 若有报错立即修复。
4. 修改本文件 `web/docs/style-unification-progress.md` 中对应的任务复选框状态（如将 `[ ]` 改为 `[x]`），并更新本阶段的“状态”与“验证日期”。
5. 执行本地 Git 提交（**切勿 push**）：
   ```bash
   git add .
   git commit -m "style(glass): complete Milestone X - [里程碑简要描述]"
   ```

### 4.2 推进进度的提示词范式
在您向 AI 助手发送新指令时，推荐使用以下格式，以便助手能快速无缝地读取当前进度并继续实施：
```text
我需要继续推进 iOS 26 毛玻璃样式统一项目。
请读取最新进度文件：web/docs/style-unification-progress.md
当前需要执行的是：[里程碑名称，例如 Milestone 2]
请根据其任务清单进行详细开发，并在完成后进行本地 lint 和 git commit。
```
