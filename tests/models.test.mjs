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
        'gemini-3.5-flash',
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
            requestedId: 'gemini-3.5-flash',
            canonicalId: 'gemini-3.7-flash',
            name: 'Gemini 3.7 Flash (High)',
        },
        {
            requestedId: 'claude-opus-4-6',
            canonicalId: 'claude-opus-5',
            name: 'Claude Opus 5 (Extra High)',
        },
        {
            requestedId: 'gpt-5.5',
            canonicalId: 'gpt-5.6-sol',
            name: 'GPT 5.6 Sol (Extra High)',
        },
    ]);
});

test('AVAILABLE_MODELS includes grok-4.6', () => {
    const modelIds = AVAILABLE_MODELS.map(model => model.id);
    assert.ok(modelIds.includes('grok-4.6'));
});

test('REASONING_TIERS.deep includes grok-4.6', () => {
    assert.ok(REASONING_TIERS.deep.includes('grok-4.6'));
});

test('normalizeModelId maps the legacy Claude Opus 4.x ids to Opus 5', () => {
    assert.equal(normalizeModelId('claude-opus-4-6'), 'claude-opus-5');
    assert.equal(normalizeModelId('claude-opus-4-6-high'), 'claude-opus-5');
    assert.equal(normalizeModelId('claude-opus-4-6-low'), 'claude-opus-5');
    assert.equal(normalizeModelId('claude-opus-4-7'), 'claude-opus-5');
    assert.equal(normalizeModelId('claude-sonnet-4-6'), 'claude-opus-5');
});

test('normalizeModelId maps legacy OpenAI, Gemini and Grok ids forward', () => {
    assert.equal(normalizeModelId('gpt-5.5'), 'gpt-5.6-sol');
    assert.equal(normalizeModelId('gpt-5.5-pro'), 'gpt-5.6-sol-pro');
    assert.equal(normalizeModelId('gpt-5.6-sol-max'), 'gpt-5.6-sol-pro');
    assert.equal(normalizeModelId('gemini-3.5-flash'), 'gemini-3.7-flash');
    assert.equal(normalizeModelId('grok-4.3-latest'), 'grok-4.6');
    assert.equal(normalizeModelId('grok-4.5'), 'grok-4.6');
});

test('normalizeModelId passes through ids that were never shipped', () => {
    // The alias table only covers IDs that were live in a released build; anything
    // else falls through untouched and gets filtered out by the callers.
    assert.equal(normalizeModelId('gemini-3.1-pro'), 'gemini-3.1-pro');
    assert.equal(normalizeModelId('grok-4.3'), 'grok-4.3');
});

test('AVAILABLE_MODELS contains the Claude Opus 5 / Fable 5 pair at xhigh effort', () => {
    const byId = new Map(AVAILABLE_MODELS.map(m => [m.id, m]));
    assert.equal(byId.get('claude-opus-5')?.effort, 'xhigh');
    assert.equal(byId.get('claude-fable-5')?.effort, 'xhigh');
});

test('AVAILABLE_MODELS contains the GPT 5.6 Sol standard and Pro presets', () => {
    const byId = new Map(AVAILABLE_MODELS.map(m => [m.id, m]));
    assert.equal(byId.get('gpt-5.6-sol')?.effort, 'xhigh');
    assert.equal(byId.get('gpt-5.6-sol-pro')?.effort, 'xhigh');
    assert.equal(byId.get('gpt-5.6-sol-pro')?.name, 'GPT 5.6 Sol (Pro)');
});

test('REASONING_TIERS.deep references Claude Opus 5 (not the retired 4.x ids)', () => {
    assert.ok(REASONING_TIERS.deep.includes('claude-opus-5'));
    assert.ok(!REASONING_TIERS.deep.includes('claude-opus-4-6'));
    assert.ok(!REASONING_TIERS.deep.includes('claude-opus-4-7'));
});

test('resolveRequestedModels deduplicates 4.6 and 4.7 via alias', () => {
    const resolved = resolveRequestedModels(['claude-opus-4-6', 'claude-opus-4-7']);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].canonicalId, 'claude-opus-5');
});
