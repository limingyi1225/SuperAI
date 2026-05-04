import { NextRequest } from 'next/server';
import { streamOpenAIResponse, OpenAIContentPart, OpenAIMessage } from '@/lib/openai';
import { streamGeminiResponse, GeminiContentPart, GeminiConversationContent } from '@/lib/gemini';
import { streamClaudeResponse, ClaudeContentPart, ClaudeMessage } from '@/lib/claude';
import { buildXAIUserContent, streamXAIResponse, XAIMessage } from '@/lib/xai';
import { normalizeModelId, resolveRequestedModels } from '@/lib/models';
import { MAX_HISTORY_TURNS, MAX_CHARS_PER_TURN } from '@/lib/hookUtils';
import { buildSystemPrompt } from '@/lib/systemPrompts';
import { isAssistantMode, type AssistantMode } from '@/lib/assistantMode';
import {
    toGeminiInlineData,
    toGeminiPdfPart,
    toClaudeImagePart,
    toClaudePdfPart,
} from '@/lib/mediaParts';
import { pipeProviderEvents, writeSSE } from '@/lib/sseEmitter';

export const runtime = 'nodejs';
export const maxDuration = 900; // 15 minutes timeout

interface AskRequest {
    question: string;
    images?: string[];
    pdfs?: string[];
    models: string[];
    language?: 'Chinese' | 'English';
    mode?: AssistantMode;
    history?: ConversationTurn[];
}

interface ConversationTurn {
    userText: string;
    modelAnswers?: Record<string, string>;
    userImages?: string[];
}

function clipText(value: string, maxChars = MAX_CHARS_PER_TURN): string {
    return value.length > maxChars ? value.slice(0, maxChars) : value;
}

function sanitizeHistory(history: unknown): ConversationTurn[] {
    if (!Array.isArray(history)) return [];

    const sanitized: ConversationTurn[] = [];
    const recentHistory = history.slice(-MAX_HISTORY_TURNS);

    for (const turn of recentHistory) {
        if (!turn || typeof turn !== 'object') continue;

        const rawUserText = (turn as { userText?: unknown }).userText;
        if (typeof rawUserText !== 'string') continue;

        const userText = clipText(rawUserText);

        const modelAnswers: Record<string, string> = {};
        const rawModelAnswers = (turn as { modelAnswers?: unknown }).modelAnswers;

        if (rawModelAnswers && typeof rawModelAnswers === 'object' && !Array.isArray(rawModelAnswers)) {
            for (const [modelId, answer] of Object.entries(rawModelAnswers as Record<string, unknown>)) {
                if (typeof answer !== 'string') continue;
                const clippedAnswer = clipText(answer);
                if (!clippedAnswer.trim()) continue;
                modelAnswers[modelId] = clippedAnswer;
            }
        }

        const userImages: string[] = [];
        const rawUserImages = (turn as { userImages?: unknown }).userImages;

        if (Array.isArray(rawUserImages)) {
            for (const image of rawUserImages) {
                if (typeof image !== 'string') continue;
                const normalized = image.trim();
                if (!normalized) continue;
                userImages.push(normalized);
            }
        }

        // Keep turns that have text OR images.
        if (!userText.trim() && userImages.length === 0) continue;

        sanitized.push({
            userText,
            modelAnswers,
            ...(userImages.length > 0 ? { userImages } : {}),
        });
    }

    return sanitized;
}

function getAssistantTextForModel(
    modelAnswers: Record<string, string> | undefined,
    requestedModelId: string,
    canonicalModelId: string
): string | undefined {
    if (!modelAnswers) return undefined;

    const directMatch = modelAnswers[requestedModelId];
    if (directMatch && directMatch.trim()) return directMatch;

    const canonicalMatch = modelAnswers[canonicalModelId];
    if (canonicalMatch && canonicalMatch.trim()) return canonicalMatch;

    for (const [modelId, answer] of Object.entries(modelAnswers)) {
        if (!answer.trim()) continue;
        if (normalizeModelId(modelId) === canonicalModelId) return answer;
    }

    return undefined;
}

const MAX_REQUEST_BYTES = 80 * 1024 * 1024; // 80 MB — base64 inflates raw bytes ~1.33×

function isDataUrlOrBase64(value: unknown): value is string {
    if (typeof value !== 'string' || !value) return false;
    if (value.startsWith('data:')) return true;
    // Allow plain base64 (no data: prefix) — providers wrap it themselves.
    return !/^https?:/i.test(value);
}

