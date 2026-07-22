"use client";

import type { CSSProperties } from "react";

import { useI18n } from "@/contexts/I18nContext";
import { getCharacterName } from "@/lib/i18n";
import { getLyricsPerformerColors } from "@/lib/lyrics-colors";

interface LyricTextProps {
    text: string;
    performerIds: number[];
}

type PerformerStyle = CSSProperties & {
    "--performer-light"?: string;
    "--performer-dark"?: string;
};

export default function LyricText({ text, performerIds }: LyricTextProps) {
    const { t } = useI18n();
    const performers = performerIds
        .map((id) => ({
            id,
            colors: getLyricsPerformerColors(id),
            name: getCharacterName(t, id),
            shortName: getCharacterName(t, id, "short"),
        }))
        .filter((performer): performer is {
            id: number;
            colors: { base: string; light: string; dark: string };
            name: string;
            shortName: string;
        } => Boolean(performer.colors));
    const names = performers.map((performer) => performer.name).join(", ");
    const ariaLabel = names ? `${names}: ${text}` : text;

    if (performers.length === 1) {
        const colors = performers[0].colors;
        const style: PerformerStyle = {
            "--performer-light": colors.light,
            "--performer-dark": colors.dark,
        };
        return (
            <p
                aria-label={ariaLabel}
                className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed font-medium text-[var(--performer-light)] dark:text-[var(--performer-dark)]"
                style={style}
            >
                {text}
            </p>
        );
    }

    return (
        <p
            aria-label={ariaLabel}
            className="text-primary-text whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed"
        >
            {text}
            {performers.length > 1 && (
                <sup className="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap align-super leading-none" aria-hidden="true">
                    {performers.map((performer, index) => (
                        <span
                            key={`${performer.id}-${index}`}
                            title={performer.name}
                            className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1 py-0.5 text-[9px] font-bold leading-none text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                            <span
                                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--performer-light)] ring-1 ring-slate-400/50 dark:bg-[var(--performer-dark)]"
                                style={{
                                    "--performer-light": performer.colors.light,
                                    "--performer-dark": performer.colors.dark,
                                } as PerformerStyle}
                            />
                            <span>{performer.shortName}</span>
                        </span>
                    ))}
                </sup>
            )}
        </p>
    );
}
