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
const DEFAULT_CLAUDE_MAX_TOKENS = 64000;
const CLAUDE_MAX_TOKENS_HARD_CAP = 128000;

function parsePositiveIntEnv(name: string, defaultValue: number, maxValue = Number.MAX_SAFE_INTEGER): number {
    const raw = process.env[name];
    if (!raw) return defaultValue;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
    return Math.min(parsed, maxValue);
}

export function resolveClaudeMaxTokens(): number {
    return parsePositiveIntEnv(
        'CLAUDE_MAX_TOKENS',
        DEFAULT_CLAUDE_MAX_TOKENS,
        CLAUDE_MAX_TOKENS_HARD_CAP,
    );
}

export function getClaudeStopReasonFailure(
    stopReason: string | null,
    maxTokens: number,
): string | null {
    if (stopReason === 'end_turn') return null;

    if (stopReason === 'max_tokens') {
        return `Claude response was truncated after reaching CLAUDE_MAX_TOKENS=${maxTokens}`;
    }
    if (stopReason === 'model_context_window_exceeded') {
        return 'Claude response was truncated after reaching the model context window';
    }
    if (stopReason === 'refusal') {
        return 'Claude refused to complete this response';
    }
    if (stopReason === null) {
        return 'Claude stream ended without a stop reason';
    }

    return `Claude stopped before completing the response (${stopReason})`;
}

// Callers pass the canonical model ID (api/ask/route.ts normalizes through
// MODEL_ID_ALIASES first), so only the current IDs need handling here.
function resolveClaudeModel(model: string): string {
    if (model === 'claude-opus-5') {
        return process.env.CLAUDE_MODEL_OPUS || process.env.CLAUDE_MODEL || 'claude-opus-5';
    }
    if (model === 'claude-fable-5') {
        return process.env.CLAUDE_MODEL_FABLE || process.env.CLAUDE_MODEL || 'claude-fable-5';
    }
    return model;
}

type ClaudeOutputEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

const CLAUDE_OUTPUT_EFFORT_VALUES: readonly ClaudeOutputEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

function resolveClaudeOutputEffort(effort: ClaudeOutputEffort): ClaudeOutputEffort {
    const overrideRaw = process.env.CLAUDE_OUTPUT_EFFORT?.trim().toLowerCase();
    if (overrideRaw && CLAUDE_OUTPUT_EFFORT_VALUES.includes(overrideRaw as ClaudeOutputEffort)) {
        return overrideRaw as ClaudeOutputEffort;
    }
    return effort;
}

function createClient(): Anthropic {
    // Ignore empty-string env vars (e.g. when the host shell exports an empty
    // ANTHROPIC_API_KEY) so .env.local values don't get silently overridden.
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;
    return new Anthropic({ apiKey });
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
    effort: ClaudeOutputEffort = 'high',
    systemInstruction?: string
): AsyncGenerator<ClaudeStreamEvent> {
    const client = createClient();
    const modelName = resolveClaudeModel(model);
    const pauseTurnMax = parsePositiveIntEnv('CLAUDE_TOOL_PAUSE_TURN_MAX', DEFAULT_PAUSE_TURN_MAX);
    const maxTokens = resolveClaudeMaxTokens();
    const tools = buildTools();
    const resolvedEffort = resolveClaudeOutputEffort(effort);

    const conversationMessages = normalizeMessages(messages);

    let summarySeen = false;
    let summaryDoneEmitted = false;
    let pauseTurnCount = 0;

    while (true) {
        const params: Anthropic.Messages.MessageCreateParamsStreaming = {
            model: modelName,
            // Opus 5 / Fable 5 both accept up to 128000. This budget covers thinking
            // *plus* the answer, and xhigh effort spends a lot of it thinking, so keep
            // plenty of headroom — it's a ceiling, not a target, and billing is on
            // tokens actually generated.
            max_tokens: maxTokens,
            stream: true,
            messages: conversationMessages,
            // Opus 5 / Fable 5 default `display` to "omitted", which streams zero
            // thinking deltas and leaves the reasoning panel blank. Ask for summaries.
            thinking: { type: 'adaptive', display: 'summarized' } as Anthropic.Messages.ThinkingConfigParam,
            output_config: {
                // The pinned SDK (0.78.0) predates the `xhigh` effort level, so its
                // union type rejects it even though the API accepts it. The value is
                // validated against CLAUDE_OUTPUT_EFFORT_VALUES above.
                effort: resolvedEffort as 'low' | 'medium' | 'high' | 'max',
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

        const stopReasonFailure = getClaudeStopReasonFailure(stopReason, maxTokens);
        if (stopReasonFailure) {
            throw new Error(stopReasonFailure);
        }

        // Natural completion
        if (summarySeen && !summaryDoneEmitted) {
            summaryDoneEmitted = true;
            yield { type: 'reasoning_summary_done' };
        }
        return;
    }
}
