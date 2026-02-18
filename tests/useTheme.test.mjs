import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTimeBasedTheme, AUTO_DARK_START_HOUR, AUTO_DARK_END_HOUR } from '../lib/hookUtils.ts';

test('resolveTimeBasedTheme returns dark at AUTO_DARK_START_HOUR', () => {
    const date = new Date();
    date.setHours(AUTO_DARK_START_HOUR, 0, 0, 0);
    assert.equal(resolveTimeBasedTheme(date), 'dark');
});

test('resolveTimeBasedTheme returns dark after midnight', () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    assert.equal(resolveTimeBasedTheme(date), 'dark');
});

test('resolveTimeBasedTheme returns dark before AUTO_DARK_END_HOUR', () => {
    const date = new Date();
    date.setHours(AUTO_DARK_END_HOUR - 1, 59, 0, 0);
    assert.equal(resolveTimeBasedTheme(date), 'dark');
});

test('resolveTimeBasedTheme returns light at AUTO_DARK_END_HOUR', () => {
    const date = new Date();
    date.setHours(AUTO_DARK_END_HOUR, 0, 0, 0);
    assert.equal(resolveTimeBasedTheme(date), 'light');
});

test('resolveTimeBasedTheme returns light at noon', () => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    assert.equal(resolveTimeBasedTheme(date), 'light');
});

test('resolveTimeBasedTheme returns light just before AUTO_DARK_START_HOUR', () => {
    const date = new Date();
    date.setHours(AUTO_DARK_START_HOUR - 1, 59, 0, 0);
    assert.equal(resolveTimeBasedTheme(date), 'light');
});
