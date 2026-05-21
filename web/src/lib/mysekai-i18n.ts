import type { MessageInterpolationValues } from "@/lib/i18n/format";

export type MysekaiTranslationFn = (key: string, values?: MessageInterpolationValues) => string;

const MYSEKAI_GENRE_NAME_KEY_PREFIX = "page.mysekai.genreNames";
const MYSEKAI_TAG_NAME_KEY_PREFIX = "page.mysekai.tagNames";
const MYSEKAI_TAG_FRAGMENT_KEY_PREFIX = "page.mysekai.tagNameFragments";

function translateDictionaryLabel(t: MysekaiTranslationFn, keyPrefix: string, source: string): string | null {
    const key = `${keyPrefix}.${source}`;
    const label = t(key);
    return label === key ? null : label;
}

function translateTagFragment(t: MysekaiTranslationFn, fragmentKey: string, fallback: string): string {
    const key = `${MYSEKAI_TAG_FRAGMENT_KEY_PREFIX}.${fragmentKey}`;
    const label = t(key);
    return label === key ? fallback : label;
}

export function getMysekaiGenreDisplayName(name: string, t: MysekaiTranslationFn): string {
    return translateDictionaryLabel(t, MYSEKAI_GENRE_NAME_KEY_PREFIX, name) ?? name;
}

export function getMysekaiTagDisplayName(name: string, t: MysekaiTranslationFn): string {
    const exactLabel = translateDictionaryLabel(t, MYSEKAI_TAG_NAME_KEY_PREFIX, name);
    if (exactLabel) return exactLabel;

    const cleanName = name.replace(/ー/g, "一").replace(/ベ/g, "べ").replace(/ビ/g, "び");
    if (cleanName !== name) {
        const cleanLabel = translateDictionaryLabel(t, MYSEKAI_TAG_NAME_KEY_PREFIX, cleanName);
        if (cleanLabel) return cleanLabel;
    }

    if (name.includes("テーブル") || name.includes("テ一ブル")) {
        return name.replace(/テ[^ブル]*ブル/, translateTagFragment(t, "table", "Table"));
    }
    if (name.includes("チェア")) return name.replace("チェア", translateTagFragment(t, "chair", "Chair"));
    if (name.includes("ソファ")) return name.replace("ソファ", translateTagFragment(t, "sofa", "Sofa"));
    if (name.includes("ベッド")) return name.replace("ベッド", translateTagFragment(t, "bed", "Bed"));
    if (name.includes("ライト")) return name.replace("ライト", translateTagFragment(t, "light", "Light"));
    if (name.includes("キッチン")) return name.replace("キッチン", translateTagFragment(t, "kitchen", "Kitchen"));
    if (name.includes("ル—ム") || name.includes("ル一ム") || name.includes("ルーム")) {
        return name.replace(/ル[^ム]*ム/, translateTagFragment(t, "room", "Room"));
    }

    return name;
}
