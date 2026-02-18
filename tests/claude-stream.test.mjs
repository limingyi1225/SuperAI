import test from 'node:test';
import assert from 'node:assert/strict';
import { streamClaudeResponse } from '../lib/claude.ts';

function buildSseResponse(payloadChunks) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            for (const chunk of payloadChunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    });

    return new Response(stream, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/event-stream' },
    });
}

test('stream error events are surfaced as stream errors, not parse errors', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-api-key';

    globalThis.fetch = async () => buildSseResponse([
        'event: error\n',
        'data: {"type":"error","error":{"message":"Overloaded"}}\n\n',
    ]);

    try {
        await assert.rejects(
            async () => {
                for await (const _ of streamClaudeResponse(
                    [{ role: 'user', content: 'Hello' }],
                    'claude-opus-4-6'
                )) {
                    // No stream content is expected in this scenario.
                }
            },
            /Claude stream error: Overloaded/
        );
    } finally {
        if (originalApiKey === undefined) {
            delete process.env.ANTHROPIC_API_KEY;
        } else {
            process.env.ANTHROPIC_API_KEY = originalApiKey;
        }
        globalThis.fetch = originalFetch;
    }
});
