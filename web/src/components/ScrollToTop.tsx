"use client";
import React, { useEffect, useState } from "react";

export default function ScrollToTop() {
    const [isVisible, setIsVisible] = useState(false);

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

    // Custom smooth scroll handler
    const scrollToTop = () => {
        const start = window.scrollY;
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
            }
        };

        requestAnimationFrame(animateScroll);
    };

    return (
        <button
            onClick={scrollToTop}
            className={`fixed bottom-10 right-8 p-3 rounded-2xl bg-white/80 backdrop-blur-md border border-miku/20 text-miku shadow-lg shadow-miku/10 transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) z-[100] hover:bg-miku hover:text-white hover:shadow-miku/30 hover:-translate-y-1 hover:scale-110 active:scale-95 transform group ${isVisible
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 translate-y-10 scale-90 pointer-events-none"
                }`}
            aria-label="Scroll to top"
        >
            <svg
                className="w-6 h-6 transition-transform duration-500 group-hover:-translate-y-1"
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
