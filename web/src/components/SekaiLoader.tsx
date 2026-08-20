"use client";
import { useEffect, useState } from "react";

export default function SekaiLoader() {
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<'loading' | 'waiting' | 'complete'>('loading');

  useEffect(() => {
    // Phase 1: Fast load to 90% (0.5s)
    const waitTimer = setTimeout(() => {
      setPhase('waiting');
    }, 500);

    // Simulate actual loading completion after 1.5s
    const loadTimer = setTimeout(() => {
      setPhase('complete');
      // Hide overlay after completion animation (400ms matches CSS transition)
      const hideTimer = setTimeout(() => setLoading(false), 400);
      return () => clearTimeout(hideTimer);
    }, 1500);

    return () => {
      clearTimeout(waitTimer);
      clearTimeout(loadTimer);
    };
  }, []);

  if (!loading) return null;

  return (
    <>
      <style jsx global>{`
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          /* Fully opaque, no backdrop-filter. This is a boot screen, not a
             translucent veil: it must hide the page underneath completely, and
             28px of live blur on a full-viewport layer is exactly the compositor
             cost the flat system exists to remove. --hh-surface-0 is the page
             ground, so the handoff to the real page is a value match rather than
             a visible curtain lift. */
          background-color: var(--hh-surface-0);

          transition: opacity 0.4s var(--hh-ease-out), visibility 0.4s var(--hh-ease-out);
        }

        .loading-overlay.hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        /* Wordmark progress meter */
        .loader-container {
          position: relative;
          width: min(400px, 60vw);
          aspect-ratio: 6 / 1;
          margin-bottom: 20px;
        }

        /* Common mask style */
        .miku-layer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          -webkit-mask-image: url('/loading.webp');
          mask-image: url('/loading.webp');
          -webkit-mask-size: contain;
          mask-size: contain;
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
          -webkit-mask-position: center;
          mask-position: center;
        }

        /* Unfilled portion — a sunken trough, the same relationship .hh-well has
           to a tile, so the fill below reads as a level rising in a channel. */
        .base {
          background-color: var(--hh-surface-inset);
          z-index: 1;
        }
        
        /* Progress wrapper */
        .progress-wrapper {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 0%;
          overflow: hidden;
          z-index: 2;
          transition: width 0.3s var(--hh-ease-out);
        }
        
        /* Phase animations */
        .progress-wrapper.loading {
          animation: miku-load-fast 0.5s var(--hh-ease-out) forwards;
        }
        .progress-wrapper.waiting {
          width: 90%;
        }
        .progress-wrapper.complete {
          width: 100%;
        }

        /* Filled portion — flat accent, no drop-shadow bloom. */
        .progress-color {
          width: min(400px, 60vw);
          height: 100%;
          background-color: var(--hh-accent);
        }
        
        @keyframes miku-load-fast {
          0% { width: 0%; }
          100% { width: 90%; }
        }
        
        .loading-text {
          color: var(--hh-text-secondary);
          font-weight: 700;
          font-size: 0.6875rem;
          letter-spacing: var(--hh-tracking-label);
          text-transform: uppercase;
          animation: hh-loader-blink 1.5s var(--hh-ease-in-out) infinite;
        }
        @keyframes hh-loader-blink {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }

        /* The blink is a status indicator, not decoration, so it degrades to a
           steady state rather than disappearing. */
        @media (prefers-reduced-motion: reduce) {
          .loading-text {
            animation: none;
            opacity: 0.85;
          }
        }
      `}</style>

      <div className={`loading-overlay ${phase === 'complete' ? "hidden" : ""}`}>
        <div className="loader-container">
          <div className="miku-layer base"></div>
          <div className={`progress-wrapper ${phase}`}>
            <div className="miku-layer progress-color"></div>
          </div>
        </div>
        <div className="loading-text">Connecting to SEKAI...</div>
      </div>
    </>
  );
}
