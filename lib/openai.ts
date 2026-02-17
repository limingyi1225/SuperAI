import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface OpenAIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | OpenAIContentPart[];
}

export interface OpenAIContentPart {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
        url: string;
        detail?: 'low' | 'high' | 'auto';
    };
}

export interface OpenAIStreamEvent {
    type: 'answer_delta' | 'reasoning_summary_delta' | 'reasoning_summary_done';
    content?: string;
}

type WebSearchContextSize = 'low' | 'medium' | 'high';

type OpenAIResponsesTool =
    | { type: 'web_search' }
    | { type: 'web_search_preview'; search_context_size?: WebSearchContextSize }
    | { type: 'code_interpreter'; container: { type: 'auto' } };

type OpenAIReasoningSummaryMode = 'auto' | 'concise' | 'detailed';
type OpenAITextVerbosity = 'low' | 'medium' | 'high';

const WEB_SEARCH_CONTEXT_SIZES: readonly WebSearchContextSize[] = ['low', 'medium', 'high'];

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined) return defaultValue;

    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
}

function resolveWebSearchTool(): OpenAIResponsesTool | null {
    const webSearchEnabled = parseBooleanEnv('OPENAI_ENABLE_WEB_SEARCH', true);
    if (!webSearchEnabled) return null;

    // `web_search` is the current default in docs; keep preview mode optional for compatibility.
    const toolType = process.env.OPENAI_WEB_SEARCH_TOOL_TYPE?.trim().toLowerCase();
    if (toolType === 'web_search_preview') {
        const sizeRaw = process.env.OPENAI_WEB_SEARCH_CONTEXT_SIZE?.trim().toLowerCase();
        const size = (
            sizeRaw && WEB_SEARCH_CONTEXT_SIZES.includes(sizeRaw as WebSearchContextSize)
                ? (sizeRaw as WebSearchContextSize)
                : 'medium'
        );
        const tool: OpenAIResponsesTool = {
            type: 'web_search_preview',
            search_context_size: size,
        };
        return tool;
    }

    return { type: 'web_search' };
}

function shouldEnableCodeInterpreter(requestedModel: string, resolvedModelName: string): boolean {
    const codeInterpreterEnabled = parseBooleanEnv('OPENAI_ENABLE_CODE_INTERPRETER', false);
    if (!codeInterpreterEnabled) return false;

    const requested = requestedModel.toLowerCase();
    if (requested === 'gpt-5.2-pro') return false;
    if (requested === 'gpt-5.2' || requested === 'gpt-5.2-high') return true;

    const resolved = resolvedModelName.toLowerCase();
    return resolved.includes('gpt-5.2') && !resolved.includes('gpt-5.2-pro');
}

function buildOpenAITools(
    resolvedModelName: string,
    requestedModel: string,
    options?: { forceWebOnly?: boolean }
): OpenAIResponsesTool[] {
    if (parseBooleanEnv('OPENAI_FORCE_DISABLE_TOOLS', false)) return [];

    const tools: OpenAIResponsesTool[] = [];
    const webSearchTool = resolveWebSearchTool();
    if (webSearchTool) tools.push(webSearchTool);

    if (!options?.forceWebOnly && shouldEnableCodeInterpreter(requestedModel, resolvedModelName)) {
        tools.push({ type: 'code_interpreter', container: { type: 'auto' } });
    }

    return tools;
}

function areToolSetsEquivalent(a: OpenAIResponsesTool[], b: OpenAIResponsesTool[]): boolean {
    const signature = (tools: OpenAIResponsesTool[]) => (
        tools.map(tool => `${tool.type}:${JSON.stringify(tool)}`).sort().join('|')
    );
    return signature(a) === signature(b);
}

function isToolCompatibilityError(status: number, errorBody: string): boolean {
    if (status < 400 || status >= 500) return false;

    const message = errorBody.toLowerCase();
    const hasToolHint = /(tool|tools|web_search|web_search_preview|code_interpreter)/.test(message);
    const hasCompatibilityHint = /(unsupported|not supported|invalid|unknown|unrecognized|not allowed|not available)/.test(message);
    return hasToolHint && hasCompatibilityHint;
}

