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

type ClaudeOutputEffort = 'low' | 'medium' | 'high' | 'max';

interface ClaudeWebSearchTool {
    type: 'web_search_20250305';
    name: 'web_search';
    max_uses?: number;
}

interface ClaudeCodeExecutionTool {
    type: 'code_execution_20250825';
    name: 'code_execution';
}

type ClaudeTool = ClaudeWebSearchTool | ClaudeCodeExecutionTool;

interface MutableAssistantContentBlock {
    block: ClaudeRawContentPart;
    toolInputJsonBuffer: string;
}

class ClaudeApiRequestError extends Error {
    status: number;
    statusText: string;
    body: string;

    constructor(status: number, statusText: string, body: string, context: string) {
        super(`Claude API error (${status} ${statusText}) [${context}]: ${body}`);
        this.name = 'ClaudeApiRequestError';
        this.status = status;
        this.statusText = statusText;
        this.body = body;
    }
}

const CLAUDE_OUTPUT_EFFORT_VALUES: readonly ClaudeOutputEffort[] = ['low', 'medium', 'high', 'max'];
const CLAUDE_CODE_EXECUTION_BETA = 'code-execution-2025-08-25';
const DEFAULT_WEB_SEARCH_MAX_USES = 3;
const DEFAULT_TOOL_PAUSE_TURN_MAX = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneRecord<T extends Record<string, unknown>>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined) return defaultValue;

    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
}

function parsePositiveIntEnv(name: string, defaultValue: number): number {
    const raw = process.env[name];
    if (!raw) return defaultValue;

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
    return parsed;
}

function parseAnthropicBetas(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
}

function resolveClaudeModel(model: string): string {
    if (model === 'claude-opus-4-6' || model === 'claude-opus-4-6-high') {
        return process.env.CLAUDE_MODEL_OPUS || process.env.CLAUDE_MODEL || 'claude-opus-4-6';
    }

    return model;
}

function resolveClaudeOutputEffort(
    effort: 'low' | 'medium' | 'high' | 'max'
): ClaudeOutputEffort {
    const overrideRaw = process.env.CLAUDE_OUTPUT_EFFORT?.trim().toLowerCase();
    if (overrideRaw && CLAUDE_OUTPUT_EFFORT_VALUES.includes(overrideRaw as ClaudeOutputEffort)) {
        return overrideRaw as ClaudeOutputEffort;
    }

    return effort;
}

function buildClaudeTools(options?: { webOnly?: boolean; disableAll?: boolean }): ClaudeTool[] {
    if (options?.disableAll) return [];

    const webSearchTool: ClaudeWebSearchTool = {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: parsePositiveIntEnv('CLAUDE_WEB_SEARCH_MAX_USES', DEFAULT_WEB_SEARCH_MAX_USES),
    };

    const tools: ClaudeTool[] = [webSearchTool];
    if (!options?.webOnly) {
        tools.push({
            type: 'code_execution_20250825',
            name: 'code_execution',
        });
    }

    return tools;
}

function buildClaudeToolAttemptSets(): ClaudeTool[][] {
    return [
        buildClaudeTools(),
        buildClaudeTools({ webOnly: true }),
        [],
    ];
}

function hasCodeExecutionTool(tools: ClaudeTool[]): boolean {
    return tools.some(tool => tool.type === 'code_execution_20250825');
}

function resolveAnthropicBetas(extraBetas: string[]): string[] {
    const merged: string[] = [];
    const seen = new Set<string>();

    const add = (candidate: string) => {
        const normalized = candidate.trim();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        merged.push(normalized);
    };

    for (const beta of extraBetas) add(beta);
    for (const beta of parseAnthropicBetas(process.env.ANTHROPIC_BETAS)) add(beta);

    return merged;
}

function normalizeMessages(messages: ClaudeMessage[]): Array<{
    role: 'user' | 'assistant';
    content: ClaudeRawContentPart[];
}> {
    return messages
        .map(message => {
            const contentParts: ClaudeRawContentPart[] = [];

            if (Array.isArray(message.content)) {
                for (const part of message.content) {
                    if (!isRecord(part)) continue;

                    const partType = typeof part.type === 'string' ? part.type : '';
                    if (partType === 'text') {
                        const text = typeof part.text === 'string' ? part.text : '';
                        if (!text) continue;
                        contentParts.push({ type: 'text', text });
                        continue;
                    }

                    if (partType === 'image') {
                        const source = isRecord(part.source) ? part.source : null;
                        const mediaType = source && typeof source.media_type === 'string' ? source.media_type : '';
                        const data = source && typeof source.data === 'string' ? source.data : '';
                        if (!mediaType || !data) continue;
                        contentParts.push({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data,
                            },
                        });
                        continue;
                    }

                    contentParts.push(cloneRecord(part));
                }
            } else if (typeof message.content === 'string' && message.content.trim()) {
                contentParts.push({ type: 'text', text: message.content });
            }

            return {
                role: message.role,
                content: contentParts,
            };
        })
        .filter(message => message.content.length > 0);
}

