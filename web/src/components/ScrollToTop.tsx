"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

export default function ScrollToTop() {
    const [isVisible, setIsVisible] = useState(false);
    const [isTapAnimating, setIsTapAnimating] = useState(false);
    const [isInteracting, setIsInteracting] = useState(false);

    // Ref to manage the release-delay timer so we can cancel it on re-press
    const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Ref to track whether the scroll action is still running
    const scrollingRef = useRef(false);

    const clearReleaseTimer = useCallback(() => {
        if (releaseTimerRef.current !== null) {
            clearTimeout(releaseTimerRef.current);
            releaseTimerRef.current = null;
        }
    }, []);

    // Toggle visibility based on scroll position
    useEffect(() => {
        const toggleVisibility = () => {
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener("scroll", toggleVisibility);

        return () => window.removeEventListener("scroll", toggleVisibility);
    }, []);

    // Clean up timer on unmount
    useEffect(() => {
        return () => clearReleaseTimer();
    }, [clearReleaseTimer]);

    // Custom smooth scroll handler
    const scrollToTop = () => {
        // Keep interaction active during scroll
        clearReleaseTimer();
        setIsInteracting(true);
        scrollingRef.current = true;

        setIsTapAnimating(true);
        window.setTimeout(() => setIsTapAnimating(false), 280);

        window.setTimeout(() => {
            const start = window.scrollY;
            if (start <= 0) {
                scrollingRef.current = false;
                // Delayed deactivation after action completes
                releaseTimerRef.current = setTimeout(() => {
                    setIsInteracting(false);
                }, 400);
                return;
            }
            const startTime = performance.now();
            const duration = 800; // 0.8s duration for smoother feel

            // Easing function: easeOutCubic
            const easeOutCubic = (t: number): number => {
                return 1 - Math.pow(1 - t, 3);
            };

            const animateScroll = (currentTime: number) => {
                const timeElapsed = currentTime - startTime;
                const progress = Math.min(timeElapsed / duration, 1);

                // Calculate new position
                const ease = easeOutCubic(progress);
                window.scrollTo(0, start * (1 - ease));

                if (progress < 1) {
                    requestAnimationFrame(animateScroll);
                } else {
                    scrollingRef.current = false;
                    // Delayed deactivation after scroll completes
                    releaseTimerRef.current = setTimeout(() => {
                        setIsInteracting(false);
                    }, 400);
                }
            };

            requestAnimationFrame(animateScroll);
        }, 90);
    };

    const handlePressStart = () => {
        clearReleaseTimer();
        setIsInteracting(true);
    };

    const handlePressEnd = () => {
        // If still scrolling, let the scroll completion handle deactivation
        if (scrollingRef.current) return;
        // Delay the release so the visual state persists briefly (matches PC hover feel)
        clearReleaseTimer();
        releaseTimerRef.current = setTimeout(() => {
            setIsInteracting(false);
        }, 400);
    };

    return (
        <button
            onClick={scrollToTop}
            onPointerDown={handlePressStart}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onPointerCancel={handlePressEnd}
            /* Round is kept — this is one of the two genuinely circular objects in
               the shell, the same exception .hh-dock-icon claims. What goes is the
               glass: an opaque --hh-surface-2 face with a 1px border replaces the
               translucent fill and the colored accent glow, and the hover lift is
               dropped so the only transform left is the press. The active state is
               a solid accent fill, matching how the side rail marks its current
               row. */
            className={`hh-press hh-focusable fixed bottom-10 right-8 p-3 rounded-[var(--hh-radius-full)] border shadow-[var(--hh-shadow-float)] transition-[opacity,transform,background-color,border-color,color] duration-[var(--hh-dur-screen)] ease-[var(--hh-ease-out)] z-[100] group ${isVisible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-10 scale-90 pointer-events-none"
                } ${isInteracting
                    ? "bg-[var(--hh-accent)] border-[var(--hh-accent-deep)] text-[var(--hh-text-on-accent)]"
                    : "bg-[var(--hh-surface-2)] border-[var(--hh-border)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-accent)] hover:border-[var(--hh-accent-deep)] hover:text-[var(--hh-text-on-accent)]"
                }`}
            aria-label="Scroll to top"
        >
            <svg
                className={`w-6 h-6 transition-transform duration-[var(--hh-dur-screen)] ease-[var(--hh-ease-out)] ${isTapAnimating ? "scroll-top-icon-tap" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 15l7-7 7 7"
                />
            </svg>
        </button>
    );
}
