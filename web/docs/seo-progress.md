# Moesekai SEO 重构推进文档

> 更新时间：2026-05-23  
> 适用范围：`web/` Next.js 前端应用  
> 当前阶段：从“页面 metadata 接入”推进到“路由 registry、sitemap 覆盖、robots/canonical/结构化数据守护”。

## 1. 当前 Baseline

### 1.1 已完成能力

- 根布局 `app/layout.tsx` 已使用 `generateMetadata()`，root title / description / keywords / canonical / OpenGraph / Twitter 由 server-side helper 生成。
- `src/lib/seo-keywords.ts` 集中维护 localized SEO 文案、关键词、OpenGraph locale、详情页描述模板与 root JSON-LD 文案。
- `src/lib/seo-metadata.ts` 负责读取 `moesekai_ui_locale` cookie 与 `Accept-Language`，生成统一 `Metadata`。
- 静态页面多数已使用 `pageMetadata("...")`。
- 动态详情页已通过 `public/data/metadata-map.json` + `src/lib/metadata.ts` 实现运行时零网络 metadata。
- sitemap 已拆分为：
  - `/sitemap.xml`
  - `/sitemap-main.xml`
  - `/sitemap-details.xml`
- `robots.txt` 已输出 sitemap 地址，并排除 `/api/`、`/blank/`、`/design-system/`、`/leave/`。

### 1.2 当前 i18n / SEO 关系

- UI locale 支持 `zh-CN`、`en-US`、`ja-JP`。
- SEO locale 当前由 cookie + `Accept-Language` 决定，默认 `zh-CN`。
- 当前没有 locale-specific URL，因此本阶段 **不启用 hreflang**。
- OpenGraph locale 可以继续按当前 request locale 输出；sitemap alternate links 等待 locale URL 策略确定后再启用。

### 1.3 本轮发现的问题

| 类型 | 问题 | 处理方向 |
|---|---|---|
| i18n 守护 | `mysekai-preview/runtime.ts` 有两行中文注释导致 `lint:i18n` 失败 | 改成英文注释，不进入 allowlist |
| sitemap 路径 | `generate-sitemaps.mjs` 仍存在旧 `/eventstory/` 路径 | 已改为当前 `/story/event/` 路径 |
| sitemap 覆盖 | detail sitemap 缺少 costumes / mysekai / manga 等详情页 | 已扩展生成源并保留失败回退 |
| 路由漂移 | 页面 metadata path、sitemap main routes、robots noindex/排除分散维护 | 已建立 `seo-routes.ts` registry 与共享 JSON 数据源 |
| hreflang | 当前同一 URL 会随 cookie 输出不同语言 metadata | 暂不启用 hreflang，只预留结构 |
| 日文 SEO | root 与详情模板已有 `ja-JP`，部分页面级 SEO 仍 fallback 到英文 | 后续按核心页面优先精修 |

## 2. 架构目标

### 2.1 路由 registry

新增 `src/lib/seo-routes.ts` 作为可索引主路由的单一来源，字段包括：

```ts
{
  path: "/cards/",
  pageKey: "cards",
  priority: 0.9,
  changefreq: "daily",
  indexable: true,
  sitemapGroup: "main",
}
```

用途：

- 主 sitemap 从 registry 生成。
- metadata path 可逐步对齐 registry。
- 非索引页面统一标记原因，避免 robots、sitemap 与 metadata 漂移。

### 2.2 sitemap 策略

- 主路由：由 registry 生成。
- 详情路由：由构建脚本从 masterdata / manga data 生成。
- 生成失败时：优先保留已有 `sitemap-data.json` 中对应 prefix 的旧 routes，避免构建环境网络波动导致详情页清空。
- XML 输出统一转义，保持可扩展性。

### 2.3 metadata 策略

- 所有页面 canonical 使用 `SITE_BASE_URL + normalizePath(path)`。
- 可索引页面：`index, follow`。
- 开发/跳转/空白页面：`noindex, nofollow` 或不进 sitemap。
- 动态详情页 fallback description 不再只等于 title，而使用 detail fallback 模板 + suffix。
- masterdata 官方名继续作为详情页 title 来源，不强行翻译实体名称。

