import type { MessageTree } from "../types";
import { zhTWCommon } from "./common";
import { zhTWPagePrimary } from "./page-primary";
import { zhTWPageSecondaryA } from "./page-secondary-a";
import { zhTWPageSecondaryB } from "./page-secondary-b";
import {
    zhTWLayout,
    zhTWSearch,
    zhTWSettings,
    zhTWShortcuts,
} from "./shell";

export const zhTWMessages = {
    common: zhTWCommon,
    layout: zhTWLayout,
    search: zhTWSearch,
    settings: zhTWSettings,
    shortcuts: zhTWShortcuts,
    page: {
        ...zhTWPagePrimary,
        ...zhTWPageSecondaryA,
        ...zhTWPageSecondaryB,
    },
} as const satisfies MessageTree;
