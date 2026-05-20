import type { MessageTree } from "./messages/types";

export type MessageInterpolationValue = string | number | boolean | null | undefined;
export type MessageInterpolationValues = Record<string, MessageInterpolationValue>;

export function getMessageByPath(messages: MessageTree, key: string): string | null {
    const value = key.split(".").reduce<unknown>((current, segment) => {
        if (current && typeof current === "object" && segment in current) {
            return (current as Record<string, unknown>)[segment];
        }
        return undefined;
    }, messages);

    return typeof value === "string" ? value : null;
}

export function interpolateMessage(template: string, values?: MessageInterpolationValues): string {
    if (!values) return template;

    return template.replace(/\{([\w.-]+)\}/g, (match, token: string) => {
        const value = values[token];
        return value === null || value === undefined ? match : String(value);
    });
}