### 2.4 hreflang 策略

本阶段不启用 hreflang，原因：

- 当前 `/cards`、`/music` 等同一 URL 可因 cookie 输出不同语言 metadata。
- 没有 `/zh-CN/...`、`/en-US/...`、`/ja-JP/...` 等稳定 URL。
- sitemap alternate links 需要稳定 locale URL 后才能安全开启。

未来启用条件：

1. 设计并实现 locale URL 前缀或等价稳定语言 URL。
2. 内部 Link / redirect / canonical 全部 locale-aware。
3. sitemap 输出 alternate links。
4. CDN/缓存策略能区分 locale 页面。
5. Search Console 验证无重复 canonical/hreflang 冲突。

## 3. 推进路线

### P0：守护恢复与旧路径修复

- [x] 清理 `mysekai-preview/runtime.ts` 中文注释。
- [x] `lint:i18n` 恢复通过。
- [x] 修复 sitemap 中旧 `/eventstory/` 路径。
- [x] 确认生成后的 `sitemap-data.json` 不再包含 `/eventstory/`。

### P1：SEO route registry

- [x] 新增 `src/lib/seo-routes.ts`。
- [x] 新增 `src/lib/seo-routes-data.json` 作为 Next 与 Node 脚本共享数据源。
- [x] 将 sitemap main routes 改为从 registry 生成。
- [x] 记录非索引路由：`/blank/`、`/design-system/`、`/leave/`、OAuth flow。
- [x] 保持 robots 与 registry 排除策略一致。

### P2：详情 sitemap 覆盖

- [x] 保留 cards / music / events / gacha / live / character / exchanges。
- [x] 新增 costumes 详情页。
- [x] 新增 mysekai fixtures 详情页。
- [x] 新增 manga 详情页。
- [x] 保留构建失败回退与空详情保护。

### P3：metadata helper 质量

- [x] `buildLocalizedMetadata()` 支持 robots 配置。
- [x] 新增 `noIndexPageMetadata()` helper，`/blank` 与 OAuth flow 已接入。
- [x] 统一详情页 fallback description，避免 fallback description 仅等于 title。
- [x] 逐步减少动态详情页重复 boilerplate：cards / character / costumes / events / exchanges / gacha / live / manga / music / mysekai 已迁到 `dynamicDetailMetadata()`。

### P4：结构化数据

- [x] 将 JSON-LD helper 从 `seo-keywords.ts` 拆到 `structured-data.ts`。
- [x] Root 保留 `WebSite` / `VideoGame`。
- [ ] 评估 `SearchAction` 是否有真实站内搜索 URL 可落地。
- [x] 为分组页/详情页预留 `BreadcrumbList` / `ItemList` helper。

### P5：locale URL / hreflang 专项

- [ ] 决定 URL 策略。
- [ ] 实现 locale-aware Link / redirect / canonical。
- [ ] 输出 hreflang 与 sitemap alternate links。
- [ ] 补齐所有 locale 页面级 SEO 文案。

## 4. 验证清单

每轮 SEO 变更至少执行：

```bash
npm run lint:i18n --prefix web
npm run lint:i18n-usage --prefix web
npm run lint --prefix web
npm run sitemap --prefix web
npm run generate:metadata --prefix web
npm run build:next --prefix web
```

定向检查：

- `public/data/sitemap-data.json` 中不包含 `/eventstory/`。
- `mainRoutes` 来自 registry，非索引页不进入 sitemap。
- `detailRoutes` 覆盖 cards / music / events / gacha / live / character / exchanges / costumes / mysekai / manga。
- `robots.txt` 的 sitemap 地址仍正确。
- 没有在无 locale URL 的情况下输出 hreflang。

## 5. 最近验证记录

### 2026-05-23：大型 SEO 重构启动

当前 baseline：

