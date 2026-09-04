# 全站详情页“深度语义 SEO 壳 + 纯净 CSR 交互岛”技术架构方案 (Detail Pages Semantic SEO & Clean Island Architecture)

> **核心宗旨**：将网站内所有实体详情页（卡牌、音乐、活动、扭蛋、角色、服装等）升级为**“深度语义 SEO 壳 + 纯净 CSR 交互岛”**架构。
> - **人类玩家**：交互界面维持 100% 纯净 CSR，读取本地个性化设置（自选区服、主题、滑块等），**零感知差异、零多服冲突、零视觉跳变**；
> - **搜索引擎爬虫**：首屏直出高密度、全字段的**语义化 HTML（`<article className="sr-only">`）与深度 JSON-LD 结构化数据**，长尾关键词 100% 覆盖；
> - **网关加速**：结合 Go 网关的**“跨版本持久缓存（180天）”**与**“闲时抢占式预热引擎”**，为搜索引擎提供 `<1ms` 极速直出。

---

## 1. 核心价值与背景复盘

### 1.1 传统全量视觉 SSR 的困境与阻抗失配
在早期的探索中，曾尝试将人类交互的复杂 UI（播放器、3D 模型、卡面特训切换等）直接在服务端用 Mock 假数据强制吐出。但在 PJSK 这类高频跨服、多语言的特殊场景下，存在不可调和的矛盾：
1. **区服与用户偏好撕裂**：用户在客户端保存了 `server-source`（如中文界面玩日服、查看美服独占曲等），服务端 SSR 无法知晓客户端本地存储；强行预渲染单一服数据会导致视觉闪烁、状态错乱或独占曲报错。
2. **UI 侵入与维护成本畸高**：每个页面必须拼装复杂的 Mock 实体（如 `createCardFromMeta`, `createMusicFromMeta`），导致客户端代码臃肿且极易引发 Hydration Mismatch。

### 1.2 解决方案：渐进增强与语义隔离（Progressive Enhancement）
- **人类要视觉与交互**：人类玩家并不需要服务端预渲染死板的按钮，他们需要的是流畅的动画、自己的区服偏好、可播放的音频与即时交互。
- **爬虫要结构与词汇**：搜索引擎蜘蛛根本不在乎好看的按钮和 CSS 阴影，它们只需要首屏 HTML 中包含：**全称、数值白值、技能全文本、作词作曲编曲、各难度物量与定数、关联活动网状链接**。

因此，将**爬虫语义（Semantic Shell）**与**人类交互（Client Island）**彻底解耦，是多服 Web 应用唯一的银弹解法。

---

## 2. 总体技术架构：双车道调度与语义隔离闭环

```mermaid
flowchart TD
    subgraph Gateway["Go 网关层 (main.go & internal/htmlcache)"]
        Req[外部请求: 真实用户 / 搜索引擎爬虫] --> CheckCache{Go 磁盘缓存是否命中?}
        CheckCache -- HIT (<1ms) --> RetCached[直接返回本地静态 HTML]
        CheckCache -- MISS --> MarkExtActive[原子计数: activeExternalRequests++]
        MarkExtActive --> HiPriBuild[高优直通车道: 立即调用 Next.js SSR 渲染]
        HiPriBuild --> SaveDisk[持久化存入磁盘缓存 (180天)]
        SaveDisk --> DecExtActive[原子计数: activeExternalRequests--]
        DecExtActive --> RetLive[返回给客户端]
    end

    subgraph IdleWarmup["闲时后台预构建车道 (internal/htmlcache/warmup.go)"]
        Start[服务器就绪 / 自动部署上线] --> ScanDiff[读取 Sitemap: 仅找出未被缓存的页面]
        ScanDiff --> Loop[取出待预热 URL]
        Loop --> YieldCheck{是否有外部请求? activeExternalRequests > 0}
        YieldCheck -- 外部有流量 --> Backoff[立即避让挂起 200~300ms]
        Backoff --> YieldCheck
        YieldCheck -- 闲时完全无请求 --> LowPriBuild[受控节流调用 Next.js 预渲染 (单并发)]
        LowPriBuild --> SaveWarm[写入持久化磁盘缓存]
        SaveWarm --> Sleep[强制冷却 80ms (平滑 CPU)]
        Sleep --> Loop
    end

    subgraph NextSSR["Next.js 服务端渲染输出结构"]
        HeadMeta["1. <head> Meta 标签 (Title, OG, Twitter, Canonical)"]
        JsonLd["2. 深度 JSON-LD Schema (<script type='application/ld+json'>)"]
        SemanticShell["3. 深度语义 SEO 壳 (<article className='sr-only'>)"]
        ClientIsland["4. 客户端交互岛 (<ClientIslandComponent />)"]
    end

    HiPriBuild --> NextSSR
    LowPriBuild --> NextSSR
```

