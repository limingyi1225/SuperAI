import test from 'node:test';
import assert from 'node:assert/strict';
import { mapApiFilesToUploadedFiles } from '../lib/hookUtils.ts';

test('mapApiFilesToUploadedFiles sets preview for image type', () => {
    const apiFiles = [{ type: 'image', content: 'data:image/png;base64,abc', name: 'photo.png' }];
    const result = mapApiFilesToUploadedFiles(apiFiles, 1000);
    assert.equal(result[0].preview, 'data:image/png;base64,abc');
    assert.equal(result[0].type, 'image');
    assert.equal(result[0].name, 'photo.png');
    assert.equal(result[0].content, 'data:image/png;base64,abc');
});

test('mapApiFilesToUploadedFiles does not set preview for pdf type', () => {
    const apiFiles = [{ type: 'pdf', content: 'raw pdf text', name: 'doc.pdf' }];
    const result = mapApiFilesToUploadedFiles(apiFiles, 1000);
    assert.equal(result[0].preview, undefined);
    assert.equal(result[0].type, 'pdf');
});

test('mapApiFilesToUploadedFiles does not set preview for text type', () => {
    const apiFiles = [{ type: 'text', content: 'hello world', name: 'notes.txt' }];
    const result = mapApiFilesToUploadedFiles(apiFiles, 1000);
    assert.equal(result[0].preview, undefined);
    assert.equal(result[0].type, 'text');
});

test('mapApiFilesToUploadedFiles generates ids using timestamp-index format', () => {
    const apiFiles = [
        { type: 'text', content: 'a', name: 'a.txt' },
        { type: 'text', content: 'b', name: 'b.txt' },
    ];
    const result = mapApiFilesToUploadedFiles(apiFiles, 9999);
    assert.equal(result[0].id, '9999-0');
    assert.equal(result[1].id, '9999-1');
});

test('mapApiFilesToUploadedFiles produces unique ids for each file', () => {
    const apiFiles = [
        { type: 'text', content: 'a', name: 'a.txt' },
        { type: 'text', content: 'b', name: 'b.txt' },
        { type: 'image', content: 'c', name: 'c.png' },
    ];
    const result = mapApiFilesToUploadedFiles(apiFiles, 42);
    const ids = result.map(f => f.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length);
});

test('mapApiFilesToUploadedFiles returns empty array for empty input', () => {
    const result = mapApiFilesToUploadedFiles([], 1000);
    assert.deepEqual(result, []);
});
