"use client";

import { motion } from "framer-motion";

interface ScoreChangeBadgeProps {
    scoreDelta: number;
}

export default function ScoreChangeBadge({ scoreDelta }: ScoreChangeBadgeProps) {
    if (scoreDelta === 0) {
        return <span className="text-[9px] text-slate-400 dark:text-slate-500">—</span>;
    }

    const positive = scoreDelta > 0;

    return (
        <motion.span
            key={scoreDelta}
            initial={{ scale: 1.2, opacity: 0, y: positive ? 4 : -4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className={`inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[9px] font-bold ${
                positive
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
            }`}
        >
            <span className="text-[8px]">{positive ? "▲" : "▼"}</span>
            {positive ? "+" : ""}{scoreDelta.toLocaleString()}
        </motion.span>
    );
}
