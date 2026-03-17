import Anthropic from '@anthropic-ai/sdk';

export interface ClaudeTextContentPart {
    type: 'text';
    text: string;
}

export interface ClaudeImageContentPart {
    type: 'image';
    source: {
        type: 'base64';
        media_type: string;
        data: string;
    };
}

type ClaudeRawContentPart = Record<string, unknown>;

export type ClaudeContentPart =
    | ClaudeTextContentPart
    | ClaudeImageContentPart
    | ClaudeRawContentPart;

export interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string | ClaudeContentPart[];
}

export interface ClaudeStreamEvent {
    type: 'answer_delta' | 'reasoning_summary_delta' | 'reasoning_summary_done';
    content?: string;
}

const DEFAULT_WEB_SEARCH_MAX_USES = 3;
const DEFAULT_PAUSE_TURN_MAX = 5;

function parsePositiveIntEnv(name: string, defaultValue: number): number {
    const raw = process.env[name];
    if (!raw) return defaultValue;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
    return parsed;
}

function resolveClaudeModel(model: string): string {
    if (model === 'claude-opus-4-6' || model === 'claude-opus-4-6-high' || model === 'claude-opus-4-6-low') {
        return process.env.CLAUDE_MODEL_OPUS || process.env.CLAUDE_MODEL || 'claude-opus-4-6';
    }
    if (model === 'claude-sonnet-4-6') {
        return process.env.CLAUDE_MODEL_SONNET || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
    }
    return model;
}

type ClaudeOutputEffort = 'low' | 'medium' | 'high' | 'max';

const CLAUDE_OUTPUT_EFFORT_VALUES: readonly ClaudeOutputEffort[] = ['low', 'medium', 'high', 'max'];

function resolveClaudeOutputEffort(effort: ClaudeOutputEffort): ClaudeOutputEffort {
    const overrideRaw = process.env.CLAUDE_OUTPUT_EFFORT?.trim().toLowerCase();
    if (overrideRaw && CLAUDE_OUTPUT_EFFORT_VALUES.includes(overrideRaw as ClaudeOutputEffort)) {
        return overrideRaw as ClaudeOutputEffort;
    }
    return effort;
}

function createClient(): Anthropic {
    return new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
}

function buildTools(): Anthropic.Messages.Tool[] {
    const tools: Anthropic.Messages.Tool[] = [];

    tools.push({
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: parsePositiveIntEnv('CLAUDE_WEB_SEARCH_MAX_USES', DEFAULT_WEB_SEARCH_MAX_USES),
    } as unknown as Anthropic.Messages.Tool);

    tools.push({
        type: 'code_execution_20250825',
        name: 'code_execution',
    } as unknown as Anthropic.Messages.Tool);

    return tools;
}

function normalizeMessages(messages: ClaudeMessage[]): Anthropic.Messages.MessageParam[] {
    return messages
        .map((message): Anthropic.Messages.MessageParam | null => {
            if (typeof message.content === 'string') {
                const text = message.content.trim();
                if (!text) return null;
                return { role: message.role, content: text };
            }

            if (Array.isArray(message.content)) {
                const parts = message.content
                    .filter((part): part is Record<string, unknown> =>
                        typeof part === 'object' && part !== null && !Array.isArray(part)
                    )
                    .map(part => {
                        const partType = typeof part.type === 'string' ? part.type : '';
                        if (partType === 'text') {
                            const text = typeof part.text === 'string' ? part.text : '';
                            if (!text) return null;
                            return { type: 'text' as const, text };
                        }
                        if (partType === 'image') {
                            const source = typeof part.source === 'object' && part.source !== null ? part.source as Record<string, unknown> : null;
                            const mediaType = source && typeof source.media_type === 'string' ? source.media_type : '';
                            const data = source && typeof source.data === 'string' ? source.data : '';
                            if (!mediaType || !data) return null;
                            return {
                                type: 'image' as const,
                                source: {
                                    type: 'base64' as const,
                                    media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                                    data,
                                },
                            };
                        }
                        // Pass through other part types (e.g. document for PDFs)
                        return part as unknown as Anthropic.Messages.ContentBlockParam;
                    })
                    .filter((p): p is NonNullable<typeof p> => p !== null);

                if (parts.length === 0) return null;
                return {
                    role: message.role,
                    content: parts as Anthropic.Messages.ContentBlockParam[],
                };
            }

            return null;
        })
        .filter((m): m is Anthropic.Messages.MessageParam => m !== null);
}

