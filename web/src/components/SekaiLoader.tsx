"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

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
      // Hide overlay after completion animation
      setTimeout(() => setLoading(false), 300);
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
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          transition: opacity 0.4s ease, visibility 0.4s ease;
        }
        .loading-overlay.hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
        
        /* Miku Loader Container */
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
        
        /* Base layer - light cyan (unloaded) */
        .base {
          background-color: color-mix(in srgb, var(--color-miku) 30%, white);
          opacity: 0.8;
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
          transition: width 0.3s ease-out;
        }
        
        /* Phase animations */
        .progress-wrapper.loading {
          animation: miku-load-fast 0.5s ease-out forwards;
        }
        .progress-wrapper.waiting {
          width: 90%;
        }
        .progress-wrapper.complete {
          width: 100%;
        }
        
        /* Progress color layer */
        .progress-color {
          width: min(400px, 60vw);
          height: 100%;
          background-color: var(--color-miku);
          filter: drop-shadow(0 0 5px var(--color-miku));
        }
        
        @keyframes miku-load-fast {
          0% { width: 0%; }
          100% { width: 90%; }
        }
        
        .loading-text {
          color: var(--color-miku-dark);
          font-family: sans-serif;
          font-weight: bold;
          font-size: 1rem;
          letter-spacing: 0.05em;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className={`loading-overlay ${phase === 'complete' && !loading ? "hidden" : ""}`}>
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
