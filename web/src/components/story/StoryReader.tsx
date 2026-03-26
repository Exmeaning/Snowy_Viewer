"use client";
/**
 * StoryReader — 通用剧情阅读器组件
 *
 * 负责：
 * - 根据 serverSource 决定 lang（jp/cn）
 * - JP 时尝试加载翻译并 merge
 * - asset 缺失时显示路径提示
 * - 统一的加载/错误/内容 UI
 */
import { StorySnippet } from "@/components/story/StorySnippet";
import { IProcessedScenarioData } from "@/types/story";
import { useTheme } from "@/contexts/ThemeContext";

interface StoryReaderProps {
    /** 已处理好的剧情数据（含翻译） */
    scenarioData: IProcessedScenarioData | null;
    isLoading: boolean;
    error: string | null;
    /** 如果是 StoryAssetMissingError，传入缺失路径 */
    missingPaths?: string[];
    /** 结尾标签，如"第 1 话" */
    endLabel?: string;
    /** 翻译来源标记 */
    translationSource?: "official_cn" | "llm" | "human";
}

export function StoryReader({
    scenarioData,
    isLoading,
    error,
    missingPaths,
    endLabel,
    translationSource,
}: StoryReaderProps) {
    const { useLLMTranslation } = useTheme();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 border-4 border-miku/30 border-t-miku rounded-full animate-spin mb-4" />
                <p className="text-slate-500">正在加载剧情...</p>
            </div>
        );
    }

    if (missingPaths && missingPaths.length > 0) {
        return (
            <div className="p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm">
                <p className="font-bold text-amber-800 dark:text-amber-300 mb-2">Asset 文件缺失</p>
                <p className="text-amber-700 dark:text-amber-400 mb-3">
                    该剧情的 asset 文件尚未收录到镜像仓库，以下路径均不存在：
                </p>
                <ul className="space-y-1">
                    {missingPaths.map((p) => (
                        <li key={p} className="font-mono text-xs bg-amber-100 dark:bg-amber-900/40 px-3 py-1.5 rounded break-all text-amber-900 dark:text-amber-200">
                            {p}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                <p className="font-bold">加载失败</p>
                <p>{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-2 text-red-500 underline hover:no-underline"
                >
                    重试
                </button>
            </div>
        );
    }

    if (!scenarioData) return null;

    return (
        <div className="max-w-4xl mx-auto">
            {/* 出场角色 */}
            {scenarioData.characters.length > 0 && (
                <div className="mb-6 p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">出场角色</h3>
                    <div className="flex flex-wrap gap-2">
                        {scenarioData.characters.map((char) => (
                            <span
                                key={char.id}
                                className="px-3 py-1 bg-miku/10 text-miku text-sm font-medium rounded-full border border-miku/20"
                            >
                                {char.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* 剧情内容 */}
            <div className="space-y-1">
                {scenarioData.actions.map((action, index) => (
                    <StorySnippet key={index} action={action} />
                ))}
            </div>

            {/* 结尾 */}
            {scenarioData.actions.length > 0 && (
                <div className="text-center py-8 text-slate-400">
                    <p>— {endLabel ?? "结束"} —</p>
                    {useLLMTranslation && (translationSource === "llm" || translationSource === "human") && (
                        <p className="text-xs mt-2 italic">
                            翻译文本来源于 moesekai 的 AI 翻译
                            {translationSource === "human" ? "（经人工精校）" : ""}，转载请表明出处。
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
