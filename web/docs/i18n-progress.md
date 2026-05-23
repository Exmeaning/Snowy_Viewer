# Moesekai i18n 收尾阶段技术 Plan

> 更新时间：2026-05-23  
> 适用范围：`web/` Next.js 前端应用  
> 当前判断：硬编码 UI 中文的主体迁移已初步完成；后续工作应从“继续铺页面”转为“收尾清点、边界决策、自动化守护与质量复核”。

## 1. 结论摘要

本轮回顾后，i18n 项目已经从大规模迁移阶段进入收尾阶段：

- `zh-CN` / `en-US` / `ja-JP` 三语字典与 `I18nContext` 基础设施已落地。
- 核心数据库页、动态详情页、首页、布局、个人页、工具页、剧情页等主要用户路径基本接入 `t()`。
- 账号/服务器共享层、剧情 asset fallback、活动单位筛选、WL3 模拟分组与单位显示 label 等收尾项已完成最近几轮清理：共享常量改为稳定 key/id，显示文案统一由 `common.*` / `page.deckRecommend.*` 字典负责。
- 当前残留的中文不再主要集中在普通页面 UI，而是集中在以下边界：
  - SEO/站点品牌关键词（已集中到 server-safe SEO i18n 配置）。
  - 法务/赞助类静态长文本。
  - 设计系统演示页（已因 SEO noindex metadata 拆为 server `page.tsx` + allowlisted `client.tsx`）。
  - Project SEKAI masterdata / 角色名 / 漫画标题 / 搜索关键词。
  - 注释、开发辅助 fallback。
  - 少量待产品边界确认的枚举/display 常量。

下一阶段目标不是继续把所有中文无差别移动进字典，而是先定义“允许残留”和“必须迁移”的边界，再用脚本守护这个边界。

## 2. 当前架构快照

### 2.1 核心文件

```text
web/src/lib/i18n/
├── format.ts                  # key path 读取与 {token} 插值
├── index.ts                   # i18n 入口导出
├── locales.ts                 # locale 定义、持久化 key、document lang
└── messages/
    ├── index.ts               # messagesByLocale / fallbackMessages
    ├── types.ts               # MessageTree 类型
    ├── zh-CN/index.ts         # 简体中文文案
    ├── en-US/index.ts         # 英文文案
    └── ja-JP/index.ts         # 日文文案

web/src/contexts/I18nContext.tsx
```

### 2.2 已支持能力

- 支持 locale：`zh-CN`、`en-US`、`ja-JP`。
- 默认 locale：`zh-CN`。
- 客户端持久化：`localStorage` + cookie（key：`moesekai_ui_locale`）。
- 文档语言同步：`document.documentElement.lang` 与 `data-ui-locale`。
- `t(key, values?)`：先查当前语言，再查 fallback 字典，最后返回 key 本身。
- `formatDate()` / `formatNumber()`：基于当前 locale 调用 `Intl`。
- 插值格式：`{name}`，例如 `t("page.cards.allLoaded", { count })`。

当前没有 ICU message / plural 规则。英文复数暂时通过规避型文案处理，例如 `Showing all {count} cards`。

### 2.3 推荐使用方式

```tsx
"use client";

import { useI18n } from "@/contexts/I18nContext";

export function Example() {
    const { t, formatDate, formatNumber } = useI18n();

    return (
        <section>
            <h1>{t("page.cards.title")}</h1>
            <p>{t("page.cards.allLoaded", { count: 100 })}</p>
            <time>{formatDate(Date.now())}</time>
            <span>{formatNumber(12345)}</span>
        </section>
    );
}
```

## 3. 已完成范围（压缩版）

> 这里记录当前阶段判断，不再保留逐轮流水账。若要确认某个文件的最新状态，以代码与扫描结果为准。

### 3.1 基础设施与共享层

| 范围 | 状态 | 备注 |
|---|---:|---|
| `I18nContext` / `lib/i18n/*` | 已完成 | 提供翻译、格式化、locale 切换、fallback 与持久化 |
| 中英日字典 | 已大体完成 | `zh-CN`、`en-US` 与 `ja-JP` 持续同步维护；`lint:i18n` 已覆盖多 locale key 结构一致性 |
| Settings locale 切换 | 已完成 | UI 使用无国旗的下拉栏切换语言 |
| 导航 / Sidebar / Breadcrumb / Footer | 已完成 | 导航源已尽量改为稳定 id/href，显示文案来自 `layout.*` |
| 首页与 Home 组件 | 已完成 | 入口、Hero、活动、卡牌、歌曲、Live、动态等固定 UI 已迁移 |
| CommandPalette / 搜索入口 | 已完成 | 静态导航搜索使用当前语言 label，音乐别名等按既有边界处理 |
| BaseFilters / Modal / QuickFilter / 图片动作 | 已完成 | 共享筛选、弹窗、预览、复制、保存、下载固定文案已迁移 |
| 快捷键帮助 | 已完成 | 分组使用稳定 id 与 `shortcuts.*` 字典 |
| 账号与服务器共享层 | 已完成 | `SERVER_OPTIONS` 使用 `labelKey`，调用方复用 `common.server.*`；联机中继服务器使用 `nameKey` / `regionKey` + `common.relayServers.*` |
| 单位显示共享常量 | 已完成 | `UNIT_FIELD_LABEL_KEYS` / `UNIT_ID_LABEL_KEYS` 作为 UI label key 来源，页面/组件侧通过 `common.units.*` 显示；`UNIT_NAME_MAP` 仅保留 masterdata/官方名边界 |
| 全局错误页 | 已完成 | 接入 `common.errorBoundary` / `common.action.retry` |

