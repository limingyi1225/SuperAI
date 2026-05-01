import { NextRequest } from 'next/server';
import { streamOpenAIResponse } from '@/lib/openai';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const { question } = await request.json();

        if (!question) {
            return new Response(JSON.stringify({ error: 'No question provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const messages = [
            {
                role: 'system' as const,
                content: 'You are a helpful assistant. Your task is to generate a very short, concise title (max 5 words) for a chat session based on the provided user question or content. Output ONLY the title, nothing else.'
            },
            {
                role: 'user' as const,
                content: question
            }
        ];

        const titleModel = process.env.OPENAI_MODEL_TITLE || 'gpt-5-nano';

        let title = '';
        for await (const event of streamOpenAIResponse(messages, titleModel, 'low')) {
            if (event.type === 'answer_delta' && event.content) {
                title += event.content;
            }
        }

        const trimmed = title.trim();
        // If the model returned nothing usable, fall back to a question-derived stub
        // so the client never persists an empty title.
        const finalTitle = trimmed || (typeof question === 'string' ? question.trim().slice(0, 30) : '') || 'Untitled';

        return new Response(JSON.stringify({ title: finalTitle }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Generate title error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