function cloneClaudeMessages(messages: ClaudeMessage[]): ClaudeMessage[] {
    return messages.map(message => {
        if (!Array.isArray(message.content)) {
            return {
                role: message.role,
                content: message.content,
            };
        }

        return {
            role: message.role,
            content: message.content
                .filter(isRecord)
                .map(part => cloneRecord(part)),
        };
    });
}

function buildRequestBody(
    modelName: string,
    messages: ClaudeMessage[],
    effort: 'low' | 'medium' | 'high' | 'max',
    systemInstruction: string | undefined,
    includeThinking: boolean,
    includeOutputConfig: boolean,
    tools: ClaudeTool[]
): Record<string, unknown> {
    const body: Record<string, unknown> = {
        model: modelName,
        max_tokens: parsePositiveIntEnv('CLAUDE_MAX_TOKENS', 16384),
        stream: true,
        messages: normalizeMessages(messages),
    };

    if (systemInstruction && systemInstruction.trim()) {
        body.system = systemInstruction;
    }

    if (includeThinking) {
        body.thinking = { type: 'adaptive' };
        if (includeOutputConfig) {
            body.output_config = {
                effort: resolveClaudeOutputEffort(effort),
            };
        }
    }

    if (tools.length > 0) {
        body.tools = tools;
    }

    return body;
}

function isThinkingCompatibilityError(status: number, errorBody: string): boolean {
    if (status < 400 || status >= 500) return false;

    const message = errorBody.toLowerCase();
    const hasThinkingHint = /(thinking|adaptive|output_config|effort)/.test(message);
    const hasCompatibilityHint = /(unsupported|not supported|invalid|unknown|unrecognized|not available|required|beta|header)/.test(message);
    return hasThinkingHint && hasCompatibilityHint;
}

function isToolCompatibilityError(status: number, errorBody: string): boolean {
    if (status < 400 || status >= 500) return false;

    const message = errorBody.toLowerCase();
    const hasToolHint = /(tool|tools|web_search|web search|code_execution|code execution)/.test(message);
    const hasCompatibilityHint = /(unsupported|not supported|invalid|unknown|unrecognized|not available|required|beta|header|not enabled)/.test(message);
    return hasToolHint && hasCompatibilityHint;
}

async function requestClaudeStream(
    body: Record<string, unknown>,
    options: { extraBetas?: string[] } = {}
): Promise<Response> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set');
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
    };

    const resolvedBetas = resolveAnthropicBetas(options.extraBetas || []);
    if (resolvedBetas.length > 0) {
        headers['anthropic-beta'] = resolvedBetas.join(',');
    }

    return fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}

async function requestClaudeWithThinkingFallback(
    modelName: string,
    messages: ClaudeMessage[],
    effort: 'low' | 'medium' | 'high' | 'max',
    systemInstruction: string | undefined,
    tools: ClaudeTool[]
): Promise<Response> {
    const thinkingEnabled = parseBooleanEnv('CLAUDE_ENABLE_THINKING', true);
    const thinkingVariants = thinkingEnabled
        ? [
            { includeThinking: true, includeOutputConfig: true, label: 'thinking+effort' },
            { includeThinking: true, includeOutputConfig: false, label: 'thinking-only' },
            { includeThinking: false, includeOutputConfig: false, label: 'no-thinking' },
        ]
        : [
            { includeThinking: false, includeOutputConfig: false, label: 'no-thinking' },
        ];

    const extraBetas = hasCodeExecutionTool(tools) ? [CLAUDE_CODE_EXECUTION_BETA] : [];

    for (let i = 0; i < thinkingVariants.length; i++) {
        const variant = thinkingVariants[i];
        const hasNextVariant = i < thinkingVariants.length - 1;

        const response = await requestClaudeStream(
            buildRequestBody(
                modelName,
                messages,
                effort,
                systemInstruction,
                variant.includeThinking,
                variant.includeOutputConfig,
                tools
            ),
            { extraBetas }
        );

        if (response.ok) {
            return response;
        }

        const errorBody = await response.text();
        if (isToolCompatibilityError(response.status, errorBody)) {
            throw new ClaudeApiRequestError(response.status, response.statusText, errorBody, variant.label);
        }

        const canTryNextThinkingVariant = hasNextVariant && isThinkingCompatibilityError(response.status, errorBody);
        if (canTryNextThinkingVariant) {
            continue;
        }

        throw new ClaudeApiRequestError(response.status, response.statusText, errorBody, variant.label);
    }

    throw new Error('Claude request failed without a terminal response');
}

