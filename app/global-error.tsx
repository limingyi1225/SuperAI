'use client';

import { useEffect } from 'react';

// Global error boundary — catches errors that escape the root layout itself.
// Per Next.js, this MUST render its own <html> + <body>.
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Global error:', error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    minHeight: '100vh',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    color: '#111',
                    background: '#fff',
                }}
            >
                <div style={{ maxWidth: 480, width: '100%' }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                        Application error
                    </h2>
                    <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16, opacity: 0.7 }}>
                        A critical error prevented the page from loading. Please refresh the page.
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
                            border: '1px solid #111',
                            background: 'transparent',
                            color: 'inherit',
                            cursor: 'pointer',
                        }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
