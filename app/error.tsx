'use client';

import { useEffect } from 'react';

export default function RouteError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Route error:', error);
    }, [error]);

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: 'var(--color-text-primary, #111)',
                background: 'var(--color-bg-primary, #fff)',
            }}
        >
            <div style={{ maxWidth: 480, width: '100%' }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                    Something went wrong
                </h2>
                <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16, opacity: 0.7 }}>
                    An unexpected error interrupted this view. You can try again, or refresh the page.
                </p>
                {error.digest && (
                    <p style={{ fontSize: 12, fontFamily: 'monospace', opacity: 0.5, marginBottom: 16 }}>
                        Error reference: {error.digest}
                    </p>
                )}
                <button
                    onClick={() => reset()}
                    style={{
                        padding: '8px 16px',
                        fontSize: 14,
                        borderRadius: 6,
                        border: '1px solid currentColor',
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                    }}
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