- `check-i18n-keys.mjs`：`i18n key structure OK (3028 keys across 3 locales)`。
- `check-i18n-usage.mjs`：`Literal i18n usage keys OK`。
- `lint:i18n` 初始失败原因：`src/lib/mysekai-preview/runtime.ts` 两行中文注释；本轮已改为英文注释。
- 新增 `src/lib/seo-routes.ts` 与 `src/lib/seo-routes-data.json`，主 sitemap、robots 排除与 noindex 路由开始共享同一份 registry。
- `npm run sitemap --prefix web` 已成功生成：`Main routes: 54`，`Detail routes: 9717`。
- detail sitemap 新增覆盖 costumes（972）、mysekai fixtures（1395）、manga（354），并将 event story 路径改为 `/story/event/{id}/`。
- `public/data/sitemap-data.json` 已确认不包含 `/eventstory/`。
- `npm run lint:i18n --prefix web && npm run lint:i18n-usage --prefix web` 已通过：`Hardcoded UI Han scan OK (14 allowlisted file groups)` / `Literal i18n usage keys OK`。
- `npm run generate:metadata --prefix web` 已通过：metadata entries 为 cards 1376、musics 676、events 205、gachas 953、characters 26、virtualLives 476、costumes 972、mysekaiFixtures 1395、mangas 354、exchanges 3079。
- `npm run lint --prefix web` 已通过但有既有 warning：`src/app/soundtrack/client.tsx` 的 `react-hooks/exhaustive-deps` missing dependency `handleFilterChange`。
- `npm run build:next --prefix web` 已通过；仅出现已知 `turbopack.root should be absolute` warning。
- 当前 SEO 重构不启用 hreflang，仅修复 sitemap/metadata/robots/canonical 基础设施。

### 2026-05-23：详情页 metadata 与 noindex/robots 对齐推进

本轮新增/调整：

- 新增 `dynamicDetailMetadata()`，将 cards / character / costumes / events / exchanges / gacha / live / manga / music / mysekai 十个动态详情页迁到统一 helper，减少各页面重复的 locale、fallback、description 与 OpenGraph boilerplate。
- `pageMetadata()` 现在会通过 route registry 自动对非索引 `pageKey` 附加 `noIndexRobots()`；`robots.txt` 改为复用 `getRobotsDisallowPaths()`，避免 robots 排除列表与 `NON_INDEXABLE_SEO_ROUTES` 分叉。
- `/leave` 与 `/design-system` 拆为 server page + client body，使两条非索引路由也能输出稳定 `metadata.robots`；i18n hardcoded Han allowlist 同步改到 `design-system/client.tsx`。
- JSON-LD 迁移到 `src/lib/structured-data.ts`；Root 继续输出 `WebSite` / `VideoGame`，并预留 `BreadcrumbList` / `ItemList` helper。
- 移除 SEO locale config 中未使用的 `hreflang` 字段；仍不输出 hreflang，等待稳定 locale URL 策略。
- 补齐 ja-JP 核心页面 SEO 文案：about / cards / music / events / gacha / character / story。
- `npm run sitemap --prefix web` 重新生成 `public/data/sitemap-data.json`：`Main routes: 54`，`Detail routes: 9717`；本次远程数据更新导致 1749 条 detail route lastmod 变化，路由数量与主路由集合未变。

本轮验证：

- `npm run lint:i18n --prefix web`：通过，`Hardcoded UI Han scan OK (15 allowlisted file groups)`。
- `npm run lint:i18n-usage --prefix web`：通过。
- `npm run lint --prefix web`：通过；仍有既有 warning：`src/app/soundtrack/client.tsx` 的 `react-hooks/exhaustive-deps` missing dependency `handleFilterChange`。
- `npm run sitemap --prefix web`：通过，详情页来源均为 fresh。
- `npm run generate:metadata --prefix web`：通过；entries 维持 cards 1376、musics 676、events 205、gachas 953、characters 26、virtualLives 476、costumes 972、mysekaiFixtures 1395、mangas 354、exchanges 3079。
- `npm run build:next --prefix web`：通过；仍有已知 `turbopack.root should be absolute` warning。
