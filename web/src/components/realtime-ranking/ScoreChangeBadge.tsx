"use client";

import { motion } from "framer-motion";

interface ScoreChangeBadgeProps {
    scoreDelta: number;
}

export default function ScoreChangeBadge({ scoreDelta }: ScoreChangeBadgeProps) {
    if (scoreDelta === 0) {
        return <span className="text-[9px] text-[var(--hh-text-tertiary)]">—</span>;
    }

    const positive = scoreDelta > 0;

    return (
        <motion.span
            key={scoreDelta}
            initial={{ scale: 1.2, opacity: 0, y: positive ? 4 : -4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className={`hh-numeric inline-flex items-center gap-0.5 rounded-[var(--hh-radius-sm)] px-1 py-0.5 text-[9px] font-bold ${
                positive
                    ? "bg-emerald-500/15 text-emerald-700"
                    : "bg-rose-500/15 text-rose-700"
            }`}
        >
            <span className="text-[8px]">{positive ? "▲" : "▼"}</span>
            {positive ? "+" : ""}{scoreDelta.toLocaleString()}
        </motion.span>
    );
}
