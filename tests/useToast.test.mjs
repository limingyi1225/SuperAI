import test from 'node:test';
import assert from 'node:assert/strict';
import { TOAST_DISPLAY_MS, TOAST_EXIT_MS } from '../lib/hookUtils.ts';

test('toast display duration is 3700ms', () => {
    assert.equal(TOAST_DISPLAY_MS, 3700);
});

test('toast exit animation duration is 300ms', () => {
    assert.equal(TOAST_EXIT_MS, 300);
});

test('total toast lifetime is TOAST_DISPLAY_MS + TOAST_EXIT_MS', () => {
    assert.equal(TOAST_DISPLAY_MS + TOAST_EXIT_MS, 4000);
});
