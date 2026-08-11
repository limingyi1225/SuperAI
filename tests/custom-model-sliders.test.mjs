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
        'gpt-5.6-sol',
        'gemini-3.6-flash',
        'gpt-5.6-sol-pro',
        'claude-opus-5',
        'grok-4.5',
    ]);

    assert.deepEqual(selection, [
        'gpt-5.6-sol',
        'gemini-3.6-flash',
        'claude-opus-5',
        'grok-4.5',
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
        ['gpt-5.6-sol', 'gemini-3.6-flash'],
        'openai',
        'gpt-5.6-sol-pro'
    );

    assert.deepEqual(next, ['gpt-5.6-sol-pro', 'gemini-3.6-flash']);
});

test('setProviderModelSelection ignores invalid model ids', () => {
    const next = setProviderModelSelection(
        ['gpt-5.6-sol', 'gemini-3.6-flash'],
        'gemini',
        'gpt-5.6-sol-pro'
    );

    assert.deepEqual(next, ['gpt-5.6-sol', 'gemini-3.6-flash']);
});

test('setProviderModelSelection swaps between the two Claude models', () => {
    const next = setProviderModelSelection(
        ['gpt-5.6-sol', 'claude-opus-5'],
        'claude',
        'claude-fable-5'
    );

    assert.deepEqual(next, ['gpt-5.6-sol', 'claude-fable-5']);
});

test('toggleProviderSelection can disable providers but keeps at least one', () => {
    const onlyOpenAI = toggleProviderSelection(
        ['gpt-5.6-sol', 'gemini-3.6-flash'],
        'gemini'
    );
    assert.deepEqual(onlyOpenAI, ['gpt-5.6-sol']);

    const cannotDisableLast = toggleProviderSelection(
        onlyOpenAI,
        'openai'
    );
    assert.deepEqual(cannotDisableLast, ['gpt-5.6-sol']);

    const reenableGemini = toggleProviderSelection(
        cannotDisableLast,
        'gemini'
    );
    assert.deepEqual(reenableGemini, ['gpt-5.6-sol', PROVIDER_MODEL_SLIDERS.gemini.defaultModelId]);
});

test('setProviderModelOrOff supports off option while keeping at least one model', () => {
    const oneModel = setProviderModelOrOff(['gpt-5.6-sol', 'gemini-3.6-flash'], 'gemini', null);
    assert.deepEqual(oneModel, ['gpt-5.6-sol']);

    const stillOne = setProviderModelOrOff(oneModel, 'openai', null);
    assert.deepEqual(stillOne, ['gpt-5.6-sol']);

    const reenable = setProviderModelOrOff(stillOne, 'claude', 'claude-opus-5');
    assert.deepEqual(reenable, ['gpt-5.6-sol', 'claude-opus-5']);
});

test('toggleProviderSelection enables grok with its default preset', () => {
    const next = toggleProviderSelection(['gpt-5.6-sol', 'claude-opus-5'], 'xai');

    assert.deepEqual(next, [
        'gpt-5.6-sol',
        'claude-opus-5',
        PROVIDER_MODEL_SLIDERS.xai.defaultModelId,
    ]);
});

test('setProviderModelSelection setting grok to its only preset is a no-op when already active', () => {
    const next = setProviderModelSelection(
        ['gpt-5.6-sol', 'grok-4.5'],
        'xai',
        'grok-4.5'
    );

    assert.deepEqual(next, ['gpt-5.6-sol', 'grok-4.5']);
});