### 3.2 主要路由

| 类别 | 已完成路由 |
|---|---|
| 数据库与详情页 | `/cards`、`/cards/[id]`、`/events`、`/events/[id]`、`/gacha`、`/gacha/[id]`、`/music`、`/music/[id]`、`/music/meta`、`/live`、`/live/[id]`、`/materials`、`/exchanges`、`/exchanges/[id]`、`/honors`、`/mysekai`、`/mysekai/[id]`、`/character`、`/character/[id]`、`/costumes`、`/costumes/[id]`、`/sticker`、`/comic`、`/manga`、`/manga/[id]` |
| 剧情页 | `/story/**` 主入口、列表、详情与阅读页固定 UI 基本完成 |
| 个人页/工具页 | `/profile`、`/my-cards`、`/my-musics`、`/my-materials`、`/deck-recommend`、`/deck-comparator`、`/score-control`、`/sticker-maker`、`/goods-gacha`、`/guess-who`、`/guess-who/multiplayer`、`/guess-jacket`、`/guess-jacket/multiplayer`、`/chart-preview`、`/mysekai-preview`、`/mysekai-preview/ranking`、`/mysekai-preview/scene`、`/prediction`、`/oauth2/connect`、`/oauth2/callback/code`、`/realtime-ranking` |
| 社区/静态辅助页 | `/about`、`/guides`、`/guides/[id]`、`/leave`、breadcrumb 汇总页、`/blank` |
| 有意保留或待决策页 | `/patreon`、`/privacy`、`/terms` 正文仍是静态长文本/双语内容；metadata 已接入 server-side SEO i18n |

## 4. 当前中文残留分类

2026-05-22 快速扫描摘要（排除 `node_modules`，并将 `lib/i18n/messages/*` 视为合法中文来源）：

```text
files_with_han_excluding_messages = 11
```

这些残留不能简单等价为“未完成”。建议按下面规则处理。

### 4.1 明确允许残留

| 类型 | 文件/范围 | 处理策略 |
|---|---|---|
| 字典与 locale 原生名 | `src/lib/i18n/messages/zh-CN/index.ts`、`src/lib/i18n/messages/en-US/index.ts`、`src/lib/i18n/messages/ja-JP/index.ts`、`src/lib/i18n/locales.ts` | 各语言字典必须保留；英文/日文包可能包含赞助者名、日文源标签、masterdata 翻译映射；locale 原生名用于语言切换器 |
| SEO 多语言文案与中文关键词 | `src/lib/seo-keywords.ts` | SEO 文案/关键词已集中为 `zh-CN` / `en-US` server-safe 配置；中文 SEO 作为中文 locale 与品牌定位保留，不再散落在 `layout.tsx` 或页面 metadata |
| 游戏数据/官方名 | `src/types/types.ts`、`src/lib/oldComicTips.ts`、`src/lib/mysekai-i18n.ts`、`src/lib/songConstants.ts`、`src/lib/storyLoader.ts` | 属于 masterdata、角色名、漫画标题、剧情翻译 fallback、搜索修正或官方名边界，不应无差别迁移 |
| 法务/赞助长文本 | `src/app/privacy/page.tsx`、`src/app/terms/page.tsx`、`src/app/patreon/page.tsx` | 当前可视为内容页面；是否拆入字典需要产品决策 |
| 设计系统演示 | `src/app/design-system/page.tsx` | 开发/演示路由，不作为用户路径 P0 |
| 注释/开发辅助 | 已清理一批纯注释中文残留 | `BreadcrumbContext`、`useCardThumbnail`、`prediction` 类型、基础筛选示例、卡牌缩略图注释、旧 document.title 注释等已改为英文或移除，扫描噪声降低 |

### 4.2 建议优先清理的 UI fallback

这些不是大范围迁移，但适合作为收尾 PR：