function isNonProGpt52Model(requestedModel: string, resolvedModelName: string): boolean {
    const requested = requestedModel.toLowerCase();
    if (requested === 'gpt-5.2-pro') return false;
    if (requested === 'gpt-5.2' || requested === 'gpt-5.2-high') return true;

    const resolved = resolvedModelName.toLowerCase();
    return resolved.includes('gpt-5.2') && !resolved.includes('pro');
}

function resolveResponsesOutputControls(
    requestedModel: string,
    resolvedModelName: string
): { summary: OpenAIReasoningSummaryMode; verbosity: OpenAITextVerbosity } {
    if (isNonProGpt52Model(requestedModel, resolvedModelName)) {
        return { summary: 'concise', verbosity: 'medium' };
    }

    return { summary: 'auto', verbosity: 'medium' };
}

function buildResponsesRequestBody(
    modelName: string,
    requestedModel: string,
    effort: 'low' | 'medium' | 'high',
    input: unknown,
    tools: OpenAIResponsesTool[]
): Record<string, unknown> {
    const controls = resolveResponsesOutputControls(requestedModel, modelName);

    const body: Record<string, unknown> = {
        model: modelName,
        stream: true,
        reasoning: { effort: effort, summary: controls.summary },
        text: { verbosity: controls.verbosity },
        input,
    };

    if (tools.length > 0) {
        body.tools = tools;
        body.tool_choice = 'auto';
    }

    return body;
}

async function requestResponsesStream(body: Record<string, unknown>): Promise<Response> {
    return fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
    });
}

function extractReasoningSummaryText(summary: unknown): string {
    if (!Array.isArray(summary)) return '';

    const parts: string[] = [];
    for (const entry of summary) {
        if (!entry || typeof entry !== 'object') continue;

        const candidate = entry as { text?: unknown; type?: unknown; summary_text?: unknown };
        if (typeof candidate.text === 'string' && candidate.text.trim()) {
            parts.push(candidate.text);
            continue;
        }

        if (candidate.type === 'summary_text' && typeof candidate.summary_text === 'string') {
            const text = candidate.summary_text.trim();
            if (text) parts.push(text);
        }
    }

    return parts.join('\n').trim();
}

