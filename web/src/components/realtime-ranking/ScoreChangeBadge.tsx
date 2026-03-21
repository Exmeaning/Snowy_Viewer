"use client";

import { motion } from "framer-motion";

interface ScoreChangeBadgeProps {
    scoreDelta: number;
}

export default function ScoreChangeBadge({ scoreDelta }: ScoreChangeBadgeProps) {
    if (scoreDelta === 0) {
        return <span className="text-[11px] text-slate-400 dark:text-slate-500">无变化</span>;
    }

    const positive = scoreDelta > 0;

    return (
        <motion.span
            key={scoreDelta}
            initial={{ scale: 0.9, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${positive ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
        >
            <span>{positive ? "+" : ""}{scoreDelta.toLocaleString()}</span>
        </motion.span>
    );
}