| 优先级 | 文件 | 问题 | 建议 |
|---|---|---|---|
| P0 | `src/hooks/useStoryAsset.ts` | catch fallback 曾有 `"加载失败"` | 已完成：hook 接收 `fallbackErrorMessage`，剧情阅读页传入 `common.state.loadingFailed`；目标扫描为 0 |
| P0 | `src/components/events/EventFilters.tsx` | `EVENT_UNIT_FILTERS` 的 `mixed` 曾有中文 `name` | 已完成：常量改为 `{ id, labelKey, fallbackName, icon? }`，显示处使用 `t(labelKey)`；目标扫描为 0 |
| P0 | `src/lib/eventUnit.ts` | `getEventUnitDisplayName()` 曾返回 `"无"` / `"其他"` | 已完成：改为 `getEventUnitFilterId()` 返回 stable id，UI 层使用 `common.units.*` 翻译；目标扫描为 0 |
| P1 | `src/lib/world-bloom-simulation.ts` | WL3 分组 title 曾为 `"第1组"` 等 | 已完成：`WL3_SIMULATION_GROUPS` 仅保留 `groupId`，UI 使用 `page.deckRecommend.wl3GroupTitle` 模板；目标扫描为 0 |
| P1 | `src/hooks/usePageListShortcuts.ts` | fallback 匹配包含 `搜索`、`加载更多` | 已完成：删除基于 placeholder/textContent 的中文/英文 DOM 兜底匹配，搜索框与加载更多按钮统一依赖 `data-shortcut-search` / `data-shortcut-load-more` 显式标记；目标扫描为 0 |
| P2 | `src/types/types.ts` / `src/lib/supabase.ts` 中少量枚举 display | 角色/组合/扭蛋/联机中继服务器等常量混合了官方名与 UI label | 已推进一批：`SUPPORT_UNIT_NAMES` / `GACHA_TYPE_LABELS` / `GACHA_CATEGORY_LABELS` 改为 `*_LABEL_KEYS`；`SERVERS` 中继节点改为 `nameKey` / `regionKey`；单位显示新增 `UNIT_FIELD_LABEL_KEYS` / `UNIT_ID_LABEL_KEYS`，常见 UI 调用方通过 `common.units.*` 显示；`UNIT_NAME_MAP`、`CHARACTER_NAMES` 等官方名继续按 masterdata 边界保留 |

## 5. 字典组织规范

### 5.1 顶层分区

```ts
export const zhCNMessages = {
    common: { ... },   // 通用动作、状态、字段、枚举、共享错误
    layout: { ... },   // 导航、页脚、面包屑、分组页
    search: { ... },   // 命令面板/搜索体验
    shortcuts: { ... },// 快捷键帮助
    page: { ... },     // 具体路由/业务模块
} as const satisfies MessageTree;
```

### 5.2 放入 `common` 的条件

满足任一条件即可放入 `common`：

- 多个页面复用。
- 枚举 label 会被列表页、详情页或工具页共同使用。
- 字段名通用：`name`、`type`、`rarity`、`description`。
- 状态通用：`loading`、`noData`、`loadingFailed`。
- 共享错误码或 API 错误映射。

常见路径：

```text
common.action.close
common.state.loading
common.filter.all
common.field.name
common.server.jp
common.units.mixed
common.exchange.rewardTypes.mysekai_material
common.oauthErrors.accessDenied
```

### 5.3 放入 `page` 的条件

只属于某个路由或业务模块的文案放在 `page.<module>`：

```text
page.deckRecommend.validation.noCards
page.scoreControl.result.noSolution
page.story.reader.loading
page.profile.stats.characterRank
page.mysekaiPreview.scene.loadFailed
```

### 5.4 命名原则

- 使用稳定语义，不使用视觉位置命名。
  - 推荐：`page.exchanges.loadFailed`
  - 不推荐：`page.exchanges.redBoxText`
- 枚举 key 使用数据字段或稳定 id。
  - 推荐：`common.exchange.rewardTypes.mysekai_material`
- 动态 tab / 状态使用对象：

```ts
filterTitle: {
    normal: "称号筛选",
    bonds: "羁绊称号筛选",
}
```

调用：

```tsx
t(`page.honors.filterTitle.${activeTab}`)
```

## 6. 迁移边界

### 6.1 必须迁移

- 页面标题、说明、副标题、按钮、空态、错误提示。
- 筛选器 section label、placeholder、sort option label。
- badge / chip / status / tab label。
- 弹窗标题、字段名、说明标题。
- 共享枚举标签和工具函数输出给 UI 的 label。
- 用户可见的 toast、alert、confirm、校验错误。
- image/canvas/SVG 分享图中绘制的固定 UI 文案。

### 6.2 可保留或需谨慎处理

