import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PROVIDER_MODEL_SLIDERS,
    ensureAtLeastOneProviderModelSelection,
    normalizeProviderModelSelection,
    setProviderModelOrOff,
    setProviderModelSelection,
    toggleProviderSelection,
} from '../lib/customModelSliders.ts';

test('normalizeProviderModelSelection returns selected providers in stable order', () => {
    const selection = normalizeProviderModelSelection([
        'gpt-5.4-high',
        'gemini-3.1-pro-medium',
        'gpt-5.4-pro',
        'claude-opus-4-7',
        'grok-4.20-multi-agent-beta-latest-deep',
    ]);

    assert.deepEqual(selection, [
        'gpt-5.4-high',
        'gemini-3.1-pro-medium',
        'claude-opus-4-7',
        'grok-4.20-multi-agent-beta-latest-deep',
    ]);
});

test('normalizeProviderModelSelection ignores unknown model ids', () => {
    const selection = normalizeProviderModelSelection(['random-model-id']);

    assert.deepEqual(selection, []);
});

test('ensureAtLeastOneProviderModelSelection falls back to openai default', () => {
    const selection = ensureAtLeastOneProviderModelSelection([]);

    assert.deepEqual(selection, [PROVIDER_MODEL_SLIDERS.openai.defaultModelId]);
});

test('setProviderModelSelection swaps only the targeted provider', () => {
    const next = setProviderModelSelection(
        ['gpt-5.4', 'gemini-3.1-pro-medium'],
        'openai',
        'gpt-5.4-pro'
    );

    assert.deepEqual(next, ['gpt-5.4-pro', 'gemini-3.1-pro-medium']);
});

test('setProviderModelSelection ignores invalid model ids', () => {
    const next = setProviderModelSelection(
        ['gpt-5.4', 'gemini-3.1-pro-medium'],
        'gemini',
        'gpt-5.4-pro'
    );

    assert.deepEqual(next, ['gpt-5.4', 'gemini-3.1-pro-medium']);
});

test('toggleProviderSelection can disable providers but keeps at least one', () => {
    const onlyOpenAI = toggleProviderSelection(
        ['gpt-5.4', 'gemini-3.1-pro-medium'],
        'gemini'
    );
    assert.deepEqual(onlyOpenAI, ['gpt-5.4']);

    const cannotDisableLast = toggleProviderSelection(
        onlyOpenAI,
        'openai'
    );
    assert.deepEqual(cannotDisableLast, ['gpt-5.4']);

    const reenableGemini = toggleProviderSelection(
        cannotDisableLast,
        'gemini'
    );
    assert.deepEqual(reenableGemini, ['gpt-5.4', PROVIDER_MODEL_SLIDERS.gemini.defaultModelId]);
});

test('setProviderModelOrOff supports off option while keeping at least one model', () => {
    const oneModel = setProviderModelOrOff(['gpt-5.4', 'gemini-3.1-pro-medium'], 'gemini', null);
    assert.deepEqual(oneModel, ['gpt-5.4']);

    const stillOne = setProviderModelOrOff(oneModel, 'openai', null);
    assert.deepEqual(stillOne, ['gpt-5.4']);

    const reenable = setProviderModelOrOff(stillOne, 'claude', 'claude-opus-4-7');
    assert.deepEqual(reenable, ['gpt-5.4', 'claude-opus-4-7']);
});

test('toggleProviderSelection enables grok with its default preset', () => {
    const next = toggleProviderSelection(['gpt-5.4', 'claude-opus-4-7'], 'xai');

    assert.deepEqual(next, [
        'gpt-5.4',
        'claude-opus-4-7',
        PROVIDER_MODEL_SLIDERS.xai.defaultModelId,
    ]);
});

test('setProviderModelSelection swaps grok preset without affecting other providers', () => {
    const next = setProviderModelSelection(
        ['gpt-5.4', 'grok-4.20-multi-agent-beta-latest'],
        'xai',
        'grok-4.20-multi-agent-beta-latest-deep'
    );

    assert.deepEqual(next, ['gpt-5.4', 'grok-4.20-multi-agent-beta-latest-deep']);
});
