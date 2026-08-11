import type { ClaudeContentPart } from './claude';
import type { GeminiContentPart } from './gemini';

export type SupportedImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const SUPPORTED_IMAGE_MIME_TYPES = new Set<string>([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
]);

/** Detect the supported image format from its file signature instead of trusting metadata. */
export function detectImageMimeType(bytes: Uint8Array): SupportedImageMimeType | null {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }

    if (
        bytes.length >= 8
        && bytes[0] === 0x89
        && bytes[1] === 0x50
        && bytes[2] === 0x4e
        && bytes[3] === 0x47
        && bytes[4] === 0x0d
        && bytes[5] === 0x0a
        && bytes[6] === 0x1a
        && bytes[7] === 0x0a
    ) {
        return 'image/png';
    }

    if (
        bytes.length >= 6
        && bytes[0] === 0x47
        && bytes[1] === 0x49
        && bytes[2] === 0x46
        && bytes[3] === 0x38
        && (bytes[4] === 0x37 || bytes[4] === 0x39)
        && bytes[5] === 0x61
    ) {
        return 'image/gif';
    }

    if (
        bytes.length >= 12
        && bytes[0] === 0x52
        && bytes[1] === 0x49
        && bytes[2] === 0x46
        && bytes[3] === 0x46
        && bytes[8] === 0x57
        && bytes[9] === 0x45
        && bytes[10] === 0x42
        && bytes[11] === 0x50
    ) {
        return 'image/webp';
    }

    return null;
}

function parseDataUri(value: string): { mimeType: string; data: string } | null {
    if (!value.startsWith('data:')) return null;
    const match = value.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], data: match[2] };
}

function normalizeImage(image: string): { mimeType: SupportedImageMimeType; data: string } {
    const parsed = parseDataUri(image);
    const data = parsed?.data ?? image;
    // Image signatures fit within 12 decoded bytes. Decode only a short prefix so
    // normalization does not duplicate an entire multi-megabyte attachment in memory.
    const prefix = Buffer.from(data.slice(0, 32), 'base64');
    const detectedMimeType = detectImageMimeType(prefix);

    if (detectedMimeType) {
        return { mimeType: detectedMimeType, data };
    }

    const declaredMimeType = parsed?.mimeType;
    if (declaredMimeType && SUPPORTED_IMAGE_MIME_TYPES.has(declaredMimeType)) {
        return { mimeType: declaredMimeType as SupportedImageMimeType, data };
    }

    return { mimeType: 'image/jpeg', data };
}

/** Normalize an image (data URI or raw base64) into Gemini's inlineData shape. */
export function toGeminiInlineData(image: string): { mimeType: string; data: string } {
    return normalizeImage(image);
}

/** Normalize a PDF (data URI or raw base64) into Gemini's inlineData shape. */
export function toGeminiPdfPart(pdf: string): GeminiContentPart {
    const match = pdf.match(/^data:application\/pdf;base64,(.+)$/);
    const data = match ? match[1] : pdf;
    return {
        inlineData: {
            mimeType: 'application/pdf',
            data,
        },
    };
}

/** Normalize an image into Claude's image content part. */
export function toClaudeImagePart(image: string): ClaudeContentPart {
    const normalized = normalizeImage(image);
    return {
        type: 'image',
        source: {
            type: 'base64',
            media_type: normalized.mimeType,
            data: normalized.data,
        },
    };
}

/** Normalize a PDF into Claude's document content part. */
export function toClaudePdfPart(pdf: string): ClaudeContentPart {
    const match = pdf.match(/^data:application\/pdf;base64,(.+)$/);
    const data = match ? match[1] : pdf;
    return {
        type: 'document',
        source: {
            type: 'base64',
            media_type: 'application/pdf',
            data,
        },
    };
}
