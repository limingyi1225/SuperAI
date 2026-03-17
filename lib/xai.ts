import { streamText, type ModelMessage, type ToolSet } from 'ai';
import { createXai, type XaiProvider } from '@ai-sdk/xai';

type XAIDataContent = string | Uint8Array | ArrayBuffer | Buffer | URL;

export interface XAITextPart {
    type: 'text';
    text: string;
}

export interface XAIImagePart {
    type: 'image';
    image: XAIDataContent;
    mediaType?: string;
}

export interface XAIFilePart {
    type: 'file';
    data: XAIDataContent;
    mediaType: string;
    filename?: string;
}

export type XAIUserContentPart = XAITextPart | XAIImagePart | XAIFilePart;

export interface XAIUserMessage {
    role: 'user';
    content: string | XAIUserContentPart[];
}

export interface XAIAssistantMessage {
    role: 'assistant';
    content: string | XAITextPart[];
}

export type XAIMessage = XAIUserMessage | XAIAssistantMessage;

export interface XAIStreamEvent {
    type: 'answer_delta' | 'reasoning_summary_delta' | 'reasoning_summary_done';
    content?: string;
}

type XAIReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
type XAIProviderLike = Pick<XaiProvider, 'responses' | 'tools'>;
type XAIRawInputMessage =
    | {
        role: 'system' | 'assistant';
        content: string;
    }
    | {
        role: 'user';
        content: XAIRawUserContentPart[];
    };

type XAIRawUserContentPart =
    | {
        type: 'input_text';
        text: string;
    }
    | {
        type: 'input_image';
        image_url: string;
    }
    | {
        type: 'input_file';
        file_id: string;
    };

interface XAIStreamRequest {
    model: ReturnType<XAIProviderLike['responses']>;
    system?: string;
    messages: ModelMessage[];
    tools: ToolSet;
    providerOptions: {
        xai: {
            reasoning: { effort: XAIReasoningEffort };
        };
    };
}

interface XAIStreamPart {
    type: string;
    delta?: string;
    text?: string;
}

interface XAITextStreamResult {
    fullStream: AsyncIterable<XAIStreamPart>;
}

type XAIStreamRunner = (
    request: XAIStreamRequest
) => XAITextStreamResult | Promise<XAITextStreamResult>;

interface XAIDirectRequest {
    messages: XAIMessage[];
    model: string;
    reasoningEffort: XAIReasoningEffort;
    systemInstruction?: string;
}

type XAIDirectRunner = (
    request: XAIDirectRequest
) => AsyncIterable<XAIStreamEvent> | AsyncGenerator<XAIStreamEvent>;

const DEFAULT_GROK_MULTI_AGENT_MODEL = 'grok-4.20-multi-agent-beta-latest';
const GROK_MULTI_AGENT_DEEP_MODEL = 'grok-4.20-multi-agent-beta-latest-deep';
const DEFAULT_XAI_PDF_FILENAME = 'document.pdf';
const XAI_API_BASE_URL = 'https://api.x.ai/v1';

function getRequiredXAIAPIKey(): string {
    const apiKey = process.env.XAI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('XAI_API_KEY is required to use Grok models');
    }

    return apiKey;
}

function createConfiguredXAIProvider(): XAIProviderLike {
    const apiKey = getRequiredXAIAPIKey();

    return createXai({
        apiKey,
        baseURL: XAI_API_BASE_URL,
    });
}

function normalizeBase64Asset(asset: string, prefix: string): string {
    const trimmed = asset.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('data:') ? trimmed : `${prefix}${trimmed}`;
}

function normalizeTextPart(part: XAITextPart): XAITextPart | null {
    const text = part.text.trim();
    if (!text) return null;
    return {
        type: 'text',
        text,
    };
}

function normalizeUserContentParts(parts: XAIUserContentPart[]): XAIUserContentPart[] {
    return parts.flatMap((part): XAIUserContentPart[] => {
        if (part.type === 'text') {
            const normalized = normalizeTextPart(part);
            return normalized ? [normalized] : [];
        }

        if (part.type === 'image') {
            if (typeof part.image === 'string') {
                const normalizedImage = part.image.trim();
                if (!normalizedImage) return [];
                return [{
                    ...part,
                    image: normalizedImage,
                }];
            }

            return [part];
        }

        if (typeof part.data === 'string') {
            const normalizedData = part.data.trim();
            if (!normalizedData || !part.mediaType) return [];
            return [{
                ...part,
                data: normalizedData,
            }];
        }

        if (!part.mediaType) return [];
        return [part];
    });
}

function normalizeAssistantContentParts(parts: XAITextPart[]): XAITextPart[] {
    return parts.flatMap((part): XAITextPart[] => {
        const normalized = normalizeTextPart(part);
        return normalized ? [normalized] : [];
    });
}

function isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
}

function isUserMessageWithParts(message: XAIMessage): message is XAIUserMessage & { content: XAIUserContentPart[] } {
    return message.role === 'user' && Array.isArray(message.content);
}

function requiresDirectResponses(messages: XAIMessage[]): boolean {
    return messages.some(message => (
        isUserMessageWithParts(message) &&
        message.content.some(part => part.type !== 'text')
    ));
}

function toImageUrl(image: XAIImagePart): string {
    if (typeof image.image === 'string') {
        const trimmed = image.image.trim();
        if (!trimmed) {
            throw new Error('Image content cannot be empty');
        }
        if (trimmed.startsWith('data:') || isHttpUrl(trimmed)) {
            return trimmed;
        }

        const mediaType = image.mediaType || 'image/jpeg';
        return `data:${mediaType};base64,${trimmed}`;
    }

    if (image.image instanceof URL) {
        return image.image.toString();
    }

    const bytes = image.image instanceof ArrayBuffer
        ? new Uint8Array(image.image)
        : image.image;
    const base64 = Buffer.from(bytes).toString('base64');
    const mediaType = image.mediaType || 'image/jpeg';
    return `data:${mediaType};base64,${base64}`;
}

function dataContentToBuffer(data: XAIDataContent): Buffer {
    if (typeof data === 'string') {
        const trimmed = data.trim();
        if (!trimmed) {
            throw new Error('File content cannot be empty');
        }

        const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/);
        if (dataUrlMatch) {
            return Buffer.from(dataUrlMatch[2], 'base64');
        }

        if (isHttpUrl(trimmed)) {
            throw new Error('Remote file URLs are not supported for Grok PDF uploads in this app');
        }

        return Buffer.from(trimmed, 'base64');
    }

    if (data instanceof URL) {
        throw new Error('Remote file URLs are not supported for Grok PDF uploads in this app');
    }

    if (data instanceof ArrayBuffer) {
        return Buffer.from(data);
    }

    return Buffer.from(data);
}

function normalizeAssistantContentText(content: string | XAITextPart[]): string {
    if (typeof content === 'string') {
        return content.trim();
    }

    return normalizeAssistantContentParts(content)
        .map(part => part.text)
        .join('\n\n')
        .trim();
}

async function uploadXAIFile(apiKey: string, filePart: XAIFilePart): Promise<string> {
    const formData = new FormData();
    const fileName = filePart.filename?.trim() || DEFAULT_XAI_PDF_FILENAME;
    const fileBuffer = dataContentToBuffer(filePart.data);
    const fileBytes = new Uint8Array(fileBuffer.byteLength);
    fileBytes.set(fileBuffer);
    const fileBlob = new Blob([fileBytes.buffer], { type: filePart.mediaType });

    formData.set('purpose', 'user_data');
    formData.set('file', fileBlob, fileName);

    const response = await fetch(`${XAI_API_BASE_URL}/files`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`xAI file upload failed (${response.status}): ${errorText || response.statusText}`);
    }

    const payload = await response.json() as { id?: unknown };
    if (typeof payload.id !== 'string' || !payload.id) {
        throw new Error('xAI file upload did not return a file id');
    }

    return payload.id;
}

