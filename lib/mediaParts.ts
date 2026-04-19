import type { ClaudeContentPart } from './claude';
import type { GeminiContentPart } from './gemini';

function parseDataUri(value: string): { mimeType: string; data: string } | null {
    if (!value.startsWith('data:')) return null;
    const match = value.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], data: match[2] };
}

/** Normalize an image (data URI or raw base64) into Gemini's inlineData shape. */
export function toGeminiInlineData(image: string): { mimeType: string; data: string } {
    return parseDataUri(image) || { mimeType: 'image/jpeg', data: image };
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
    const parsed = parseDataUri(image);
    if (parsed) {
        return {
            type: 'image',
            source: { type: 'base64', media_type: parsed.mimeType, data: parsed.data },
        };
    }
    return {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: image },
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
