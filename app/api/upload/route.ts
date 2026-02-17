import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type PdfParseResult = {
    text: string;
};

type PdfParseModuleShape = {
    default?: (buffer: Buffer) => Promise<PdfParseResult>;
};

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('files') as File[];

        if (files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }

        const results: { type: string; content: string; name: string }[] = [];

        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const mimeType = file.type;

            if (mimeType === 'application/pdf') {
                // Dynamic import pdf-parse to avoid bundling issues
                const pdfParseModule = (await import('pdf-parse')) as unknown as PdfParseModuleShape;
                const pdfParse = pdfParseModule.default;
                if (typeof pdfParse !== 'function') {
                    throw new Error('Failed to load pdf parser');
                }
                const pdfData = await pdfParse(buffer);
                results.push({
                    type: 'pdf',
                    content: pdfData.text,
                    name: file.name,
                });
            } else if (mimeType.startsWith('image/')) {
                // Convert image to base64
                const base64 = buffer.toString('base64');
                results.push({
                    type: 'image',
                    content: `data:${mimeType};base64,${base64}`,
                    name: file.name,
                });
            } else {
                // Try to read as text
                const text = buffer.toString('utf-8');
                results.push({
                    type: 'text',
                    content: text,
                    name: file.name,
                });
            }
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
