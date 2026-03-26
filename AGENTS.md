# Moesekai — AI 开发指南

---



# 一般代码修复提示词：

## 项目概况

这是一个PROJECT SEKAI 的查看器项目。前端 Next.js 16 纯 CSR (`web/`)，后端 Go API (`internal/`)，部署域名 `pjsk.moe`。

## 技术栈

- **前端**: Next.js 16 (`output: "export"`, 纯 CSR), React 19, TypeScript, **Tailwind CSS 4**, framer-motion, echarts
- **后端**: Go (net/http), Redis 缓存 + 内存回退

## 核心架构

### Masterdata — `web/src/lib/fetch.ts`

### 资源管理 — `web/src/lib/assets.ts`

### 类型定义 — `web/src/types/`

## 设计规范

### 请参考 `web/src/app/design-system/page.tsx`


---


# 涉及新功能开发的详细提示词：

## 项目概况

这是一个PROJECT SEKAI 的查看器项目。前端 Next.js 16 纯 CSR (`web/`)，后端 Go API (`internal/`)，部署域名 `pjsk.moe`。

## 技术栈

- **前端**: Next.js 16 (`output: "export"`, 纯 CSR), React 19, TypeScript, **Tailwind CSS 4**, framer-motion, echarts
- **后端**: Go (net/http), Redis 缓存 + 内存回退

## 核心架构

### Masterdata — `web/src/lib/fetch.ts`

### 资源管理 — `web/src/lib/assets.ts`

### 类型定义 — `web/src/types/`

## 设计规范

### 请参考 `web/src/app/design-system/page.tsx`


## 页面模块约定

每个页面遵循以下结构:

```
web/src/app/<module>/
├── page.tsx       # 入口：导出 metadata + 渲染 Client 组件
├── client.tsx     # "use client" 主逻辑组件
├── [id]/          # 动态路由（如适用），纯 CSR
└── detail/        # 详情子页（如适用）
```

- `page.tsx` 必须包含 `export const metadata: Metadata = { title: "Moesekai - xxx" }`
- 所有交互逻辑在 `client.tsx` 中实现（`"use client"`）
- 页面使用 `<MainLayout>` 包裹


## 组件复用

| 需求 | 使用 |
|------|------|
| 筛选/排序/搜索面板 | `components/common/BaseFilters.tsx` (`FilterSection`, `FilterButton`, `FilterToggle`) |
| 外部链接 | `components/ExternalLink.tsx` (自动添加离站确认) |
| 卡牌缩略图 | `components/cards/SekaiCardThumbnail.tsx` |
| 页面布局 | `components/MainLayout.tsx` |
| 加载器 | `.loading-spinner` CSS 类 |

## 滚动位置保存 — `hooks/useScrollRestore.ts`

列表页必须使用 `useScrollRestore` hook，实现从详情页返回时恢复滚动位置和已加载数量：

```tsx
const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
    storageKey: "cards",          // 唯一标识，用于 sessionStorage key
    defaultDisplayCount: 30,      // 默认显示数量
    increment: 30,                // "加载更多" 每次增量
    isReady: !isLoading,          // 数据加载完成后再恢复滚动
});
```

- 基于 `sessionStorage`，浏览器关闭即清除
- 筛选条件变化时调用 `resetDisplayCount()` 清空已保存的位置
- 已在卡牌、音乐、活动、扭蛋、服装、称号、贴纸、漫画、家具等 14+ 页面使用

## Query Param 状态管理

筛选/排序/视图等用户状态应同步到 URL query params，使页面状态可分享、可刷新恢复：

```tsx
const searchParams = useSearchParams();
const router = useRouter();

// 读取：初始化时从 URL 恢复状态
useEffect(() => {
    const tag = searchParams.get("tag");
    const sort = searchParams.get("sortBy");
    // ...将 URL 参数应用到组件 state
}, [searchParams]);

// 写入：状态变化时更新 URL（不触发导航）
const updateURL = (params: Record<string, string>) => {
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([k, v]) =>
        v ? url.searchParams.set(k, v) : url.searchParams.delete(k)
    );
    window.history.replaceState({}, "", url.toString());
};
```

- 使用 `window.history.replaceState` 更新 URL，**不使用** `router.push/replace`（避免不必要的重渲染）
- 常用 param 命名: `search`, `sortBy`, `sortOrder`, `tag`, `characters`, `units`, `attrs`, `rarities`, `page`, `pageSize`
- 参考实现: `music/client.tsx`, `cards/client.tsx`, `my-cards/client.tsx`

## 关键规则

1. **外链需过 ExternalLink**: 所有站外链接使用 `<ExternalLink>` 组件
2. **资源路径大小写敏感**: 生产环境部署区分大小写，资源路径需与实际文件名完全一致
3. **纯 CSR 模式**: 所有页面逻辑在 `client.tsx` 中实现，`page.tsx` 仅导出 metadata

## 新模块/重大变更

生成新模块或重大功能变化时，请在实施计划中：
- 列出关键设计决策并提问，等待用户补充
- 说明对现有模块的影响
- 确认是否需要新增类型定义或扩展现有 Context