- Project SEKAI masterdata：卡牌名、活动名、剧情正文、歌曲名、漫画标题、物品描述等。
- 角色名、组合名：如果视为游戏官方名，可以保留；如果作为 UI 语言体验的一部分，需要先制定统一名称表。
- 用户输入内容。
- API 原始错误文本：除非已有 error code 可映射。
- SEO keywords / structured data aliases：当前中文 SEO 和 Project SEKAI 别名是站点定位的一部分，不应被普通 UI 扫描误判；`structured-data.ts` 已单独 allowlist。
- 法务/赞助长文本：属于内容本地化，不应和 UI 文案迁移混在同一个 PR。

## 6.3 近期维护记录

### 2026-05-23：SEO 重构联动

- `src/lib/seo-keywords.ts` 新增 ja-JP 核心页面 SEO 文案：about / cards / music / events / gacha / character / story。
- 继续补齐第二批 ja-JP 核心页面 SEO 文案：soundtrack / music meta / comic / costumes / exchanges / manga / materials / honors / live / sticker / mysekai；这些仍属于 server-side SEO 配置，不进入客户端 UI 字典。
- 继续补齐第三批 ja-JP 页面级 SEO 文案：prediction、deck recommend / comparator、chart preview、MySekai preview 子页、个人数据页、profile、score control、sticker maker、realtime ranking、guess games、goods gacha、patreon、privacy、terms 与 breadcrumb 汇总页。
- `src/lib/seo-detail-metadata.ts` 集中十类动态详情页 metadata presets，并升级为 `defineXxxDetailPage()` 工厂；页面文件重复 SEO boilerplate 进一步降低，同时保留详情模板按 cookie/Accept-Language 输出。
- `src/lib/seo-metadata.ts` 的页面 canonical/noindex path 更靠近 route registry，动态详情 canonical 统一使用 `normalizeSeoPath()`，仍不输出 hreflang / sitemap alternate links。
- `src/lib/structured-data.ts` 承接 Root JSON-LD 与结构化数据 helper，并在硬编码中文扫描中作为 SEO/Project SEKAI 别名边界单独 allowlist；Root 本轮新增 registry-backed 站点导航 `ItemList`，详情页本轮开始自动输出 `BreadcrumbList` JSON-LD。
- `src/app/design-system/page.tsx` 拆为 server metadata wrapper，原演示内容迁到 `src/app/design-system/client.tsx`，allowlist 路径同步调整；本轮 `/design-system` 与 `/leave` 改为 registry-backed `noIndexRouteMetadata()`。
- 本轮 `npm run lint:i18n --prefix web`、`npm run lint:i18n-usage --prefix web`、`npm run lint --prefix web`、`npm run sitemap --prefix web`、`npm run generate:metadata --prefix web` 与 `npm run build:next --prefix web` 均通过；`lint` 仍仅有既有 soundtrack hook dependency warning。

## 7. 工具层与枚举 label 规范

普通工具函数不要直接调用 React hook。优先使用以下模式。

### 7.1 工具函数接受可选 `t`

```ts
type TranslationFn = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

function translateLabel(key: string | undefined, fallback: string, t?: TranslationFn) {
    if (!key || !t) return fallback;
    const label = t(key);
    return label === key ? fallback : label;
}
```

### 7.2 枚举常量保留 stable id / labelKey

```ts
export const SERVER_OPTIONS = [
    { value: "cn", labelKey: "common.server.cn" },
    { value: "jp", labelKey: "common.server.jp" },
    { value: "tw", labelKey: "common.server.tw" },
] as const;
```

组件侧：

```tsx
const { t } = useI18n();

{SERVER_OPTIONS.map(option => (
    <button key={option.value}>{t(option.labelKey)}</button>
))}
```

### 7.3 Hook 可以用 i18n，但要注意职责

React hook 内可以调用 `useI18n()`，但如果 hook 是低层数据 hook，建议优先返回 error code / error type，由页面组件翻译。这样可以减少隐式 provider 依赖。

## 8. Metadata 与 SEO 策略

当前已完成第一阶段 server-side SEO i18n：

- server/static `page.tsx` 仍不能直接使用客户端 `useI18n()`；SEO 改为通过 server-safe helper 读取 cookie locale。
- `src/lib/seo-keywords.ts` 集中保存 `zh-CN` / `en-US` / `ja-JP` SEO 文案、关键词、OpenGraph locale、JSON-LD 文案、详情页模板与后续 locale registry。
- `src/lib/seo-metadata.ts` 负责在 server 侧解析 `moesekai_ui_locale` cookie，并生成统一的 `Metadata`：title、description、keywords、canonical、OpenGraph、Twitter。
- 根布局 `app/layout.tsx` 已改为 `generateMetadata()`，root title/description/keywords/OpenGraph/JSON-LD 均按 locale 输出，不再在 layout 内硬编码中文品牌 SEO 文案。
- 页面级静态 metadata 已从“英文兜底 + SEO suffix”改为 `pageMetadata("...")`；动态详情页继续使用 masterdata 名称，但固定描述模板和 suffix 按 locale 输出，详情页配置已集中到 `seo-detail-metadata.ts` 并由 `defineXxxDetailPage()` 工厂绑定 metadata 与 Breadcrumb JSON-LD。
- `/privacy`、`/terms`、`/patreon` 正文仍属于内容页边界，暂不拆正文；metadata 已接入 server-side SEO i18n。