export async function* streamClaudeResponse(
    messages: ClaudeMessage[],
    model: string,
    effort: 'low' | 'medium' | 'high' | 'max' = 'high',
    systemInstruction?: string
): AsyncGenerator<ClaudeStreamEvent> {
    const client = createClient();
    const modelName = resolveClaudeModel(model);
    const pauseTurnMax = parsePositiveIntEnv('CLAUDE_TOOL_PAUSE_TURN_MAX', DEFAULT_PAUSE_TURN_MAX);
    const tools = buildTools();
    const resolvedEffort = resolveClaudeOutputEffort(effort);

    const conversationMessages = normalizeMessages(messages);

    let summarySeen = false;
    let summaryDoneEmitted = false;
    let pauseTurnCount = 0;

    while (true) {
        const params: Anthropic.Messages.MessageCreateParamsStreaming = {
            model: modelName,
            max_tokens: parsePositiveIntEnv('CLAUDE_MAX_TOKENS', 16384),
            stream: true,
            messages: conversationMessages,
            thinking: { type: 'adaptive' },
            output_config: {
                effort: resolvedEffort,
            },
            tools: tools as unknown as Anthropic.Messages.Tool[],
        };

        if (systemInstruction && systemInstruction.trim()) {
            params.system = systemInstruction;
        }

        const betas: string[] = ['code-execution-2025-08-25'];
        const envBetas = process.env.ANTHROPIC_BETAS;
        if (envBetas) {
            for (const beta of envBetas.split(',').map(b => b.trim()).filter(Boolean)) {
                if (!betas.includes(beta)) betas.push(beta);
            }
        }

        const stream = client.messages.stream(params, {
            headers: {
                'anthropic-beta': betas.join(','),
            },
        });

        let stopReason: string | null = null;
        const assistantContentBlocks: Record<string, unknown>[] = [];

        for await (const event of stream) {
            if (event.type === 'content_block_start') {
                const block = event.content_block;
                const blockType = block?.type;

                if (blockType === 'thinking' && 'thinking' in block && typeof block.thinking === 'string' && block.thinking) {
                    summarySeen = true;
                    yield { type: 'reasoning_summary_delta', content: block.thinking };
                }
                if (blockType === 'text' && 'text' in block && typeof block.text === 'string' && block.text) {
                    yield { type: 'answer_delta', content: block.text };
                }
            }

            if (event.type === 'content_block_delta') {
                const delta = event.delta;
                if (delta.type === 'text_delta' && 'text' in delta && delta.text) {
                    yield { type: 'answer_delta', content: delta.text };
                }
                if (delta.type === 'thinking_delta' && 'thinking' in delta && (delta as { thinking: string }).thinking) {
                    summarySeen = true;
                    yield { type: 'reasoning_summary_delta', content: (delta as { thinking: string }).thinking };
                }
            }

            if (event.type === 'message_delta') {
                if ('stop_reason' in event.delta && typeof event.delta.stop_reason === 'string') {
                    stopReason = event.delta.stop_reason;
                }
            }
        }

        // Collect the final message for pause_turn handling
        const finalMessage = await stream.finalMessage();
        if (finalMessage.content) {
            for (const block of finalMessage.content) {
                assistantContentBlocks.push(block as unknown as Record<string, unknown>);
            }
        }
        if (finalMessage.stop_reason) {
            stopReason = finalMessage.stop_reason;
        }

        if (stopReason === 'pause_turn') {
            pauseTurnCount += 1;
            if (pauseTurnCount > pauseTurnMax) {
                throw new Error(`Claude pause_turn limit exceeded (${pauseTurnMax})`);
            }

            if (assistantContentBlocks.length > 0) {
                conversationMessages.push({
                    role: 'assistant',
                    content: assistantContentBlocks as unknown as Anthropic.Messages.ContentBlockParam[],
                });
            }
            continue;
        }

        // Normal completion
        if (summarySeen && !summaryDoneEmitted) {
            summaryDoneEmitted = true;
            yield { type: 'reasoning_summary_done' };
        }
        return;
    }
}
