export interface GrokMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | GrokContentPart[];
}

export interface GrokContentPart {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
        url: string;
        detail?: 'low' | 'high' | 'auto';
    };
}

export interface GrokStreamEvent {
    type: 'answer_delta';
    content?: string;
}

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_BASE_MODEL = 'grok-4.20-multi-agent-beta-latest';

function resolveGrokModelAndEffort(modelId: string): { model: string; reasoningEffort: 'low' | 'high' } {
    if (modelId === 'grok-4.20-16') {
        return { model: process.env.GROK_MODEL || GROK_BASE_MODEL, reasoningEffort: 'high' };
    }
    // grok-4.20-4 and any fallback
    return { model: process.env.GROK_MODEL || GROK_BASE_MODEL, reasoningEffort: 'low' };
}

function normalizeMessages(messages: GrokMessage[]): Array<{ role: string; content: string | GrokContentPart[] }> {
    return messages.filter(m => {
        if (typeof m.content === 'string') return m.content.trim().length > 0;
        if (Array.isArray(m.content)) return m.content.length > 0;
        return false;
    });
}

export async function* streamGrokResponse(
    messages: GrokMessage[],
    modelId: string,
    systemInstruction?: string
): AsyncGenerator<GrokStreamEvent> {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
        throw new Error('XAI_API_KEY is not set');
    }

    const { model: modelName, reasoningEffort } = resolveGrokModelAndEffort(modelId);

    const allMessages: GrokMessage[] = [];
    if (systemInstruction && systemInstruction.trim()) {
        allMessages.push({ role: 'system', content: systemInstruction });
    }
    allMessages.push(...messages);

    const body = {
        model: modelName,
        messages: normalizeMessages(allMessages),
        stream: true,
        reasoning_effort: reasoningEffort,
    };

    const response = await fetch(GROK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error (${response.status} ${response.statusText}): ${errorText}`);
    }

    if (!response.body) {
        throw new Error('Grok API returned empty response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const payload = trimmed.slice(6).trim();
            if (payload === '[DONE]') return;

            let data: {
                choices?: Array<{
                    delta?: { content?: string };
                    finish_reason?: string | null;
                }>;
            };
            try {
                data = JSON.parse(payload) as typeof data;
            } catch {
                continue;
            }

            const delta = data.choices?.[0]?.delta;
            if (delta?.content) {
                yield { type: 'answer_delta', content: delta.content };
            }
        }
    }
}
