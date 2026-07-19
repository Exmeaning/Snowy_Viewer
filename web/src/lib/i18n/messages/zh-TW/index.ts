import type { MessageTree } from "../types";
import { zhCNMessages } from "../zh-CN";

export const zhTWMessages = {
    ...zhCNMessages,
    settings: {
        ...zhCNMessages.settings,
        uiLanguage: {
            ...zhCNMessages.settings.uiLanguage,
            sectionTitle: "介面語言",
            label: "介面語言",
            description: "切換網站介面的顯示語言",
            options: {
                ...zhCNMessages.settings.uiLanguage.options,
                zhCN: "簡體中文",
                zhTW: "繁體中文 (TW)",
            },
        },
    },
    page: {
        ...zhCNMessages.page,
        setup: {
            ...zhCNMessages.page.setup,
            languageTitle: "選擇語言",
            languageDesc: "請選擇介面語言。您隨時可以在設定中變更。",
            languageOptionSubtitles: {
                ...zhCNMessages.page.setup.languageOptionSubtitles,
                "zh-CN": "簡體中文 / Simplified Chinese",
                "zh-TW": "繁體中文 (TW) / Traditional Chinese",
            },
        },
    },
} satisfies MessageTree;
