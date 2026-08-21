"use client";

import React, { ReactNode } from "react";
import HandheldMark from "./HandheldMark";

export interface HandheldEmptyStateProps {
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

/**
 * Handheld OS empty state.
 *
 * Uses the project's geometric vocabulary (corner bracket viewfinder + diamond pip
 * + hairline divider) instead of oversized clipart or heavy nested cards.
 */
export default function HandheldEmptyState({
    title,
    description,
    action,
    className = "",
}: HandheldEmptyStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}
            role="status"
        >
            {/* Viewfinder geometric reticle */}
            <div className="hh-frame-bracket relative flex items-center justify-center w-16 h-16 mb-4 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-md)] border border-[var(--hh-border)]">
                <HandheldMark type="pip" size="md" className="opacity-60" />
                <span className="absolute -bottom-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--hh-accent)] opacity-40" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--hh-accent)]" />
                </span>
            </div>

            <h3 className="hh-title text-base text-[var(--hh-text-primary)] mb-1">
                {title}
            </h3>

            {description && (
                <p className="hh-body text-xs text-[var(--hh-text-secondary)] max-w-sm mb-4">
                    {description}
                </p>
            )}

            {action && (
                <div className="mt-2">
                    {action}
                </div>
            )}
        </div>
    );
}

export { HandheldEmptyState };