当前 locale 来源策略：

1. SEO locale 使用现有 `moesekai_ui_locale` cookie，与 UI 语言保持一致。
2. 默认 locale 仍为 `zh-CN`。
3. 未引入 `/zh-CN`、`/en-US` 或未来 `/ja-JP` URL 前缀，因此当前只设置 canonical 到当前路径，不输出伪 hreflang。
4. OpenGraph 已按 locale 设置 `locale` 与 `alternateLocale`，但 sitemap alternate links 需要等待 locale-specific URL 策略确定后再启用。

未来新增日语等语言时的推荐步骤：

1. 在 `SUPPORTED_UI_LOCALES` / UI 字典中加入新 locale（`ja-JP` 已加入）。
2. 在 `SEO_LOCALE_CONFIG`、`SEO_PAGE_METADATA`、`DETAIL_SEO_TEMPLATES`、`DETAIL_FALLBACK_TITLES` 中补齐该 locale；当前 `ja-JP` 已有 SEO locale 与详情模板，页面级 SEO 可通过 fallback 逐步精修。
3. 若产品决定采用 locale URL，再统一设计 `/ja-JP/...`、canonical、hreflang、sitemap alternate links 与缓存策略。
4. 若只继续 cookie locale，则不要输出 hreflang，避免多个语言版本共用同一 URL 时误导搜索引擎。

## 9. 下一阶段执行路线

### P0：UI fallback 收尾

目标：让普通用户路径中可见的固定中文 UI fallback 基本清零。

- [x] 清理 `useStoryAsset.ts` 的 `"加载失败"` fallback：新增 `fallbackErrorMessage` 参数，剧情阅读页传入 `common.state.loadingFailed`。
- [x] 将 `EVENT_UNIT_FILTERS` 的 `mixed` 从中文 `name` 改为 `labelKey` / `fallbackName`。
- [x] 改造 `getEventUnitDisplayName()` 为 `getEventUnitFilterId()`，避免 `lib/eventUnit.ts` 输出中文。
- [x] 针对上述文件执行中文残留扫描与定向 lint。
- [x] 清理 `usePageListShortcuts.ts` 的中文 DOM fallback：去掉 `搜索` / `加载更多` 文本匹配，搜索与加载更多快捷键只识别显式 `data-shortcut-*` 标记，并补齐 `story/area`、`story/card`、`music/meta`、`soundtrack` 的标记。

本轮已按“小型共享枚举/剧情 hook 收尾”粒度完成，并额外纳入 WL3 模拟分组显示清理与页面列表快捷键 fallback 清理。

### P1：静态内容页决策

目标：决定 `/privacy`、`/terms`、`/patreon` 是否进入 i18n 范围。

可选方案：

1. **保持现状**：把它们定义为中文/双语内容页，加入扫描 allowlist。
2. **客户端内容 i18n**：拆出 client body，使用 `page.privacy` / `page.terms` / `page.patreon` 字典；metadata 继续复用现有 server-side SEO i18n。
3. **服务端内容 i18n**：把正文也拆成 server-rendered locale content，成本更高，应与 locale URL / hreflang 策略一起做。

建议默认方案：短期保持现状并加入 allowlist；metadata 已完成多语言 SEO，正文内容等 locale URL 与内容本地化决策后再统一处理。

### P1：WL3 / 活动组合等业务常量收尾

- [x] `WL3_SIMULATION_GROUPS` 保留 `groupId`，去掉中文 `title`。
- [x] 复查 `deck-recommend` 中 WL3 分组显示：主页面与 `EventSelector` 均通过 `t("page.deckRecommend.wl3GroupTitle", { group })`。
- [x] 将 `SUPPORT_UNIT_NAMES` 改为 `SUPPORT_UNIT_LABEL_KEYS`，卡牌筛选与卡牌详情使用字典显示 VS 团体归属。
- [x] 将 `GACHA_TYPE_LABELS` / `GACHA_CATEGORY_LABELS` 改为 `GACHA_TYPE_LABEL_KEYS` / `GACHA_CATEGORY_LABEL_KEYS`，扭蛋详情页与筛选继续通过字典显示。
- [x] 将联机中继 `SERVERS` 的 `name` / `region` 改为 `nameKey` / `regionKey`，猜角色/猜曲绘联机页通过 `common.relayServers.*` 字典显示服务器名、区域与分享文案。
- [x] 清理一批注释/开发辅助中文残留，缩小 `scan-hardcoded-ui-text.mjs` allowlist。
- [x] 新增 `UNIT_FIELD_LABEL_KEYS` / `UNIT_ID_LABEL_KEYS`，并把角色筛选、活动卡片/选择器、设置面板、队伍推荐自定义加成、猜角色、贴纸制作、个人剧情单位分组、活动详情 VS 子团体显示等常见 UI 路径改为通过 `common.units.*` 翻译。
- [x] 继续确认 `CHARACTER_NAMES` / `CHAR_NAMES` 的产品边界：官方名保留，若要完整英文 UI 需先制定统一角色名策略。

