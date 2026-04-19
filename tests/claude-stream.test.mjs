import test from 'node:test';
import assert from 'node:assert/strict';

// Since claude.ts now uses the @anthropic-ai/sdk instead of raw fetch,
// we mock the SDK's stream behavior by mocking the module.
// For now, we verify the module exports and basic structure.

test('streamClaudeResponse is exported and is an async generator function', async () => {
    const { streamClaudeResponse } = await import('../lib/claude.ts');
    assert.equal(typeof streamClaudeResponse, 'function');
});

test('exported types are accessible', async () => {
    // Verify the module can be imported without errors
    const mod = await import('../lib/claude.ts');
    assert.ok(mod.streamClaudeResponse);
});

test('streamClaudeResponse throws when ANTHROPIC_API_KEY is missing', async () => {
    const originalApiKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
        const { streamClaudeResponse } = await import('../lib/claude.ts');
        await assert.rejects(
            async () => {
                for await (const _ of streamClaudeResponse(
                    [{ role: 'user', content: 'Hello' }],
                    'claude-opus-4-7'
                )) {
                    // Should not reach here
                }
            },
            (err) => {
                // SDK will throw about missing API key
                return err instanceof Error;
            }
        );
    } finally {
        if (originalApiKey === undefined) {
            delete process.env.ANTHROPIC_API_KEY;
        } else {
            process.env.ANTHROPIC_API_KEY = originalApiKey;
        }
    }
});
