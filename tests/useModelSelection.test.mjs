import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeModelIds, resolveInitialModels, FALLBACK_MODELS } from '../lib/hookUtils.ts';

test('sanitizeModelIds filters out unknown model ids', () => {
    const result = sanitizeModelIds(['gemini-3.6-flash', 'not-a-real-model', 'gpt-5.6-sol']);
    assert.ok(result.includes('gemini-3.6-flash'));
    assert.ok(result.includes('gpt-5.6-sol'));
    assert.ok(!result.includes('not-a-real-model'));
});

test('sanitizeModelIds deduplicates model ids', () => {
    const result = sanitizeModelIds(['gemini-3.6-flash', 'gemini-3.6-flash']);
    assert.equal(result.length, 1);
    assert.equal(result[0], 'gemini-3.6-flash');
});

test('sanitizeModelIds normalizes legacy ids from persisted sessions', () => {
    const result = sanitizeModelIds([
        'gemini-3.5-flash',
        'claude-opus-4-7',
        'grok-4.3-latest',
        'gpt-5.5',
        'gpt-5.6-sol-max',
    ]);
    assert.deepEqual(result, [
        'gemini-3.6-flash',
        'claude-opus-5',
        'grok-4.6',
        'gpt-5.6-sol',
        'gpt-5.6-sol-pro',
    ]);
});

test('sanitizeModelIds returns empty array for non-array input', () => {
    assert.deepEqual(sanitizeModelIds(null), []);
    assert.deepEqual(sanitizeModelIds('gemini-3.6-flash'), []);
    assert.deepEqual(sanitizeModelIds(42), []);
    assert.deepEqual(sanitizeModelIds(undefined), []);
});

test('sanitizeModelIds returns empty array for empty array', () => {
    assert.deepEqual(sanitizeModelIds([]), []);
});

test('sanitizeModelIds filters non-string entries', () => {
    const result = sanitizeModelIds(['gemini-3.6-flash', 123, null, undefined, 'gpt-5.6-sol']);
    assert.deepEqual(result.sort(), ['gemini-3.6-flash', 'gpt-5.6-sol'].sort());
});

test('sanitizeModelIds keeps grok preset', () => {
    const result = sanitizeModelIds(['grok-4.6']);
    assert.deepEqual(result, ['grok-4.6']);
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
    const json = JSON.stringify(['gemini-3.6-flash', 'gpt-5.6-sol']);
    const result = resolveInitialModels(json);
    assert.deepEqual(result, ['gemini-3.6-flash', 'gpt-5.6-sol']);
});

test('resolveInitialModels filters invalid ids from mixed JSON input', () => {
    const json = JSON.stringify(['gemini-3.6-flash', 'not-real', 'gpt-5.6-sol']);
    const result = resolveInitialModels(json);
    assert.ok(result.includes('gemini-3.6-flash'));
    assert.ok(result.includes('gpt-5.6-sol'));
    assert.ok(!result.includes('not-real'));
});

test('FALLBACK_MODELS includes grok-4.6', () => {
    assert.ok(FALLBACK_MODELS.includes('grok-4.6'));
});

test('resolveInitialModels preserves persisted grok custom selections', () => {
    const json = JSON.stringify(['gpt-5.6-sol', 'grok-4.6']);
    const result = resolveInitialModels(json);

    assert.deepEqual(result, ['gpt-5.6-sol', 'grok-4.6']);
});