### P2：自动化守护

目标：避免后续新增页面重新引入硬编码中文。

已新增脚本：

| 脚本 | 目标 |
|---|---|
| `scripts/check-i18n-keys.mjs` | 比较 `zh-CN` 与 `en-US` 字典 key 结构是否一致 |
| `scripts/scan-hardcoded-ui-text.mjs` | 扫描目标目录中文残留，支持 allowlist |
| `scripts/check-i18n-usage.mjs` | 静态检查 `t("...")` key 是否存在（先覆盖字符串字面量） |

当前 npm scripts：

```json
{
  "lint:i18n": "node scripts/check-i18n-keys.mjs && node scripts/scan-hardcoded-ui-text.mjs",
  "lint:i18n-usage": "node scripts/check-i18n-usage.mjs"
}
```

当前扫描 allowlist（每项在脚本中带 reason）：

```text
src/lib/i18n/messages/zh-CN/index.ts
src/lib/i18n/messages/en-US/index.ts
src/lib/i18n/messages/ja-JP/index.ts
src/lib/i18n/locales.ts
src/lib/seo-keywords.ts
src/app/privacy/page.tsx
src/app/terms/page.tsx
src/app/patreon/page.tsx
src/app/design-system/page.tsx
src/lib/oldComicTips.ts
src/lib/mysekai-i18n.ts
src/lib/songConstants.ts
src/types/types.ts
src/lib/storyLoader.ts
```

allowlist 必须注明原因，不能只写路径；近期已移除注释类 allowlist、`src/lib/supabase.ts` 临时 allowlist 与 `src/app/layout.tsx` SEO allowlist，当前 `lint:i18n` 输出为 `Hardcoded UI Han scan OK (13 allowlisted file groups)`。

### P3：多语言 SEO / 服务端 i18n 专项

第一阶段已完成 cookie-locale 版 SEO i18n；完整 hreflang/sitemap 仍等待 locale URL 决策：

- [x] 设计 server locale 解析策略：读取 `moesekai_ui_locale` cookie，默认 `zh-CN`。
- [x] 抽出 server-safe SEO metadata 配置与 helper：`src/lib/seo-keywords.ts` + `src/lib/seo-metadata.ts`。
- [x] 改造 root metadata、OpenGraph locale、Twitter、canonical 与 JSON-LD。
- [x] 静态页面 metadata 与动态详情页模板接入 `zh-CN` / `en-US`；`ja-JP` 已接入 locale、root SEO 与详情模板，页面级 SEO 继续按 fallback + 精修策略维护。
- [x] 明确中文 SEO keywords：保留在 `zh-CN` locale 与跨语言品牌关键词中，不再作为所有页面固定 suffix 散落。
- [ ] 设计 locale-specific URL（例如 `/zh-CN` / `/en-US` / `/ja-JP`）后，再启用 sitemap alternate links / hreflang。

### P4：文案质量与高级格式化

- [ ] 英文文案统一校对语气、大小写、术语。
- [ ] 评估 ICU message / plural 支持。
- [ ] 评估日期、时间、服务器名、单位名是否需要更细的 locale 格式策略。
- [ ] 为复杂工具页的错误码建立统一映射表。

## 10. 校验流程

### 10.1 中文残留扫描

在 NarraFork/Claude 环境中优先使用 `Grep` 工具；本地开发可使用 `rg`。

示例：

```bash
rg -n "[\p{Han}]" web/src/hooks/useStoryAsset.ts web/src/components/events/EventFilters.tsx web/src/lib/eventUnit.ts web/src/lib/world-bloom-simulation.ts web/src/app/story/event/[eventId]/[episodeNo]/client.tsx web/src/app/story/unit/[unitId]/[episodeId]/client.tsx web/src/app/events/[id]/client.tsx web/src/app/deck-recommend/client.tsx web/src/components/deck-recommend/EventSelector.tsx
```

扫描结果需要人工分类：

- 字典中文：合法。
- masterdata / 官方名：通常合法。
- SEO keywords：当前合法。
- 注释：低优先级，可逐步清理。
- 用户可见固定 UI：必须迁移。

