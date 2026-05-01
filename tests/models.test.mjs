import test from 'node:test';
import assert from 'node:assert/strict';
import {
    AVAILABLE_MODELS,
    REASONING_TIERS,
    normalizeModelId,
    resolveRequestedModels,
} from '../lib/models.ts';

test('resolveRequestedModels deduplicates aliased requests but preserves first requested id', () => {
    const resolved = resolveRequestedModels([
        'gemini-3.1-pro',
        'claude-opus-4-6',
        'claude-opus-4-7',
        'gpt-5.5',
    ]);

    assert.deepEqual(resolved.map(model => ({
        requestedId: model.requestedId,
        canonicalId: model.canonicalId,
        name: model.config?.name,
    })), [
        {
            requestedId: 'gemini-3.1-pro',
            canonicalId: 'gemini-3.1-pro',
            name: 'Gemini 3.1 Pro (High)',
        },
        {
            requestedId: 'claude-opus-4-6',
            canonicalId: 'claude-opus-4-7',
            name: 'Claude Opus 4.7 (High)',
        },
        {
            requestedId: 'gpt-5.5',
            canonicalId: 'gpt-5.5',
            name: 'GPT 5.5',
        },
    ]);
});

test('AVAILABLE_MODELS includes grok-4.3-latest', () => {
    const modelIds = AVAILABLE_MODELS.map(model => model.id);
    assert.ok(modelIds.includes('grok-4.3-latest'));
});

test('REASONING_TIERS.deep includes grok-4.3-latest', () => {
    assert.ok(REASONING_TIERS.deep.includes('grok-4.3-latest'));
});

test('normalizeModelId maps legacy Claude Opus 4.6 ids to 4.7', () => {
    assert.equal(normalizeModelId('claude-opus-4-6'), 'claude-opus-4-7');
    assert.equal(normalizeModelId('claude-opus-4-6-high'), 'claude-opus-4-7-high');
    assert.equal(normalizeModelId('claude-opus-4-6-low'), 'claude-opus-4-7-low');
});

test('AVAILABLE_MODELS contains the Claude Opus 4.7 tier variants', () => {
    const ids = AVAILABLE_MODELS.map(m => m.id);
    assert.ok(ids.includes('claude-opus-4-7'));
    assert.ok(ids.includes('claude-opus-4-7-high'));
    assert.ok(ids.includes('claude-opus-4-7-low'));
});

test('REASONING_TIERS.deep references Claude Opus 4.7 (not 4.6)', () => {
    assert.ok(REASONING_TIERS.deep.includes('claude-opus-4-7'));
    assert.ok(!REASONING_TIERS.deep.includes('claude-opus-4-6'));
});

test('resolveRequestedModels deduplicates 4.6 and 4.7 via alias', () => {
    const resolved = resolveRequestedModels(['claude-opus-4-6', 'claude-opus-4-7']);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].canonicalId, 'claude-opus-4-7');
});
