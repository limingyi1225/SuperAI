import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDragState } from '../lib/hookUtils.ts';

test('entering with files increments counter and sets isDragging true', () => {
    const result = computeDragState(0, 1, true);
    assert.equal(result.counter, 1);
    assert.equal(result.isDragging, true);
});

test('entering without files increments counter but does not set isDragging', () => {
    const result = computeDragState(0, 1, false);
    assert.equal(result.counter, 1);
    assert.equal(result.isDragging, false);
});

test('nested drag enter increments counter further', () => {
    const result = computeDragState(1, 1, true);
    assert.equal(result.counter, 2);
    assert.equal(result.isDragging, true);
});

test('leaving with counter > 1 decrements counter but keeps isDragging true', () => {
    const result = computeDragState(2, -1, true);
    assert.equal(result.counter, 1);
    assert.equal(result.isDragging, true);
});

test('leaving with counter = 1 sets counter to 0 and isDragging false', () => {
    const result = computeDragState(1, -1, true);
    assert.equal(result.counter, 0);
    assert.equal(result.isDragging, false);
});

test('leaving with counter = 0 does not go below 0', () => {
    const result = computeDragState(0, -1, false);
    assert.equal(result.counter, -1);
    assert.equal(result.isDragging, false);
});