### 10.2 定向 lint

ESLint 使用 flat config，不使用旧 `--file` 参数。示例：

```bash
npm run lint --prefix web -- \
  src/hooks/useStoryAsset.ts \
  src/app/story/event/[eventId]/[episodeNo]/client.tsx \
  src/app/story/unit/[unitId]/[episodeId]/client.tsx \
  src/components/events/EventFilters.tsx \
  src/lib/eventUnit.ts \
  src/lib/world-bloom-simulation.ts \
  src/app/events/[id]/client.tsx \
  src/app/deck-recommend/client.tsx \
  src/components/deck-recommend/EventSelector.tsx
```

### 10.3 Next 构建

```bash
npm run build:next --prefix web
```

已知构建输出可能出现 Turbopack root 相关 warning；只要 exit code 成功即可视为构建通过。

### 10.4 完成定义（Definition of Done）

每个 i18n 收尾 PR 至少满足：

- [ ] 新增/修改的用户可见文案均来自 `t()` 或明确 allowlist。
- [ ] `zh-CN` 与 `en-US` 字典同步增加 key。
- [ ] 工具层不直接输出中文 UI label，除非属于 masterdata/官方名边界。
- [ ] 目标文件中文残留扫描完成，并说明残留原因。
- [ ] 定向 lint 通过。
- [ ] 影响路由较多时执行 `npm run build:next --prefix web`。

## 11. 最近已知验证记录

最近一轮（2026-05-23，大型 SEO 重构启动 / i18n 守护收口）推进范围：

```text
web/src/lib/mysekai-preview/runtime.ts
web/src/hooks/useEventListData.ts
web/src/lib/seo-routes.ts
web/src/lib/seo-routes-data.json
web/src/lib/seo-keywords.ts
web/src/lib/seo-metadata.ts
web/src/lib/sitemap.ts
web/src/app/robots.txt/route.ts
web/src/app/**/[id]/page.tsx metadata fallback
web/scripts/generate-sitemaps.mjs
web/public/data/sitemap-data.json
web/docs/seo-progress.md
web/docs/i18n-progress.md
```

结果：

- 清理 `src/lib/mysekai-preview/runtime.ts` 两行中文注释扫描噪声，不把运行时实现注释加入 allowlist。
- 更新 `src/hooks/useEventListData.ts` 中旧 `/eventstory` 示例注释为当前 `/story/event` 路径。
- 新增 `web/docs/seo-progress.md`，SEO 路由 registry、sitemap、metadata fallback、robots 与 hreflang 后续工作迁入独立进度文档维护。
- i18n 当前判断保持为“守护与边界维护”阶段：UI 文案主体已完成，后续新增用户可见文案继续由字典和校验脚本守护。
- 本轮启动前 `check-i18n-keys.mjs` 已确认：`i18n key structure OK (3028 keys across 3 locales)`。
- 本轮启动前 `check-i18n-usage.mjs` 已确认：`Literal i18n usage keys OK`。
- 完整 lint / build 验证结果见 `web/docs/seo-progress.md` 最近验证记录。

上一轮（2026-05-22，多语言 SEO / server metadata 收尾）已完成并记录为通过的范围：

```text
web/src/lib/seo-keywords.ts
web/src/lib/seo-metadata.ts
web/src/app/layout.tsx
web/src/app/**/page.tsx metadata
web/src/app/music/[id]/client.tsx
web/scripts/scan-hardcoded-ui-text.mjs
web/docs/i18n-progress.md
```

结果：

- 新增 `SEO_LOCALE_CONFIG` / `SEO_PAGE_METADATA` / `DETAIL_SEO_TEMPLATES` / `DETAIL_FALLBACK_TITLES`，root、页面与详情页 SEO 文案已按 `zh-CN` / `en-US` 分区，未来加入 `ja-JP` 等 locale 时由 TypeScript 约束补齐。
- 新增 `src/lib/seo-metadata.ts`，server 侧读取 `moesekai_ui_locale` cookie 并统一生成 title、description、keywords、canonical、OpenGraph、Twitter metadata。
- 根 `app/layout.tsx` 改为 `generateMetadata()`；JSON-LD 改为按初始 locale 输出；inline locale 初始化脚本改为基于 `SUPPORTED_UI_LOCALES`，不再写死中英二选一。
- 静态页面 metadata 改为 `pageMetadata("...")`；动态详情页继续使用 masterdata 名称，但固定描述模板与 suffix 改为 locale-aware。
- 当前不输出 hreflang / sitemap alternate links，因为尚未引入 locale-specific URL；OpenGraph 已设置当前 locale 与 alternateLocale。
- 从 `scan-hardcoded-ui-text.mjs` allowlist 移除 `src/app/layout.tsx`，中文 SEO 只集中保留在 `src/lib/seo-keywords.ts`。
- 构建时顺手修复 `src/app/music/[id]/client.tsx` 中 `VocalPlayer` 使用外层 `t` 的作用域问题，改为父组件传入 `getCharacterLabel`。
- `check-i18n-keys.mjs` 当前校验通过：`i18n key structure OK (2966 keys)`。
- `check-i18n-usage.mjs` 当前校验通过：`Literal i18n usage keys OK`。
- `scan-hardcoded-ui-text.mjs` 当前校验通过：`Hardcoded UI Han scan OK (13 allowlisted file groups)`。
- `web/src` 排除 `lib/i18n/messages/*` 后当前仍有中文文件数为 11，集中在 SEO 配置、内容页、masterdata/官方名、locale 原生名与 story fallback 映射等 allowlist 边界。
- `npm run lint:i18n --prefix web && npm run lint:i18n-usage --prefix web && npm run lint --prefix web` 已通过。
- `npm run build:next --prefix web` 已通过；仅出现已知 Turbopack root warning。

