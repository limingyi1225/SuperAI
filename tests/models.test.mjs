import test from 'node:test';
import assert from 'node:assert/strict';
import {
    AVAILABLE_MODELS,
    REASONING_TIERS,
    normalizeModelId,
    resolveRequestedModels,
} from '../lib/models.ts';

test('normalizeModelId maps legacy GPT aliases to canonical ids', () => {
    assert.equal(normalizeModelId('gpt-5.2'), 'gpt-5.4');
    assert.equal(normalizeModelId('gpt-5.2-high'), 'gpt-5.4-high');
    assert.equal(normalizeModelId('gpt-5.2-pro'), 'gpt-5.4-pro');
});

test('resolveRequestedModels deduplicates aliased requests but preserves first requested id', () => {
    const resolved = resolveRequestedModels([
        'gemini-3.1-pro',
        'gpt-5.2',
        'gpt-5.4',
        'claude-sonnet-4-6',
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
            requestedId: 'gpt-5.2',
            canonicalId: 'gpt-5.4',
            name: 'GPT 5.4 (Medium)',
        },
        {
            requestedId: 'claude-sonnet-4-6',
            canonicalId: 'claude-sonnet-4-6',
            name: 'Claude Sonnet 4.6 (High)',
        },
    ]);
});

test('available models include grok fast and deep presets', () => {
    const modelIds = AVAILABLE_MODELS.map(model => model.id);

    assert.ok(modelIds.includes('grok-4.20-multi-agent-beta-latest'));
    assert.ok(modelIds.includes('grok-4.20-multi-agent-beta-latest-deep'));
});

test('reasoning tiers do not include grok (custom only)', () => {
    assert.ok(!REASONING_TIERS.fast.includes('grok-4.20-multi-agent-beta-latest'));
    assert.ok(!REASONING_TIERS.deep.includes('grok-4.20-multi-agent-beta-latest-deep'));
});

test('resolveRequestedModels preserves both grok presets as distinct canonical ids', () => {
    const resolved = resolveRequestedModels([
        'grok-4.20-multi-agent-beta-latest',
        'grok-4.20-multi-agent-beta-latest-deep',
    ]);

    assert.deepEqual(
        resolved.map(model => ({
            requestedId: model.requestedId,
            canonicalId: model.canonicalId,
            provider: model.config?.provider,
        })),
        [
            {
                requestedId: 'grok-4.20-multi-agent-beta-latest',
                canonicalId: 'grok-4.20-multi-agent-beta-latest',
                provider: 'xai',
            },
            {
                requestedId: 'grok-4.20-multi-agent-beta-latest-deep',
                canonicalId: 'grok-4.20-multi-agent-beta-latest-deep',
                provider: 'xai',
            },
        ]
    );
});

test('normalizeModelId maps legacy grok aliases to canonical ids', () => {
    assert.equal(normalizeModelId('grok-4.20-multi-agent-experimental-beta-0304'), 'grok-4.20-multi-agent-beta-latest');
    assert.equal(normalizeModelId('grok-4.20-multi-agent-experimental-beta-0304-deep'), 'grok-4.20-multi-agent-beta-latest-deep');
});