---

## 3. 深度语义 SEO 壳规范 (`DetailSemanticSeoShell`)

### 3.1 视觉完全隐藏规范 (`sr-only`)
- 彻底摒弃旧版在页面底部渲染视觉卡片的突兀做法；
- 根容器使用标准无障碍隐藏类 `sr-only`：
  ```css
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
  ```
- **搜索引擎合规性（100% White-Hat SEO）**：
  - 隐藏内容与页面真实展示的主题 100% 对应（歌曲/卡牌的事实数据），绝非关键词堆砌或恶意障眼法（Cloaking）；
  - Google / 百度官方明确支持为屏幕阅读器（Screen Reader）与无障碍访问提供的语义文本；
  - 视力正常的人类玩家在屏幕上完全看不到它（0 像素视觉占用），体验完全零侵扰。

### 3.2 深度语义内容大纲（高价值长尾词提取）

| 模块类型 | 核心提取维度（爬虫可读取的语义标签） |
|---|---|
| **卡牌 (`cards`)** | `<h1>` 角色全名与卡牌前缀<br/>`<p>` 稀有度星级、初始与特训后属性分类<br/>`<table>` 满级三值（表现力/技巧/体能）与综合力白值表<br/>`<dl>` 技能全称、初始与满级效果完整描述<br/>`<ul>` 关联活动名称、专属卡池名称、关联服装名称 |
| **音乐 (`music`)** | `<h1>` 歌曲全名与发音（Pronunciation）<br/>`<p>` 作词、作曲、编曲全称、歌曲时长、BPM、标签<br/>`<table>` 各难度（Easy/Normal/Hard/Expert/Master/Append）等级、NOTE 物量、社区定数<br/>`<dl>` 演唱版本清单（虚拟歌手/各组合 SEKAI 角色版本）<br/>`<ul>` 关联活动、所属乐团 |
| **活动 (`events`)** | `<h1>` 活动名称与期数<br/>`<p>` 活动类型（Marathon/Cheer/Carnival）、开始与结束时间<br/>`<dl>` 加成角色清单、加成属性说明、活动专属故事简介<br/>`<ul>` 排位奖励卡牌清单、关联卡池 |
| **扭蛋 (`gacha`)** | `<h1>` 卡池全名<br/>`<p>` 卡池类型、开放起止时间、抽取保底与天井规则<br/>`<ul>` Pick-Up 特别 UP 卡牌清单与对应概率 |
| **服装 (`costumes`)** | `<h1>` 服装名称与所属角色<br/>`<dl>` 部件分类（发型/服装/配件）、获取方式与兑换要求<br/>`<p>` 设计大赛来源与作者致谢信息 |
| **角色 (`character`)** | `<h1>` 角色全名与罗马音<br/>`<dl>` 个人资料（所属乐团、生日、身高、声优/CV、性格爱好）<br/>`<ul>` 代表乐曲清单、相关四格漫画 |

---

## 4. 全站各详情页任务跟踪表 (Roadmap & Checklist)

> **开发规范**：每个详情页只增补其服务端 SEO 语义壳与 JSON-LD，**绝不侵入修改其客户端富交互逻辑**。完成后及时更新勾选状态。

