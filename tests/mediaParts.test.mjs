import test from 'node:test';
import assert from 'node:assert/strict';
import {
    toGeminiInlineData,
    toGeminiPdfPart,
    toClaudeImagePart,
    toClaudePdfPart,
} from '../lib/mediaParts.ts';

test('toGeminiInlineData parses data URI mime type and payload', () => {
    const result = toGeminiInlineData('data:image/png;base64,AAAA');
    assert.deepEqual(result, { mimeType: 'image/png', data: 'AAAA' });
});

test('toGeminiInlineData falls back to image/jpeg for raw base64', () => {
    const result = toGeminiInlineData('rawbase64');
    assert.deepEqual(result, { mimeType: 'image/jpeg', data: 'rawbase64' });
});

test('toGeminiInlineData falls back for malformed data URI', () => {
    const result = toGeminiInlineData('data:not-a-real-mime');
    assert.equal(result.mimeType, 'image/jpeg');
});

test('toGeminiPdfPart strips data URI prefix', () => {
    const part = toGeminiPdfPart('data:application/pdf;base64,ZZZZ');
    assert.equal(part.inlineData.mimeType, 'application/pdf');
    assert.equal(part.inlineData.data, 'ZZZZ');
});

test('toGeminiPdfPart treats raw base64 as the payload', () => {
    const part = toGeminiPdfPart('rawpdf');
    assert.equal(part.inlineData.data, 'rawpdf');
});

test('toClaudeImagePart returns image source with parsed mime type', () => {
    const part = toClaudeImagePart('data:image/webp;base64,WWWW');
    assert.equal(part.type, 'image');
    assert.equal(part.source.type, 'base64');
    assert.equal(part.source.media_type, 'image/webp');
    assert.equal(part.source.data, 'WWWW');
});

test('toClaudeImagePart falls back to image/jpeg for raw base64', () => {
    const part = toClaudeImagePart('BBBB');
    assert.equal(part.source.media_type, 'image/jpeg');
    assert.equal(part.source.data, 'BBBB');
});

test('toClaudePdfPart returns document type with parsed data', () => {
    const part = toClaudePdfPart('data:application/pdf;base64,PDFDATA');
    assert.equal(part.type, 'document');
    assert.equal(part.source.media_type, 'application/pdf');
    assert.equal(part.source.data, 'PDFDATA');
});