async function deleteXAIFile(apiKey: string, fileId: string): Promise<void> {
    try {
        await fetch(`${XAI_API_BASE_URL}/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });
    } catch {
        // Best-effort cleanup only.
    }
}

async function buildDirectInput(
    messages: XAIMessage[],
    systemInstruction: string | undefined,
    apiKey: string,
    uploadedFileIds: string[]
): Promise<XAIRawInputMessage[]> {
    const input: XAIRawInputMessage[] = [];

    if (systemInstruction?.trim()) {
        input.push({
            role: 'system',
            content: systemInstruction.trim(),
        });
    }

    for (const message of messages) {
        if (message.role === 'assistant') {
            const content = normalizeAssistantContentText(message.content);
            if (!content) continue;

            input.push({
                role: 'assistant',
                content,
            });
            continue;
        }

        if (typeof message.content === 'string') {
            const content = message.content.trim();
            if (!content) continue;

            input.push({
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: content,
                }],
            });
            continue;
        }

        const normalizedParts = normalizeUserContentParts(message.content);
        const rawContent: XAIRawUserContentPart[] = [];

        for (const part of normalizedParts) {
            if (part.type === 'text') {
                rawContent.push({
                    type: 'input_text',
                    text: part.text,
                });
                continue;
            }

            if (part.type === 'image') {
                rawContent.push({
                    type: 'input_image',
                    image_url: toImageUrl(part),
                });
                continue;
            }

            if (part.mediaType.startsWith('image/')) {
                rawContent.push({
                    type: 'input_image',
                    image_url: toImageUrl({
                        type: 'image',
                        image: part.data,
                        mediaType: part.mediaType,
                    }),
                });
                continue;
            }

            const fileId = await uploadXAIFile(apiKey, part);
            uploadedFileIds.push(fileId);
            rawContent.push({
                type: 'input_file',
                file_id: fileId,
            });
        }

        if (rawContent.length === 0) continue;

        input.push({
            role: 'user',
            content: rawContent,
        });
    }

    return input;
}

async function* parseXAIEventStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            while (true) {
                const separatorIndex = buffer.indexOf('\n\n');
                if (separatorIndex === -1) break;

                const rawEvent = buffer.slice(0, separatorIndex);
                buffer = buffer.slice(separatorIndex + 2);

                const data = rawEvent
                    .split(/\r?\n/)
                    .filter(line => line.startsWith('data:'))
                    .map(line => line.slice(5).trimStart())
                    .join('\n')
                    .trim();

                if (!data || data === '[DONE]') {
                    continue;
                }

                yield JSON.parse(data) as Record<string, unknown>;
            }
        }

        const tail = buffer.trim();
        if (tail) {
            const data = tail
                .split(/\r?\n/)
                .filter(line => line.startsWith('data:'))
                .map(line => line.slice(5).trimStart())
                .join('\n')
                .trim();

            if (data && data !== '[DONE]') {
                yield JSON.parse(data) as Record<string, unknown>;
            }
        }
    } finally {
        reader.releaseLock();
    }
}

async function* defaultDirectRunner(request: XAIDirectRequest): AsyncGenerator<XAIStreamEvent> {
    const apiKey = getRequiredXAIAPIKey();
    const uploadedFileIds: string[] = [];
    let reasoningSummarySeen = false;
    let reasoningSummaryDone = false;

    try {
        const input = await buildDirectInput(request.messages, request.systemInstruction, apiKey, uploadedFileIds);
        const body = {
            model: request.model,
            stream: true,
            reasoning: {
                effort: request.reasoningEffort,
            },
            tools: [{ type: 'web_search' }, { type: 'x_search' }, { type: 'code_execution' }],
            tool_choice: 'auto',
            input,
        };

        const response = await fetch(`${XAI_API_BASE_URL}/responses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`xAI responses request failed (${response.status}): ${errorText || response.statusText}`);
        }

        if (!response.body) {
            throw new Error('xAI responses stream returned no body');
        }

        for await (const event of parseXAIEventStream(response.body)) {
            const eventType = typeof event.type === 'string' ? event.type : '';

            if ((eventType === 'response.reasoning_summary_text.delta' || eventType === 'response.reasoning_text.delta') && typeof event.delta === 'string' && event.delta) {
                reasoningSummarySeen = true;
                yield {
                    type: 'reasoning_summary_delta',
                    content: event.delta,
                };
                continue;
            }

            if (!reasoningSummaryDone && reasoningSummarySeen && (
                eventType === 'response.reasoning_summary_text.done' ||
                eventType === 'response.reasoning_text.done' ||
                eventType === 'response.output_text.delta'
            )) {
                reasoningSummaryDone = true;
                yield {
                    type: 'reasoning_summary_done',
                };
            }

            if (eventType === 'response.output_text.delta' && typeof event.delta === 'string' && event.delta) {
                yield {
                    type: 'answer_delta',
                    content: event.delta,
                };
                continue;
            }

            if (!reasoningSummaryDone && reasoningSummarySeen && eventType === 'response.output_item.done') {
                const item = typeof event.item === 'object' && event.item !== null ? event.item as Record<string, unknown> : null;
                if (item?.type === 'reasoning') {
                    reasoningSummaryDone = true;
                    yield {
                        type: 'reasoning_summary_done',
                    };
                }
            }
        }

        if (reasoningSummarySeen && !reasoningSummaryDone) {
            yield {
                type: 'reasoning_summary_done',
            };
        }
    } finally {
        await Promise.all(uploadedFileIds.map(fileId => deleteXAIFile(apiKey, fileId)));
    }
}

function normalizeMessages(messages: XAIMessage[]): ModelMessage[] {
    const normalized: ModelMessage[] = [];

    for (const message of messages) {
        if (typeof message.content === 'string') {
            const content = message.content.trim();
            if (!content) continue;

            normalized.push({
                role: message.role,
                content,
            });
            continue;
        }

        if (message.role === 'assistant') {
            const contentParts = normalizeAssistantContentParts(message.content);
            if (contentParts.length === 0) continue;

            normalized.push({
                role: 'assistant',
                content: contentParts,
            });
            continue;
        }

        const contentParts = normalizeUserContentParts(message.content);
        if (contentParts.length === 0) continue;

        normalized.push({
            role: 'user',
            content: contentParts,
        });
    }

    return normalized;
}