上一轮（2026-05-22，单位显示 label key 收尾）已完成并记录为通过的范围：

```text
web/src/types/types.ts
web/src/types/story.ts
web/src/lib/storyLoader.ts
web/src/components/common/CharacterFilter.tsx
web/src/components/events/EventFilters.tsx
web/src/components/events/EventItem.tsx
web/src/components/deck-recommend/CharacterSelector.tsx
web/src/components/deck-recommend/EventSelector.tsx
web/src/components/SettingsPanel.tsx
web/src/components/story/StorySnippet.tsx
web/src/app/deck-recommend/client.tsx
web/src/app/events/[id]/client.tsx
web/src/app/story/self/client.tsx
web/src/app/guess-who/client.tsx
web/src/app/guess-who/multiplayer/client.tsx
web/src/app/sticker-maker/client.tsx
web/docs/i18n-progress.md
```

结果：

- 新增 `UNIT_FIELD_LABEL_KEYS` / `UNIT_ID_LABEL_KEYS` 作为单位字段与单位 id 的 UI label key 来源；`UNIT_NAME_MAP` 继续保留为 masterdata/官方名边界，不再作为常见 UI 显示的首选来源。
- 角色筛选、活动筛选/卡片/选择器、设置面板、队伍推荐自定义加成、活动详情 VS 子团体显示、个人剧情单位分组、猜角色单人/联机与贴纸制作中的单位 title/alt/label 已改为通过 `common.units.*` 翻译。
- 剧情 loader 不再为 VS 子团体返回中文 `unitName`，仅保留稳定 `unitField` 供 UI badge 使用；相关类型注释改为 legacy 说明。
- 目标文件定向 ESLint 已通过。
- `check-i18n-keys.mjs` 当前校验通过：`i18n key structure OK (2914 keys)`。
- `check-i18n-usage.mjs` 当前校验通过：`Literal i18n usage keys OK`。
- `scan-hardcoded-ui-text.mjs` 当前校验通过：`Hardcoded UI Han scan OK (14 allowlisted file groups)`。
- `web/src` 排除 `lib/i18n/messages/*` 后当时仍有中文文件数为 12，集中在 SEO、内容页、masterdata/官方名、locale 原生名与 story fallback 映射等 allowlist 边界。
- `npm run lint:i18n --prefix web && npm run lint:i18n-usage --prefix web && npm run lint --prefix web` 已通过。
- `npm run build:next --prefix web` 已通过；仅出现已知 Turbopack root warning。

## 12. 后续维护原则

- 不再把本文维护成逐行流水账；完成事项只保留模块级状态和最近验证记录。
- 每次新增路由或工具页时，同步补充 `zh-CN` 与 `en-US`，不要只写中文。
- 新增共享枚举时优先设计 `id` / `labelKey`，不要在常量里直接塞中文 label。
- 不要把 masterdata 多语言、SEO 多语言、UI i18n 混在同一个 PR。
- 任何中文残留都应属于“字典 / allowlist / masterdata / SEO / 内容页 / 注释 / 待迁移 UI”之一；无法归类的残留默认视为 bug。

### 12.1 语言选择与敏感地区表述

- 界面语言选择器使用纯文字下拉栏，不使用国旗 emoji 或国旗图标。
- 服务器/区域显示使用稳定 id 与中性缩写（如 `CN` / `JP` / `TW` / `KR` / `EN`），避免将语言、服务器或地区写成国别化表述。
- 涉及 `tw` 的 UI 文案应使用 `繁中 (TW)` / `TW` 等中性表述，不使用“台湾”等政治敏感写法；遵循一个中国原则。
- 新增 locale 时必须同步 `SUPPORTED_UI_LOCALES`、`messagesByLocale`、`scripts/i18n-utils.mjs`、SEO locale 配置与扫描 allowlist。
