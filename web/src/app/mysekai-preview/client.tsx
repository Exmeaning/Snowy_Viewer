"use client";

import MainLayout from "@/components/MainLayout";
import MysekaiScenePreview from "@/components/mysekai-preview/MysekaiScenePreview";
import { LOCAL_TEST_LAYOUT_URL } from "@/lib/mysekai-preview/assets";

export default function MysekaiPreviewClient() {
    return (
        <MainLayout>
            <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
                <div className="mb-6 text-center">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-miku/30 bg-miku/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-miku">
                        MySekai Preview
                    </div>
                    <h1 className="text-3xl font-black text-primary-text sm:text-4xl">
                        烤森<span className="text-miku">预览</span>
                    </h1>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
                        当前使用本地测试 JSON（{LOCAL_TEST_LAYOUT_URL}）验证布局、OBJ 与纹理载入；资源路径由 master data 的 assetbundleName / handleType 规则推导，不列桶、不轮询。
                    </p>
                </div>

                <MysekaiScenePreview />
            </div>
        </MainLayout>
    );
}
