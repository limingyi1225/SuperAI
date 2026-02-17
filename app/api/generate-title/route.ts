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

        let title = '';
        for await (const event of streamOpenAIResponse(messages, 'gpt-5-nano', 'low')) {
            if (event.type === 'answer_delta' && event.content) {
                title += event.content;
            }
        }

        return new Response(JSON.stringify({ title: title.trim() }), {
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
