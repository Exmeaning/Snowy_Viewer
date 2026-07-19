import { DEFAULT_UI_LOCALE, type UiLocale } from "../locales";
import type { MessageTree } from "./types";
import { zhCNMessages } from "./zh-CN";
import { zhTWMessages } from "./zh-TW";
import { enUSMessages } from "./en-US";
import { jaJPMessages } from "./ja-JP";
import { koKRMessages } from "./ko-KR";

export const messagesByLocale: Record<UiLocale, MessageTree> = {
    "zh-CN": zhCNMessages,
    "zh-TW": zhTWMessages,
    "en-US": enUSMessages,
    "ja-JP": jaJPMessages,
    "ko-KR": koKRMessages,
};

export const fallbackMessages = messagesByLocale[DEFAULT_UI_LOCALE];
