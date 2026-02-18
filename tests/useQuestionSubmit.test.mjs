import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestionText, clipHistoryText, MAX_CHARS_PER_TURN } from '../lib/hookUtils.ts';

// buildQuestionText tests

test('buildQuestionText returns just question text when no files', () => {
    const result = buildQuestionText('What is 2+2?', []);
    assert.equal(result, 'What is 2+2?');
});

test('buildQuestionText appends pdf file content', () => {
    const files = [{ id: '1', type: 'pdf', content: 'PDF content here', name: 'doc.pdf' }];
    const result = buildQuestionText('Explain this', files);
    assert.ok(result.includes('Explain this'));
    assert.ok(result.includes('PDF content here'));
});

test('buildQuestionText appends text file content', () => {
    const files = [{ id: '1', type: 'text', content: 'text file content', name: 'notes.txt' }];
    const result = buildQuestionText('Read this', files);
    assert.ok(result.includes('Read this'));
    assert.ok(result.includes('text file content'));
});

test('buildQuestionText does not include image file content', () => {
    const files = [{ id: '1', type: 'image', content: 'data:image/png;base64,abc', name: 'img.png' }];
    const result = buildQuestionText('Describe this image', files);
    assert.ok(result.includes('Describe this image'));
    assert.ok(!result.includes('data:image/png;base64,abc'));
});

test('buildQuestionText joins segments with double newline', () => {
    const files = [{ id: '1', type: 'pdf', content: 'file content', name: 'doc.pdf' }];
    const result = buildQuestionText('My question', files);
    assert.ok(result.includes('My question\n\nfile content'));
});

test('buildQuestionText handles empty question text with file content', () => {
    const files = [{ id: '1', type: 'text', content: 'only file text', name: 'a.txt' }];
    const result = buildQuestionText('', files);
    assert.equal(result.trim(), 'only file text');
});

test('buildQuestionText appends multiple file contents in order', () => {
    const files = [
        { id: '1', type: 'pdf', content: 'first file', name: 'a.pdf' },
        { id: '2', type: 'text', content: 'second file', name: 'b.txt' },
    ];
    const result = buildQuestionText('Question', files);
    const firstIdx = result.indexOf('first file');
    const secondIdx = result.indexOf('second file');
    assert.ok(firstIdx < secondIdx, 'first file should appear before second file');
});

// clipHistoryText tests

test('clipHistoryText does not truncate text shorter than MAX_CHARS_PER_TURN', () => {
    const short = 'hello world';
    assert.equal(clipHistoryText(short), short);
});

test('clipHistoryText truncates text at exactly MAX_CHARS_PER_TURN characters', () => {
    const long = 'a'.repeat(MAX_CHARS_PER_TURN + 500);
    const result = clipHistoryText(long);
    assert.equal(result.length, MAX_CHARS_PER_TURN);
});

test('clipHistoryText returns full text when length equals MAX_CHARS_PER_TURN', () => {
    const exact = 'b'.repeat(MAX_CHARS_PER_TURN);
    const result = clipHistoryText(exact);
    assert.equal(result.length, MAX_CHARS_PER_TURN);
    assert.equal(result, exact);
});

test('clipHistoryText handles empty string', () => {
    assert.equal(clipHistoryText(''), '');
});

test('MAX_CHARS_PER_TURN is 12000', () => {
    assert.equal(MAX_CHARS_PER_TURN, 12000);
});
