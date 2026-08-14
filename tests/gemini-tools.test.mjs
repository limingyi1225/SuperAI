import test from 'node:test';
import assert from 'node:assert/strict';

// lib/gemini.ts constructs the SDK client at import time.
process.env.GOOGLE_AI_API_KEY ||= 'test-key';

const signature = (tools) => tools.map(tool => Object.keys(tool).join(',')).sort().join('|');

test('image-only attachments keep the code execution tool', async () => {
    const { buildAttemptToolSets } = await import('../lib/gemini.ts');

    const [primary] = buildAttemptToolSets([
        { role: 'user', parts: [{ text: 'hi' }, { inlineData: { mimeType: 'image/png', data: 'x' } }] },
    ]);

    assert.equal(signature(primary), 'codeExecution|googleSearch');
});

test('PDF attachments drop code execution up front', async () => {
    const { buildAttemptToolSets } = await import('../lib/gemini.ts');

    const attempts = buildAttemptToolSets([
        { role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: 'x' } }, { text: 'hi' }] },
    ]);

    assert.equal(signature(attempts[0]), 'googleSearch');
    assert.ok(attempts.every(set => !set.some(tool => 'codeExecution' in tool)));
    assert.equal(signature(attempts[attempts.length - 1]), '');
});

test('the code execution mime type rejection is treated as a tool compatibility error', async () => {
    const { isToolCompatibilityError } = await import('../lib/gemini.ts');

    assert.equal(
        isToolCompatibilityError(new Error('The mime type: application/pdf is not supported for code execution.')),
        true
    );
    assert.equal(isToolCompatibilityError(new Error('429 Resource exhausted')), false);
});
