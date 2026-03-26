'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Detect ChunkLoadError (caused by stale CDN cache after deployment)
        // Automatically reload the page to fetch the latest chunks
        const isChunkError =
            error.name === 'ChunkLoadError' ||
            error.message?.includes('ChunkLoadError') ||
            error.message?.includes('Loading chunk') ||
            error.message?.includes('Failed to fetch dynamically imported module');

        if (isChunkError) {
            // Use sessionStorage to prevent infinite reload loops
            const reloadKey = 'chunk-error-reload';
            const lastReload = sessionStorage.getItem(reloadKey);
            const now = Date.now();

            if (!lastReload || now - parseInt(lastReload) > 10000) {
                // Only auto-reload if we haven't reloaded in the last 10 seconds
                sessionStorage.setItem(reloadKey, now.toString());
                window.location.reload();
                return;
            }
        }
    }, [error]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
        }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
                页面加载出错了
            </h2>
            <p style={{ color: '#666', marginBottom: '1.5rem', maxWidth: '400px' }}>
                这可能是由于网络问题或页面更新导致的，请尝试刷新页面。
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'var(--color-miku, #33aaee)',
                        color: 'white',
                        fontSize: '1rem',
                        cursor: 'pointer',
                    }}
                >
                    刷新页面
                </button>
                <button
                    onClick={reset}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        backgroundColor: 'transparent',
                        fontSize: '1rem',
                        cursor: 'pointer',
                    }}
                >
                    重试
                </button>
            </div>
        </div>
    );
}
