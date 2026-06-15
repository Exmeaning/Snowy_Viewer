"use client";

import { useEffect, useState } from "react";

// A single module-level ticker shared by every consumer, so hundreds of board
// rows can display live relative time without each spinning up its own timer.
// Only leaf components that actually render relative time should subscribe, so
// the 1s re-render stays cheap and never touches heavy rows (avatars/honors).

type Subscriber = (now: number) => void;

const subscribers = new Set<Subscriber>();
let timer: number | null = null;
let currentNow = Date.now();

function ensureTimer() {
    if (timer != null || typeof window === "undefined") return;
    timer = window.setInterval(() => {
        currentNow = Date.now();
        for (const cb of subscribers) cb(currentNow);
    }, 1000);
}

function stopTimerIfIdle() {
    if (subscribers.size === 0 && timer != null) {
        window.clearInterval(timer);
        timer = null;
    }
}

/** Subscribe to the shared 1-second clock. Returns the current epoch ms. */
export function useSharedNow(): number {
    const [now, setNow] = useState(() => currentNow);

    useEffect(() => {
        const cb: Subscriber = (n) => setNow(n);
        subscribers.add(cb);
        ensureTimer();
        return () => {
            subscribers.delete(cb);
            stopTimerIfIdle();
        };
    }, []);

    return now;
}
