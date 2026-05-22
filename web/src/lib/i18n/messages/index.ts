import { DEFAULT_UI_LOCALE, type UiLocale } from "../locales";
import type { MessageTree } from "./types";
import { zhCNMessages } from "./zh-CN";
import { enUSMessages } from "./en-US";
import { jaJPMessages } from "./ja-JP";

export const messagesByLocale: Record<UiLocale, MessageTree> = {
    "zh-CN": zhCNMessages,
    "en-US": enUSMessages,
    "ja-JP": jaJPMessages,
};

export const fallbackMessages = messagesByLocale[DEFAULT_UI_LOCALE];
