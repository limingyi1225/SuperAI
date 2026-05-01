import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 25 * 1024 * 1024;          // 25 MB per file
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;         // 60 MB per request
const MAX_FILES_PER_REQUEST = 12;

const IMAGE_MIME_ALLOWLIST = new Set<string>([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
]);

const TEXT_MIME_EXACT = new Set<string>([
    'application/json',
    'application/xml',
    'application/javascript',
]);

function isText(mime: string): boolean {
    return mime.startsWith('text/') || TEXT_MIME_EXACT.has(mime);
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const rawFiles = formData.getAll('files');
        const files = rawFiles.filter((entry): entry is File => entry instanceof File);

        if (files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }

        if (files.length > MAX_FILES_PER_REQUEST) {
            return NextResponse.json(
                { error: `Too many files (max ${MAX_FILES_PER_REQUEST})` },
                { status: 413 }
            );
        }

        let totalBytes = 0;
        for (const file of files) {
            if (file.size > MAX_FILE_BYTES) {
                return NextResponse.json(
                    { error: `File "${file.name}" exceeds size limit (${MAX_FILE_BYTES / 1024 / 1024} MB)` },
                    { status: 413 }
                );
            }
            totalBytes += file.size;
        }
        if (totalBytes > MAX_TOTAL_BYTES) {
            return NextResponse.json(
                { error: `Total upload exceeds size limit (${MAX_TOTAL_BYTES / 1024 / 1024} MB)` },
                { status: 413 }
            );
        }

        const results: { type: string; content: string; name: string }[] = [];

        for (const file of files) {
            const mimeType = file.type;
            const buffer = Buffer.from(await file.arrayBuffer());

            if (mimeType === 'application/pdf') {
                results.push({
                    type: 'pdf',
                    content: `data:application/pdf;base64,${buffer.toString('base64')}`,
                    name: file.name,
                });
                continue;
            }

            if (IMAGE_MIME_ALLOWLIST.has(mimeType)) {
                results.push({
                    type: 'image',
                    content: `data:${mimeType};base64,${buffer.toString('base64')}`,
                    name: file.name,
                });
                continue;
            }

            if (isText(mimeType)) {
                results.push({
                    type: 'text',
                    content: buffer.toString('utf-8'),
                    name: file.name,
                });
                continue;
            }

            // Reject SVG, application/octet-stream, archives, executables, unknown binary, etc.
            return NextResponse.json(
                { error: `Unsupported file type "${mimeType || 'unknown'}" for ${file.name}` },
                { status: 415 }
            );
        }

        return NextResponse.json({ files: results });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Upload failed' },
            { status: 500 }
        );
    }
}
