import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeModelIds, resolveInitialModels, FALLBACK_MODELS } from '../lib/hookUtils.ts';

test('sanitizeModelIds filters out unknown model ids', () => {
    const result = sanitizeModelIds(['gemini-3.1-pro', 'not-a-real-model', 'gpt-5.4']);
    assert.ok(result.includes('gemini-3.1-pro'));
    assert.ok(result.includes('gpt-5.4'));
    assert.ok(!result.includes('not-a-real-model'));
});

test('sanitizeModelIds deduplicates model ids', () => {
    const result = sanitizeModelIds(['gemini-3.1-pro', 'gemini-3.1-pro']);
    assert.equal(result.length, 1);
    assert.equal(result[0], 'gemini-3.1-pro');
});

test('sanitizeModelIds returns empty array for non-array input', () => {
    assert.deepEqual(sanitizeModelIds(null), []);
    assert.deepEqual(sanitizeModelIds('gemini-3.1-pro'), []);
    assert.deepEqual(sanitizeModelIds(42), []);
    assert.deepEqual(sanitizeModelIds(undefined), []);
});

test('sanitizeModelIds returns empty array for empty array', () => {
    assert.deepEqual(sanitizeModelIds([]), []);
});

test('sanitizeModelIds filters non-string entries', () => {
    const result = sanitizeModelIds(['gemini-3.1-pro', 123, null, undefined, 'gpt-5.4']);
    assert.deepEqual(result.sort(), ['gemini-3.1-pro', 'gpt-5.4'].sort());
});

test('sanitizeModelIds normalizes legacy GPT aliases to canonical ids', () => {
    const result = sanitizeModelIds(['gpt-5.2', 'gpt-5.2-high', 'gpt-5.2-pro']);
    assert.deepEqual(result, ['gpt-5.4', 'gpt-5.4-high', 'gpt-5.4-pro']);
});

test('sanitizeModelIds keeps both grok presets', () => {
    const result = sanitizeModelIds([
        'grok-4.20-multi-agent-beta-latest',
        'grok-4.20-multi-agent-beta-latest-deep',
    ]);

    assert.deepEqual(result, [
        'grok-4.20-multi-agent-beta-latest',
        'grok-4.20-multi-agent-beta-latest-deep',
    ]);
});

test('resolveInitialModels returns FALLBACK_MODELS for empty string', () => {
    const result = resolveInitialModels('');
    assert.deepEqual(result, FALLBACK_MODELS);
});

test('resolveInitialModels returns FALLBACK_MODELS for invalid JSON', () => {
    const result = resolveInitialModels('not-valid-json');
    assert.deepEqual(result, FALLBACK_MODELS);
});

test('resolveInitialModels returns FALLBACK_MODELS when all ids are invalid', () => {
    const result = resolveInitialModels(JSON.stringify(['fake-model-1', 'fake-model-2']));
    assert.deepEqual(result, FALLBACK_MODELS);
});

test('resolveInitialModels returns sanitized models for valid JSON with known ids', () => {
    const json = JSON.stringify(['gemini-3.1-pro', 'gpt-5.4']);
    const result = resolveInitialModels(json);
    assert.deepEqual(result, ['gemini-3.1-pro', 'gpt-5.4']);
});

test('resolveInitialModels filters invalid ids from mixed JSON input', () => {
    const json = JSON.stringify(['gemini-3.1-pro', 'not-real', 'gpt-5.4']);
    const result = resolveInitialModels(json);
    assert.ok(result.includes('gemini-3.1-pro'));
    assert.ok(result.includes('gpt-5.4'));
    assert.ok(!result.includes('not-real'));
});

test('resolveInitialModels migrates legacy GPT ids from localStorage payloads', () => {
    const json = JSON.stringify(['gemini-3.1-pro', 'gpt-5.2', 'gpt-5.2']);
    const result = resolveInitialModels(json);
    assert.deepEqual(result, ['gemini-3.1-pro', 'gpt-5.4']);
});

test('FALLBACK_MODELS does not include grok (custom only)', () => {
    assert.ok(!FALLBACK_MODELS.includes('grok-4.20-multi-agent-beta-latest'));
});

test('resolveInitialModels preserves persisted grok custom selections', () => {
    const json = JSON.stringify([
        'gpt-5.4',
        'grok-4.20-multi-agent-beta-latest-deep',
    ]);
    const result = resolveInitialModels(json);

    assert.deepEqual(result, [
        'gpt-5.4',
        'grok-4.20-multi-agent-beta-latest-deep',
    ]);
});
