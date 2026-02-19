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
        'gpt-5.2-high',
        'gemini-3.1-pro-medium',
        'gpt-5.2-pro',
        'claude-opus-4-6',
    ]);

    assert.deepEqual(selection, [
        'gpt-5.2-high',
        'gemini-3.1-pro-medium',
        'claude-opus-4-6',
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
        ['gpt-5.2', 'gemini-3.1-pro-medium'],
        'openai',
        'gpt-5.2-pro'
    );

    assert.deepEqual(next, ['gpt-5.2-pro', 'gemini-3.1-pro-medium']);
});

test('setProviderModelSelection ignores invalid model ids', () => {
    const next = setProviderModelSelection(
        ['gpt-5.2', 'gemini-3.1-pro-medium'],
        'gemini',
        'gpt-5.2-pro'
    );

    assert.deepEqual(next, ['gpt-5.2', 'gemini-3.1-pro-medium']);
});

test('toggleProviderSelection can disable providers but keeps at least one', () => {
    const onlyOpenAI = toggleProviderSelection(
        ['gpt-5.2', 'gemini-3.1-pro-medium'],
        'gemini'
    );
    assert.deepEqual(onlyOpenAI, ['gpt-5.2']);

    const cannotDisableLast = toggleProviderSelection(
        onlyOpenAI,
        'openai'
    );
    assert.deepEqual(cannotDisableLast, ['gpt-5.2']);

    const reenableGemini = toggleProviderSelection(
        cannotDisableLast,
        'gemini'
    );
    assert.deepEqual(reenableGemini, ['gpt-5.2', PROVIDER_MODEL_SLIDERS.gemini.defaultModelId]);
});

test('setProviderModelOrOff supports off option while keeping at least one model', () => {
    const oneModel = setProviderModelOrOff(['gpt-5.2', 'gemini-3.1-pro-medium'], 'gemini', null);
    assert.deepEqual(oneModel, ['gpt-5.2']);

    const stillOne = setProviderModelOrOff(oneModel, 'openai', null);
    assert.deepEqual(stillOne, ['gpt-5.2']);

    const reenable = setProviderModelOrOff(stillOne, 'claude', 'claude-opus-4-6');
    assert.deepEqual(reenable, ['gpt-5.2', 'claude-opus-4-6']);
});