export async function POST(request: NextRequest) {
    try {
        const contentLengthHeader = request.headers.get('content-length');
        if (contentLengthHeader) {
            const contentLength = Number(contentLengthHeader);
            if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
                return new Response(
                    JSON.stringify({ error: `Request body exceeds size limit (${MAX_REQUEST_BYTES / 1024 / 1024} MB)` }),
                    { status: 413, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        const body: AskRequest = await request.json();
        const { question, images: rawImages = [], pdfs: rawPdfs = [], models = [], language: rawLanguage, mode: rawMode, history = [] } = body;

        // Validate language enum to avoid log injection and unintended prompt branches.
        const language: 'Chinese' | 'English' = rawLanguage === 'English' ? 'English' : 'Chinese';
        // Default to 'solver' for backward compat with older clients.
        const mode: AssistantMode = isAssistantMode(rawMode) ? rawMode : 'solver';

        // Reject http(s):// inputs — only data: URIs or raw base64 are expected for images/pdfs.
        const images: string[] = Array.isArray(rawImages) ? rawImages.filter(isDataUrlOrBase64) : [];
        const pdfs: string[] = Array.isArray(rawPdfs) ? rawPdfs.filter(isDataUrlOrBase64) : [];

        const sanitizedHistory = sanitizeHistory(history);
        const requestedModels = Array.isArray(models)
            ? models.filter((modelId): modelId is string => typeof modelId === 'string')
            : [];
        const resolvedModels = resolveRequestedModels(requestedModels);

        const normalizedAliases = resolvedModels
            .filter(model => model.requestedId !== model.canonicalId)
            .map(model => `${model.requestedId}->${model.canonicalId}`);

        console.log(
            `[Ask API] Processing request. Mode: ${mode}, Language: ${language}, Requested Models: ${requestedModels.join(', ')}, Canonical Models: ${resolvedModels.map(model => model.canonicalId).join(', ')}, Aliases: ${normalizedAliases.join(', ') || 'none'}, Current images: ${images.length}, Current PDFs: ${pdfs.length}, History turns: ${sanitizedHistory.length}, History turns with images: ${sanitizedHistory.filter(t => t.userImages && t.userImages.length > 0).length}`
        );

        if (!question && images.length === 0 && pdfs.length === 0) {
            return new Response(JSON.stringify({ error: 'No question or images provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (requestedModels.length === 0) {
            return new Response(JSON.stringify({ error: 'No models selected' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        // Signal the writer loop to give up when the client disconnects.
        // (Provider SDKs won't observe this yet, but queued writes short-circuit
        // and Promise.all unblocks so the handler exits promptly.)
        const clientAborted = { flag: false };
        if (request.signal) {
            request.signal.addEventListener('abort', () => {
                clientAborted.flag = true;
            }, { once: true });
        }

        const processModels = async () => {
            const modelPromises = resolvedModels.map(async ({ requestedId: modelId, canonicalId, config: modelConfig }) => {
                if (!modelConfig) {
                    if (clientAborted.flag) return;
                    await writeSSE(writer, { type: 'error', modelId, error: 'Model not found' });
                    return;
                }

                try {
                    if (clientAborted.flag) return;
                    await writeSSE(writer, { type: 'start', modelId, modelName: modelConfig.name });

                    const systemPrompt = buildSystemPrompt(modelConfig.provider, mode, language);

                    const attachmentFallbackText = mode === 'general'
                        ? (language === 'English'
                            ? 'Please look at the attached image(s)/document(s) and respond.'
                            : '请查看附带的图片/文档并作答。')
                        : (language === 'English'
                            ? 'Read the problem from the image/document and answer in English. Start with final answer, then provide detailed steps.'
                            : '请识别图片/文档中的题目并用中文作答。先给出最终答案，再给出详细步骤。除化学术语外请使用中文。');

                    if (modelConfig.provider === 'openai') {
                        const openAIEffort = modelConfig.effort === 'max' ? 'high' : modelConfig.effort;
                        const content: OpenAIContentPart[] = [];

                        for (const pdf of pdfs) {
                            content.push({ type: 'input_file', filename: 'document.pdf', file_data: pdf });
                        }

                        if (question.trim()) {
                            content.push({ type: 'text', text: question });
                        } else if (images.length > 0 || pdfs.length > 0) {
                            content.push({ type: 'text', text: attachmentFallbackText });
                        }

                        for (const img of images) {
                            content.push({
                                type: 'image_url',
                                image_url: {
                                    url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
                                    detail: 'high',
                                },
                            });
                        }

                        const historyMessages: OpenAIMessage[] = [];

                        for (const turn of sanitizedHistory) {
                            const userContent: OpenAIContentPart[] = [{ type: 'text', text: turn.userText }];

                            for (const image of turn.userImages ?? []) {
                                userContent.push({
                                    type: 'image_url',
                                    image_url: {
                                        url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`,
                                        detail: 'high',
                                    },
                                });
                            }

                            historyMessages.push({ role: 'user', content: userContent });

                            const assistantText = getAssistantTextForModel(turn.modelAnswers, modelId, canonicalId);
                            if (assistantText && assistantText.trim()) {
                                historyMessages.push({ role: 'assistant', content: assistantText });
                            }
                        }

                        const messages: OpenAIMessage[] = [
                            { role: 'system' as const, content: systemPrompt },
                            ...historyMessages,
                            { role: 'user' as const, content },
                        ];

                        await pipeProviderEvents(writer, modelId, streamOpenAIResponse(messages, canonicalId, openAIEffort));
                    } else if (modelConfig.provider === 'gemini') {
                        const geminiEffort = modelConfig.effort === 'max' ? 'high' : modelConfig.effort;
                        const questionPrefix = language === 'English' ? 'Question:' : '用户题目：';
                        const currentTurnParts: GeminiContentPart[] = [];

                        for (const pdf of pdfs) {
                            currentTurnParts.push(toGeminiPdfPart(pdf));
                        }

                        if (question.trim()) {
                            currentTurnParts.push({ text: `${questionPrefix}${question}` });
                        } else if (images.length > 0 || pdfs.length > 0) {
                            currentTurnParts.push({ text: attachmentFallbackText });
                        }

                        for (const img of images) {
                            const inlineData = toGeminiInlineData(img);
                            currentTurnParts.push({ inlineData });
                        }

                        const geminiContents: GeminiConversationContent[] = [];

                        for (const turn of sanitizedHistory) {
                            const userParts: GeminiContentPart[] = [{ text: `${questionPrefix}${turn.userText}` }];

                            for (const image of turn.userImages ?? []) {
                                const inlineData = toGeminiInlineData(image);
                                userParts.push({ inlineData });
                            }

                            geminiContents.push({ role: 'user', parts: userParts });

                            const assistantText = getAssistantTextForModel(turn.modelAnswers, modelId, canonicalId);
                            if (assistantText && assistantText.trim()) {
                                geminiContents.push({ role: 'model', parts: [{ text: assistantText }] });
                            }
                        }

                        if (currentTurnParts.length > 0) {
                            geminiContents.push({ role: 'user', parts: currentTurnParts });
                        }

                        await pipeProviderEvents(writer, modelId, streamGeminiResponse(geminiContents, geminiEffort, systemPrompt));
                    } else if (modelConfig.provider === 'claude') {
                        const currentContent: ClaudeContentPart[] = [];

                        for (const pdf of pdfs) {
                            currentContent.push(toClaudePdfPart(pdf));
                        }

                        if (question.trim()) {
                            currentContent.push({ type: 'text', text: question });
                        } else if (images.length > 0 || pdfs.length > 0) {
                            currentContent.push({ type: 'text', text: attachmentFallbackText });
                        }

                        for (const img of images) {
                            currentContent.push(toClaudeImagePart(img));
                        }

                        const claudeMessages: ClaudeMessage[] = [];

                        for (const turn of sanitizedHistory) {
                            const userContent: ClaudeContentPart[] = [];

                            if (turn.userText.trim()) {
                                userContent.push({ type: 'text', text: turn.userText });
                            }

                            for (const image of turn.userImages ?? []) {
                                userContent.push(toClaudeImagePart(image));
                            }

                            if (userContent.length > 0) {
                                claudeMessages.push({ role: 'user', content: userContent });
                            }

                            const assistantText = getAssistantTextForModel(turn.modelAnswers, modelId, canonicalId);
                            if (assistantText && assistantText.trim()) {
                                claudeMessages.push({ role: 'assistant', content: assistantText });
                            }
                        }

                        if (currentContent.length > 0) {
                            claudeMessages.push({ role: 'user', content: currentContent });
                        }

                        await pipeProviderEvents(
                            writer,
                            modelId,
                            streamClaudeResponse(claudeMessages, canonicalId, modelConfig.effort, systemPrompt),
                        );
                    } else if (modelConfig.provider === 'xai') {
                        const xaiMessages: XAIMessage[] = [];

                        for (const turn of sanitizedHistory) {
                            const userContent = buildXAIUserContent({
                                text: turn.userText,
                                images: turn.userImages ?? [],
                            });

                            if (userContent) {
                                xaiMessages.push({ role: 'user', content: userContent });
                            }

                            const assistantText = getAssistantTextForModel(turn.modelAnswers, modelId, canonicalId);
                            if (assistantText && assistantText.trim()) {
                                xaiMessages.push({ role: 'assistant', content: assistantText });
                            }
                        }

                        const currentUserContent = buildXAIUserContent({
                            text: question,
                            images,
                            pdfs,
                            fallbackText: attachmentFallbackText,
                        });

                        if (currentUserContent) {
                            xaiMessages.push({ role: 'user', content: currentUserContent });
                        }

                        await pipeProviderEvents(
                            writer,
                            modelId,
                            streamXAIResponse(xaiMessages, canonicalId, systemPrompt),
                        );
                    }

                    if (clientAborted.flag) return;
                    await writeSSE(writer, { type: 'done', modelId });
                } catch (error) {
                    if (clientAborted.flag) return;
                    console.error(`Error with model ${modelId}:`, error);
                    await writeSSE(writer, {
                        type: 'error',
                        modelId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            });

            await Promise.all(modelPromises);
            if (!clientAborted.flag) {
                await writeSSE(writer, { type: 'complete' });
            }
            try {
                await writer.close();
            } catch {
                // Writer may already be closed if the client aborted.
            }
        };

        processModels().catch(async err => {
            console.error('[Ask API] processModels crashed:', err);
            try {
                await writeSSE(writer, {
                    type: 'error',
                    error: err instanceof Error ? err.message : 'stream failed',
                });
            } catch {
                // writer may already be closed
            }
            try {
                await writer.close();
            } catch {
                // already closed
            }
        });

        return new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Ask API error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
