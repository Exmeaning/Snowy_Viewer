"use client";

import React from "react";

export type HandheldMarkType = "pip" | "square" | "tick" | "bracket" | "chevron";

export interface HandheldMarkProps {
    type: HandheldMarkType;
    className?: string;
    size?: "xs" | "sm" | "md" | "lg";
    color?: string;
    tone?: "default" | "accent" | "muted";
    accent?: boolean;
    /** Accessible label when the mark conveys standalone semantic status */
    ariaLabel?: string;
    children?: React.ReactNode;
}

const SIZE_MAP: Record<HandheldMarkType, Record<"xs" | "sm" | "md" | "lg", string>> = {
    pip: {
        xs: "w-1.5 h-1.5",
        sm: "w-2 h-2",
        md: "w-2.5 h-2.5",
        lg: "w-3.5 h-3.5",
    },
    square: {
        xs: "w-2 h-2",
        sm: "w-2.5 h-2.5",
        md: "w-3.5 h-3.5",
        lg: "w-5 h-5",
    },
    tick: {
        xs: "w-1.5 h-3",
        sm: "w-2 h-4",
        md: "w-2.5 h-5",
        lg: "w-3 h-6",
    },
    bracket: {
        xs: "text-[10px] tracking-tight",
        sm: "text-xs tracking-tight",
        md: "text-sm tracking-normal",
        lg: "text-base tracking-normal",
    },
    chevron: {
        xs: "w-2.5 h-2.5",
        sm: "w-3.5 h-3.5",
        md: "w-4.5 h-4.5",
        lg: "w-6 h-6",
    },
};

/**
 * HandheldMark renders one of the 5 console semantic geometric tokens:
 * - pip: tiny 45deg diamond / dot (used for live status, active indicators, sub-headings)
 * - square: solid precision square (used for selected states, stop/checkpoint)
 * - tick: vertical micro-bar/notch (used for section start, item delimiters)
 * - bracket: structural framing brackets [ ] (used for technical labels, IDs, coordinates)
 * - chevron: directional indicator > (used for navigation, drills, steps)
 */
export function HandheldMark({
    type,
    className = "",
    size = "sm",
    color,
    tone = "default",
    accent = false,
    ariaLabel,
    children,
}: HandheldMarkProps) {
    const sizeCls = SIZE_MAP[type]?.[size] ?? SIZE_MAP[type]?.sm ?? "";
    const resolvedTone = accent ? "accent" : tone;
    const toneCls =
        resolvedTone === "accent"
            ? "hh-mark-accent"
            : resolvedTone === "muted"
            ? "hh-mark-muted"
            : "";

    const style: React.CSSProperties = color ? { color } : {};

    if (type === "pip") {
        return (
            <span
                role={ariaLabel ? "img" : undefined}
                aria-label={ariaLabel}
                aria-hidden={!ariaLabel}
                className={`hh-mark-pip ${sizeCls} ${toneCls} ${className}`}
                style={style}
            />
        );
    }

    if (type === "square") {
        return (
            <span
                role={ariaLabel ? "img" : undefined}
                aria-label={ariaLabel}
                aria-hidden={!ariaLabel}
                className={`hh-mark-square ${sizeCls} ${toneCls} ${className}`}
                style={style}
            />
        );
    }

    if (type === "tick") {
        return (
            <span
                role={ariaLabel ? "img" : undefined}
                aria-label={ariaLabel}
                aria-hidden={!ariaLabel}
                className={`hh-mark-tick ${sizeCls} ${toneCls} ${className}`}
                style={style}
            />
        );
    }

    if (type === "bracket") {
        return (
            <span
                role={ariaLabel ? "img" : undefined}
                aria-label={ariaLabel}
                aria-hidden={!ariaLabel && !children}
                className={`font-mono select-none font-bold inline-flex items-center gap-1 text-(--hh-text-tertiary) ${sizeCls} ${toneCls} ${className}`}
                style={style}
            >
                <span>[</span>
                {children ?? null}
                <span>]</span>
            </span>
        );
    }

    return (
        <svg
            role={ariaLabel ? "img" : undefined}
            aria-label={ariaLabel}
            aria-hidden={!ariaLabel}
            className={`hh-mark-chevron ${sizeCls} ${toneCls} ${className}`}
            style={style}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
    );
}

export default HandheldMark;