| 模块路由 | 页面类型 | 爬虫语义核心内容 (Semantic Shell) | 改造状态 | 完成日期 |
|---|---|---|:---:|:---:|
| **`/cards/[id]`** | 卡牌详情 | 角色名、满级白值表格、技能全描述、关联活动/卡池 | **[x] 已完成** | 2026-09-04 |
| **`/music/[id]`** | 歌曲详情 | 作词作曲编曲、全难度等级物量表、BPM、演唱阵容 | **[x] 已完成** | 2026-09-04 |
| **`/events/[id]`** | 活动详情 | 活动类型、起止时间、加成属性角色、排位奖励卡牌 | **[x] 已完成** | 2026-09-04 |
| **`/gacha/[id]`** | 扭蛋详情 | 卡池类型、UP 卡牌清单、规则与保底说明 | **[x] 已完成** | 2026-09-04 |
| **`/costumes/[id]`** | 服装详情 | 服装所属角色、部件清单、获取方式说明 | **[x] 已完成** | 2026-09-04 |
| **`/character/[id]`** | 角色详情 | 个人档案（生日/身高/CV）、所属乐团、代表曲目 | **[x] 已完成** | 2026-09-04 |
| **`/exchanges/[id]`** | 兑换所详情 | 兑换所分类、可兑换道具清单、消耗代币说明 | **[x] 已完成** | 2026-09-04 |
| **`/live/[id]`** | Virtual Live | 演出海报、登场角色、曲目列表、场次时间表 | **[x] 已完成** | 2026-09-04 |
| **`/manga/[id]`** | 漫画/四格 | 漫画标题、期数、登场角色关联 | **[x] 已完成** | 2026-09-04 |
| **`/mysekai/[id]`** | 家具/设施 | 家具分类、摆放限制、制作材料清单说明 | **[x] 已完成** | 2026-09-04 |
| **`/lyrics/[musicId]`** | 歌词详情 | 歌词全文大纲、作词者、关联歌曲信息 | **[x] 已完成** | 2026-09-04 |
| **`/guides/[id]`** | 攻略文章 | 攻略标题、分类、作者、文章正文大纲 | **[x] 已完成** | 2026-09-04 |

---

## 5. 统一标准化落地流程 (Standard 3-Step Recipe)

为任一模块（以 `cards/[id]` 或 `music/[id]` 为例）落地实施时，仅需遵循极其干净的 3 步：

1. **Step 1: 编写语义壳组件**：
   - 在 `DetailSemanticSeoShell.tsx` 中使用标准语义 HTML（`<h1>`, `<table>`, `<dl>`, `<ul>`）渲染高密度文本事实。
   - 外层包裹 `className="sr-only"`。
2. **Step 2: 在服务端工厂挂载**：
   - 在 `web/src/lib/seo-detail-metadata.ts` 对应的 preset 中挂载该语义组件。
   - 服务端输出的 HTML 自动包含：`<head>` Meta + JSON-LD + `<article className="sr-only">` 语义壳。
3. **Step 3: 保持客户端纯净**：
   - 客户端组件维持原本最自然的 CSR 逻辑，不写 Mock 假数据，无缝读取玩家 `server-source` 正常交互。

---

## 6. Docker 容器卷持久化配置 (Container Volume Configuration)

容器运行环境内部设计了双层持久化存储，均挂载于 `/app/data` 目录下：

```yaml
# docker-compose.yml 示例
services:
  moesekai:
    image: ...
    volumes:
      - moesekai_data:/app/data
    environment:
      - STATIC_ARCHIVE_DIR=/app/data/static_archive # Next.js 跨版本不可变静态块 (永久归档)
      - HTML_CACHE_DIR=/app/data/html_cache         # Go 网关 SSR HTML 持久缓存 (180天淘汰)
```

- **`/app/data/static_archive`**: Next.js 静态 chunk 归档。每次部署启动时，`start.sh` 会自动同步当前镜像的 `_next/static` 到该目录，确保发布新版本后，老客户端加载旧 chunk 绝不 404。
- **`/app/data/html_cache`**: Go 网关的 SSR 磁盘缓存目录。已由 `HTML_CACHE_DIR` 环境变量明确配置并由 `start.sh` 自动创建赋权。
  - 缓存文件名按 SHA-256 索引，伴随 `.json` 元数据与原始 HTML。
  - 闲时预热引擎（Warmup）与外部爬虫访问生成的 HTML 将直接存入该目录，重启或重建容器不丢失。