const defaultStreamRunner: XAIStreamRunner = (request) => {
    return streamText({
        model: request.model as Parameters<typeof streamText>[0]['model'],
        system: request.system,
        messages: request.messages,
        tools: request.tools,
        providerOptions: request.providerOptions,
    });
};

interface BuildXAIUserContentOptions {
    text?: string;
    images?: string[];
    pdfs?: string[];
    fallbackText?: string;
}

export function buildXAIUserContent(options: BuildXAIUserContentOptions): string | XAIUserContentPart[] | null {
    const {
        text = '',
        images = [],
        pdfs = [],
        fallbackText,
    } = options;

    const parts: XAIUserContentPart[] = [];
    const trimmedText = text.trim();
    const hasAttachments = images.length > 0 || pdfs.length > 0;

    if (trimmedText) {
        parts.push({
            type: 'text',
            text: trimmedText,
        });
    } else if (hasAttachments && fallbackText?.trim()) {
        parts.push({
            type: 'text',
            text: fallbackText.trim(),
        });
    }

    for (const image of images) {
        const normalizedImage = normalizeBase64Asset(image, 'data:image/jpeg;base64,');
        if (!normalizedImage) continue;
        parts.push({
            type: 'image',
            image: normalizedImage,
        });
    }

    for (const pdf of pdfs) {
        const normalizedPdf = normalizeBase64Asset(pdf, 'data:application/pdf;base64,');
        if (!normalizedPdf) continue;
        parts.push({
            type: 'file',
            data: normalizedPdf,
            mediaType: 'application/pdf',
            filename: DEFAULT_XAI_PDF_FILENAME,
        });
    }

    if (parts.length === 0) return null;
    if (parts.length === 1 && parts[0].type === 'text') {
        return parts[0].text;
    }

    return parts;
}

export function resolveXAIModelName(model: string): string {
    if (
        model === DEFAULT_GROK_MULTI_AGENT_MODEL ||
        model === GROK_MULTI_AGENT_DEEP_MODEL
    ) {
        return process.env.XAI_MODEL_GROK_MULTI_AGENT || DEFAULT_GROK_MULTI_AGENT_MODEL;
    }

    return model;
}

export function resolveXAIReasoningEffort(model: string): XAIReasoningEffort {
    if (model === GROK_MULTI_AGENT_DEEP_MODEL) return 'high';
    return 'medium';
}

export function buildXAITools(provider: Pick<XAIProviderLike, 'tools'>): ToolSet {
    return {
        web_search: provider.tools.webSearch(),
        x_search: provider.tools.xSearch(),
    };
}

export async function* streamXAIResponse(
    messages: XAIMessage[],
    model: string,
    systemInstruction?: string,
    runner: XAIStreamRunner = defaultStreamRunner,
    provider?: XAIProviderLike,
    directRunner: XAIDirectRunner = defaultDirectRunner
): AsyncGenerator<XAIStreamEvent> {
    const resolvedModelName = resolveXAIModelName(model);
    const reasoningEffort = resolveXAIReasoningEffort(model);

    if (requiresDirectResponses(messages)) {
        yield* directRunner({
            messages,
            model: resolvedModelName,
            reasoningEffort,
            systemInstruction,
        });
        return;
    }

    const resolvedProvider = provider ?? createConfiguredXAIProvider();
    const request: XAIStreamRequest = {
        model: resolvedProvider.responses(resolvedModelName),
        system: systemInstruction,
        messages: normalizeMessages(messages),
        tools: buildXAITools(resolvedProvider),
        providerOptions: {
            xai: {
                reasoning: { effort: reasoningEffort },
            },
        },
    };

    const result = await runner(request);
    let reasoningSummarySeen = false;
    let reasoningSummaryDone = false;

    for await (const part of result.fullStream) {
        const partText = part.text ?? part.delta;

        if (part.type === 'reasoning-delta' && partText) {
            reasoningSummarySeen = true;
            yield {
                type: 'reasoning_summary_delta',
                content: partText,
            };
            continue;
        }

        if (!reasoningSummaryDone && reasoningSummarySeen && (
            part.type === 'reasoning-end' || part.type === 'text-start' || part.type === 'text-delta'
        )) {
            reasoningSummaryDone = true;
            yield {
                type: 'reasoning_summary_done',
            };
        }

        if (part.type === 'text-delta' && partText) {
            yield {
                type: 'answer_delta',
                content: partText,
            };
        }
    }

    if (reasoningSummarySeen && !reasoningSummaryDone) {
        yield {
            type: 'reasoning_summary_done',
        };
    }
}
