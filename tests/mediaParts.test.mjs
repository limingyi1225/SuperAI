import test from 'node:test';
import assert from 'node:assert/strict';
import {
    detectImageMimeType,
    toGeminiInlineData,
    toGeminiPdfPart,
    toClaudeImagePart,
    toClaudePdfPart,
} from '../lib/mediaParts.ts';

const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64');
const PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');

test('detectImageMimeType recognizes supported image signatures', () => {
    assert.equal(detectImageMimeType(Buffer.from(JPEG_BASE64, 'base64')), 'image/jpeg');
    assert.equal(detectImageMimeType(Buffer.from(PNG_BASE64, 'base64')), 'image/png');
    assert.equal(detectImageMimeType(Buffer.from('GIF89a', 'ascii')), 'image/gif');
    assert.equal(detectImageMimeType(Buffer.from('RIFF0000WEBP', 'ascii')), 'image/webp');
    assert.equal(detectImageMimeType(Buffer.from('not-an-image')), null);
});

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

test('toGeminiInlineData corrects a declared PNG whose bytes are JPEG', () => {
    const result = toGeminiInlineData(`data:image/png;base64,${JPEG_BASE64}`);
    assert.deepEqual(result, { mimeType: 'image/jpeg', data: JPEG_BASE64 });
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

test('toClaudeImagePart corrects a declared PNG whose bytes are JPEG', () => {
    const part = toClaudeImagePart(`data:image/png;base64,${JPEG_BASE64}`);
    assert.equal(part.type, 'image');
    assert.equal(part.source.media_type, 'image/jpeg');
    assert.equal(part.source.data, JPEG_BASE64);
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