function getBlockIndex(value: unknown): number | null {
    return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function getOrCreateMutableBlock(
    blocksByIndex: Map<number, MutableAssistantContentBlock>,
    index: number,
    fallbackType: 'text' | 'thinking' | 'tool_use'
): MutableAssistantContentBlock {
    const existing = blocksByIndex.get(index);
    if (existing) return existing;

    const fallbackBlock: ClaudeRawContentPart = (
        fallbackType === 'text'
            ? { type: 'text', text: '' }
            : fallbackType === 'thinking'
                ? { type: 'thinking', thinking: '' }
                : { type: 'tool_use', input: {} }
    );

    const created: MutableAssistantContentBlock = {
        block: fallbackBlock,
        toolInputJsonBuffer: '',
    };
    blocksByIndex.set(index, created);
    return created;
}

function appendStringField(target: ClaudeRawContentPart, field: string, value: string): void {
    const existing = typeof target[field] === 'string' ? (target[field] as string) : '';
    target[field] = existing + value;
}

function finalizeAssistantBlocks(
    blocksByIndex: Map<number, MutableAssistantContentBlock>
): ClaudeRawContentPart[] {
    return Array.from(blocksByIndex.entries())
        .sort(([a], [b]) => a - b)
        .map(([, entry]) => {
            const block = entry.block;
            const blockType = typeof block.type === 'string' ? block.type : '';

            if (blockType === 'tool_use' && entry.toolInputJsonBuffer.trim()) {
                try {
                    block.input = JSON.parse(entry.toolInputJsonBuffer);
                } catch {
                    block.input = entry.toolInputJsonBuffer;
                }
            }

            return block;
        });
}

export async function* streamClaudeResponse(
    messages: ClaudeMessage[],
    model: string,
    effort: 'low' | 'medium' | 'high' | 'max' = 'high',
    systemInstruction?: string
): AsyncGenerator<ClaudeStreamEvent> {
    const modelName = resolveClaudeModel(model);
    const toolAttemptSets = buildClaudeToolAttemptSets();
    const pauseTurnMax = parsePositiveIntEnv('CLAUDE_TOOL_PAUSE_TURN_MAX', DEFAULT_TOOL_PAUSE_TURN_MAX);

    let summarySeen = false;
    let summaryDoneEmitted = false;
    let lastError: unknown = null;

    for (let toolAttemptIndex = 0; toolAttemptIndex < toolAttemptSets.length; toolAttemptIndex++) {
        const tools = toolAttemptSets[toolAttemptIndex];
        const hasNextToolAttempt = toolAttemptIndex < toolAttemptSets.length - 1;
        const conversationMessages = cloneClaudeMessages(messages);
        let emittedAnyContentThisToolAttempt = false;

        try {
            let pauseTurnCount = 0;

            while (true) {
                const response = await requestClaudeWithThinkingFallback(
                    modelName,
                    conversationMessages,
                    effort,
                    systemInstruction,
                    tools
                );

                if (!response.body) break;

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let stopReason: string | null = null;
                const assistantBlocksByIndex = new Map<number, MutableAssistantContentBlock>();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const events = buffer.split('\n\n');
                    buffer = events.pop() || '';

                    for (const eventBlock of events) {
                        if (!eventBlock.trim()) continue;

                        const dataLines = eventBlock
                            .split('\n')
                            .filter(line => line.startsWith('data: '))
                            .map(line => line.slice(6));

                        if (dataLines.length === 0) continue;

                        const payload = dataLines.join('\n').trim();
                        if (!payload || payload === '[DONE]') continue;

                        try {
                            const data = JSON.parse(payload) as {
                                type?: unknown;
                                index?: unknown;
                                error?: unknown;
                                content_block?: unknown;
                                delta?: unknown;
                                message?: unknown;
                            };

                            const eventType = typeof data.type === 'string' ? data.type : '';
                            if (!eventType) continue;

                            if (eventType === 'error') {
                                const errorRecord = isRecord(data.error) ? data.error : null;
                                const message = errorRecord && typeof errorRecord.message === 'string'
                                    ? errorRecord.message
                                    : 'Unknown Anthropic stream error';
                                throw new Error(message);
                            }

                            if (eventType === 'content_block_start') {
                                const index = getBlockIndex(data.index);
                                const contentBlock = isRecord(data.content_block) ? cloneRecord(data.content_block) : null;
                                if (index !== null && contentBlock) {
                                    assistantBlocksByIndex.set(index, {
                                        block: contentBlock,
                                        toolInputJsonBuffer: '',
                                    });
                                }

                                const contentType = contentBlock && typeof contentBlock.type === 'string'
                                    ? contentBlock.type
                                    : '';

                                if (contentType === 'text' && typeof contentBlock?.text === 'string' && contentBlock.text) {
                                    emittedAnyContentThisToolAttempt = true;
                                    yield { type: 'answer_delta', content: contentBlock.text };
                                }

                                if (
                                    contentType === 'thinking' &&
                                    typeof contentBlock?.thinking === 'string' &&
                                    contentBlock.thinking
                                ) {
                                    summarySeen = true;
                                    emittedAnyContentThisToolAttempt = true;
                                    yield { type: 'reasoning_summary_delta', content: contentBlock.thinking };
                                }

                                continue;
                            }

                            if (eventType === 'content_block_delta') {
                                const index = getBlockIndex(data.index);
                                const delta = isRecord(data.delta) ? data.delta : null;
                                if (index === null || !delta) continue;

                                const deltaType = typeof delta.type === 'string' ? delta.type : '';
                                if (deltaType === 'text_delta' && typeof delta.text === 'string' && delta.text) {
                                    const entry = getOrCreateMutableBlock(assistantBlocksByIndex, index, 'text');
                                    appendStringField(entry.block, 'text', delta.text);
                                    emittedAnyContentThisToolAttempt = true;
                                    yield { type: 'answer_delta', content: delta.text };
                                    continue;
                                }

                                if (deltaType === 'thinking_delta' && typeof delta.thinking === 'string' && delta.thinking) {
                                    const entry = getOrCreateMutableBlock(assistantBlocksByIndex, index, 'thinking');
                                    appendStringField(entry.block, 'thinking', delta.thinking);
                                    summarySeen = true;
                                    emittedAnyContentThisToolAttempt = true;
                                    yield { type: 'reasoning_summary_delta', content: delta.thinking };
                                    continue;
                                }

                                if (deltaType === 'input_json_delta' && typeof delta.partial_json === 'string') {
                                    const entry = getOrCreateMutableBlock(assistantBlocksByIndex, index, 'tool_use');
                                    entry.toolInputJsonBuffer += delta.partial_json;
                                    continue;
                                }

                                if (deltaType === 'signature_delta' && typeof delta.signature === 'string' && delta.signature) {
                                    const entry = getOrCreateMutableBlock(assistantBlocksByIndex, index, 'thinking');
                                    appendStringField(entry.block, 'signature', delta.signature);
                                    continue;
                                }

                                continue;
                            }

                            if (eventType === 'message_delta') {
                                const delta = isRecord(data.delta) ? data.delta : null;
                                if (delta && typeof delta.stop_reason === 'string') {
                                    stopReason = delta.stop_reason;
                                }
                                continue;
                            }

                            if (eventType === 'message_start') {
                                const message = isRecord(data.message) ? data.message : null;
                                if (message && typeof message.stop_reason === 'string') {
                                    stopReason = message.stop_reason;
                                }
                                continue;
                            }
                        } catch (error) {
                            if (error instanceof Error) {
                                throw new Error(`Claude stream parse error: ${error.message}`);
                            }
                            throw error;
                        }
                    }
                }

                if (stopReason === 'pause_turn') {
                    pauseTurnCount += 1;
                    if (pauseTurnCount > pauseTurnMax) {
                        throw new Error(`Claude pause_turn limit exceeded (${pauseTurnMax})`);
                    }

                    const assistantBlocks = finalizeAssistantBlocks(assistantBlocksByIndex);
                    if (assistantBlocks.length === 0) {
                        throw new Error('Claude returned pause_turn without assistant content');
                    }

                    conversationMessages.push({
                        role: 'assistant',
                        content: assistantBlocks,
                    });
                    continue;
                }

                if (summarySeen && !summaryDoneEmitted) {
                    summaryDoneEmitted = true;
                    yield { type: 'reasoning_summary_done' };
                }

                return;
            }

            if (summarySeen && !summaryDoneEmitted) {
                summaryDoneEmitted = true;
                yield { type: 'reasoning_summary_done' };
            }
            return;
        } catch (error) {
            lastError = error;
            const canFallbackToNextToolSet = (
                hasNextToolAttempt &&
                !emittedAnyContentThisToolAttempt &&
                error instanceof ClaudeApiRequestError &&
                isToolCompatibilityError(error.status, error.body)
            );

            if (canFallbackToNextToolSet) {
                continue;
            }

            throw error;
        }
    }

    if (lastError instanceof Error) {
        throw lastError;
    }

    throw new Error('Claude stream failed without a recoverable response');
}
