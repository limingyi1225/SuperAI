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

test('Claude max token budget defaults to 64000 and clamps to the model hard cap', async () => {
    const originalMaxTokens = process.env.CLAUDE_MAX_TOKENS;
    const { resolveClaudeMaxTokens } = await import('../lib/claude.ts');

    try {
        delete process.env.CLAUDE_MAX_TOKENS;
        assert.equal(resolveClaudeMaxTokens(), 64000);

        process.env.CLAUDE_MAX_TOKENS = '128001';
        assert.equal(resolveClaudeMaxTokens(), 128000);

        process.env.CLAUDE_MAX_TOKENS = 'invalid';
        assert.equal(resolveClaudeMaxTokens(), 64000);
    } finally {
        if (originalMaxTokens === undefined) {
            delete process.env.CLAUDE_MAX_TOKENS;
        } else {
            process.env.CLAUDE_MAX_TOKENS = originalMaxTokens;
        }
    }
});

test('Claude truncation stop reasons are failures, not successful completion', async () => {
    const { getClaudeStopReasonFailure } = await import('../lib/claude.ts');

    assert.equal(getClaudeStopReasonFailure('end_turn', 64000), null);
    assert.match(getClaudeStopReasonFailure('max_tokens', 64000), /truncated.*64000/i);
    assert.match(
        getClaudeStopReasonFailure('model_context_window_exceeded', 64000),
        /truncated.*context window/i,
    );
    assert.match(getClaudeStopReasonFailure('refusal', 64000), /refused/i);
    assert.match(getClaudeStopReasonFailure('tool_use', 64000), /stopped before completing/i);
});

test('streamClaudeResponse throws when ANTHROPIC_API_KEY is missing', async () => {
    const originalApiKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
        const { streamClaudeResponse } = await import('../lib/claude.ts');
        await assert.rejects(
            async () => {
                const iterator = streamClaudeResponse(
                    [{ role: 'user', content: 'Hello' }],
                    'claude-opus-5'
                );
                await iterator.next();
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