export async function* streamOpenAIResponse(
    messages: OpenAIMessage[],
    model: string,
    effort: 'low' | 'medium' | 'high' = 'high'
): AsyncGenerator<OpenAIStreamEvent> {
    let modelName: string;
    if (model === 'gpt-5.2-high') {
        modelName = process.env.OPENAI_MODEL_HIGH || 'gpt-5.2';
    } else if (model === 'gpt-5.2-pro') {
        modelName = process.env.OPENAI_MODEL_PRO || 'gpt-5.2-pro';
    } else if (model === 'gpt-5-nano') {
        modelName = 'gpt-5-nano';
    } else {
        modelName = model;
    }

    // Check if we need to use the custom GPT-5 format
    const useResponsesApi = modelName.includes('5.') || modelName.startsWith('gpt-5');
    if (useResponsesApi) {
        const input = messages
            .map(msg => {
                const content: Array<Record<string, unknown>> = [];

                if (Array.isArray(msg.content)) {
                    for (const part of msg.content) {
                        if (part.type === 'text') {
                            const text = part.text || '';
                            if (!text) continue;
                            content.push(
                                msg.role === 'assistant'
                                    ? { type: 'output_text', text }
                                    : { type: 'input_text', text }
                            );
                            continue;
                        }

                        if (part.type === 'image_url') {
                            const imageUrl = part.image_url?.url;
                            if (!imageUrl) continue;
                            // Assistant history items in Responses input must be output_* items.
                            content.push(
                                msg.role === 'assistant'
                                    ? { type: 'output_text', text: imageUrl }
                                    : { type: 'input_image', image_url: imageUrl }
                            );
                        }
                    }
                } else {
                    content.push(
                        msg.role === 'assistant'
                            ? { type: 'output_text', text: msg.content }
                            : { type: 'input_text', text: msg.content }
                    );
                }

                return {
                    role: msg.role,
                    content,
                };
            })
            .filter(item => Array.isArray(item.content) && item.content.length > 0);

        const initialTools = buildOpenAITools(modelName, model);
        let response = await requestResponsesStream(
            buildResponsesRequestBody(modelName, model, effort, input, initialTools)
        );

        if (!response.ok) {
            const errorBody = await response.text();

            const webOnlyTools = buildOpenAITools(modelName, model, { forceWebOnly: true });
            const shouldRetryWebOnly = (
                isToolCompatibilityError(response.status, errorBody) &&
                webOnlyTools.length > 0 &&
                !areToolSetsEquivalent(initialTools, webOnlyTools)
            );

            if (shouldRetryWebOnly) {
                response = await requestResponsesStream(
                    buildResponsesRequestBody(modelName, model, effort, input, webOnlyTools)
                );

                if (!response.ok) {
                    const retryErrorBody = await response.text();
                    throw new Error(
                        `OpenAI API error (${response.status} ${response.statusText}) after web-only retry: ${retryErrorBody}`
                    );
                }
            } else {
                throw new Error(`OpenAI API error (${response.status} ${response.statusText}): ${errorBody}`);
            }
        }

        if (!response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let summaryBuffer = '';
        let summaryDoneEmitted = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.trim() === 'data: [DONE]') continue;
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        // Handle standard Chat Completions format
                        const chatContent = data.choices?.[0]?.delta?.content;
                        if (chatContent) {
                            yield { type: 'answer_delta', content: chatContent };
                        }

                        // Handle new Responses API format
                        if (data.type === 'response.output_text.delta' && data.delta) {
                            yield { type: 'answer_delta', content: data.delta };
                        }

                        if (
                            data.type === 'response.reasoning_summary_text.delta' &&
                            typeof data.delta === 'string' &&
                            data.delta
                        ) {
                            summaryBuffer += data.delta;
                            yield { type: 'reasoning_summary_delta', content: data.delta };
                        }

                        if (
                            data.type === 'response.reasoning_summary_part.done' &&
                            typeof data.part?.text === 'string' &&
                            data.part.text
                        ) {
                            if (!summaryBuffer.trim()) {
                                summaryBuffer = data.part.text;
                                yield { type: 'reasoning_summary_delta', content: data.part.text };
                            }
                            if (!summaryDoneEmitted) {
                                summaryDoneEmitted = true;
                                yield { type: 'reasoning_summary_done' };
                            }
                        }

                        if (
                            data.type === 'response.reasoning_summary_text.done' &&
                            typeof data.text === 'string'
                        ) {
                            if (!summaryBuffer.trim() && data.text.trim()) {
                                summaryBuffer = data.text;
                                yield { type: 'reasoning_summary_delta', content: data.text };
                            }
                            if (!summaryDoneEmitted) {
                                summaryDoneEmitted = true;
                                yield { type: 'reasoning_summary_done' };
                            }
                        }

                        if (data.type === 'response.output_item.done' && data.item?.type === 'reasoning') {
                            const summaryText = extractReasoningSummaryText(data.item?.summary);
                            if (!summaryBuffer.trim() && summaryText) {
                                summaryBuffer = summaryText;
                                yield { type: 'reasoning_summary_delta', content: summaryText };
                            }
                            if (!summaryDoneEmitted) {
                                summaryDoneEmitted = true;
                                yield { type: 'reasoning_summary_done' };
                            }
                        }

                        if (data.type === 'response.completed' && !summaryDoneEmitted) {
                            const reasoningOutput = Array.isArray(data.response?.output)
                                ? data.response.output.find((item: unknown) => (
                                    typeof item === 'object' &&
                                    item !== null &&
                                    (item as { type?: unknown }).type === 'reasoning'
                                ))
                                : null;
                            const summaryText = extractReasoningSummaryText(reasoningOutput?.summary);

                            if (!summaryBuffer.trim() && summaryText) {
                                summaryBuffer = summaryText;
                                yield { type: 'reasoning_summary_delta', content: summaryText };
                            }
                            if (summaryBuffer.trim()) {
                                summaryDoneEmitted = true;
                                yield { type: 'reasoning_summary_done' };
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing SSE:', e);
                    }
                }
            }
        }
    } else {
        // Standard OpenAI API usage
        const requestOptions: OpenAI.Chat.ChatCompletionCreateParams & {
            reasoning_effort?: 'low' | 'medium' | 'high';
        } = {
            model: modelName,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            stream: true,
        };

        // Add reasoning effort only for o-series models (o1, o3, etc) which support it
        if (modelName.startsWith('o1') || modelName.startsWith('o3')) {
            requestOptions.reasoning_effort = effort;
        }

        const stream = await openai.chat.completions.create(requestOptions);

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield { type: 'answer_delta', content };
            }
        }
    }
}

export default openai;
