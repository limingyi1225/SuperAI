import test from 'node:test';
import assert from 'node:assert/strict';

const originalApiKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = originalApiKey || 'test-key';

const {
    buildOpenAIResponsesRequestBody,
    resolveOpenAIModel,
    resolveOpenAIReasoningMode,
} = await import('../lib/openai.ts');

if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
} else {
    process.env.OPENAI_API_KEY = originalApiKey;
}

test('GPT 5.6 Sol Pro preset resolves to Sol with Pro reasoning mode', () => {
    assert.equal(resolveOpenAIModel('gpt-5.6-sol-pro'), 'gpt-5.6-sol');
    assert.equal(resolveOpenAIReasoningMode('gpt-5.6-sol-pro'), 'pro');
});

test('retired Max preset defensively resolves to the new Pro mode', () => {
    assert.equal(resolveOpenAIModel('gpt-5.6-sol-max'), 'gpt-5.6-sol');
    assert.equal(resolveOpenAIReasoningMode('gpt-5.6-sol-max'), 'pro');
});

test('Pro request sends mode pro with xhigh effort', () => {
    const body = buildOpenAIResponsesRequestBody(
        'gpt-5.6-sol',
        'xhigh',
        [{ role: 'user', content: [{ type: 'input_text', text: 'Hello' }] }],
        [],
        'pro',
    );

    assert.deepEqual(body.reasoning, {
        effort: 'xhigh',
        summary: 'auto',
        mode: 'pro',
    });
});

test('standard request omits the optional reasoning mode field', () => {
    const body = buildOpenAIResponsesRequestBody(
        'gpt-5.6-sol',
        'xhigh',
        'Hello',
        [],
    );

    assert.deepEqual(body.reasoning, {
        effort: 'xhigh',
        summary: 'auto',
    });
});
