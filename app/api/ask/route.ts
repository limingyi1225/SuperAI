import { NextRequest } from 'next/server';
import { streamOpenAIResponse, OpenAIContentPart, OpenAIMessage } from '@/lib/openai';
import { streamGeminiResponse, GeminiContentPart, GeminiConversationContent } from '@/lib/gemini';
import { streamClaudeResponse, ClaudeContentPart, ClaudeMessage } from '@/lib/claude';
import { getModelById } from '@/lib/models';

export const runtime = 'nodejs';
export const maxDuration = 900; // 15 minutes timeout

interface AskRequest {
    question: string;
    images?: string[]; // base64 encoded images
    pdfs?: string[];   // base64 encoded PDFs (data:application/pdf;base64,...)
    models: string[]; // model IDs to use
    language?: 'Chinese' | 'English'; // Response language
    history?: ConversationTurn[];
}

interface ConversationTurn {
    userText: string;
    modelAnswers?: Record<string, string>;
    userImages?: string[];
}

const MAX_HISTORY_TURNS = 8;
const MAX_CHARS_PER_TURN = 12000;

function clipText(value: string, maxChars = MAX_CHARS_PER_TURN): string {
    return value.length > maxChars ? value.slice(0, maxChars) : value;
}

function toGeminiInlineData(image: string): { mimeType: string; data: string } {
    if (image.startsWith('data:')) {
        const match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
            return {
                mimeType: match[1],
                data: match[2],
            };
        }
    }

    return {
        mimeType: 'image/jpeg',
        data: image,
    };
}

function toClaudeImagePart(image: string): ClaudeContentPart {
    if (image.startsWith('data:')) {
        const match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
            return {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: match[1],
                    data: match[2],
                },
            };
        }
    }

    return {
        type: 'image',
        source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: image,
        },
    };
}

function toClaudePdfPart(pdf: string): ClaudeContentPart {
    const match = pdf.match(/^data:application\/pdf;base64,(.+)$/);
    const data = match ? match[1] : pdf;
    return {
        type: 'document',
        source: {
            type: 'base64',
            media_type: 'application/pdf',
            data,
        },
    };
}

function toGeminiPdfPart(pdf: string): GeminiContentPart {
    const match = pdf.match(/^data:application\/pdf;base64,(.+)$/);
    const data = match ? match[1] : pdf;
    return {
        inlineData: {
            mimeType: 'application/pdf',
            data,
        },
    };
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

        // Keep turns that have text OR images (don't drop image-only turns)
        if (!userText.trim() && userImages.length === 0) continue;

        sanitized.push({
            userText,
            modelAnswers,
            ...(userImages.length > 0 ? { userImages } : {}),
        });
    }

    return sanitized;
}

export async function POST(request: NextRequest) {
    try {
        const body: AskRequest = await request.json();
        const { question, images = [], pdfs = [], models, language = 'Chinese', history = [] } = body;
        const sanitizedHistory = sanitizeHistory(history);

        console.log(`[Ask API] Processing request. Language: ${language}, Models: ${models.join(', ')}, Current images: ${images.length}, Current PDFs: ${pdfs.length}, History turns: ${sanitizedHistory.length}, History turns with images: ${sanitizedHistory.filter(t => t.userImages && t.userImages.length > 0).length}`);

        if (!question && images.length === 0 && pdfs.length === 0) {
            return new Response(JSON.stringify({ error: 'No question or images provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!models || models.length === 0) {
            return new Response(JSON.stringify({ error: 'No models selected' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Create a TransformStream to handle SSE
        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        // Process each model in parallel
        const processModels = async () => {
            const modelPromises = models.map(async (modelId) => {
                const modelConfig = getModelById(modelId);
                if (!modelConfig) {
                    await writer.write(
                        encoder.encode(`data: ${JSON.stringify({
                            type: 'error',
                            modelId,
                            error: 'Model not found'
                        })}\n\n`)
                    );
                    return;
                }

                try {
                    // Send start event
                    await writer.write(
                        encoder.encode(`data: ${JSON.stringify({
                            type: 'start',
                            modelId,
                            modelName: modelConfig.name
                        })}\n\n`)
                    );

                    // Define language-specific prompts
                    const systemPrompt = language === 'English'
                        ? `You are an expert problem-solving assistant. You will receive questions (e.g., math, chemistry, economics) from users. Your task is to:

1. clearly state the final answer
2. show detailed step-by-step reasoning process for solving the problem. Ensure every step is logical, complete, and easy to understand.

Output language requirement: respond in English.`
                        : `你是一名解题助手。你将收到用户提出的问题（如数学题、化学题，经济题等），你的任务是：

1. 首先明确的展示答案
2. 展示详细的解题步骤和推理过程，确保具体且易于理解。
输出语言要求：学科专用术语必须使用英文，例如：元素、化合物、反应名、公式等，这些专用词汇不需要翻译成中文。其他的非学科专用词汇必须使用中文。`;

                    if (modelConfig.provider === 'openai') {
                        const openAIEffort = modelConfig.effort === 'max' ? 'high' : modelConfig.effort;
                        // Build OpenAI messages with per-model history.
                        const content: OpenAIContentPart[] = [];

                        // Attach PDFs inline as base64 via input_file with file_data
                        for (const pdf of pdfs) {
                            content.push({ type: 'input_file', filename: 'document.pdf', file_data: pdf } as unknown as OpenAIContentPart);
                        }

                        if (question.trim()) {
                            content.push({ type: 'text', text: question });
                        } else if (images.length > 0 || pdfs.length > 0) {
                            content.push({
                                type: 'text',
                                text: language === 'English'
                                    ? 'Read the problem from the image/document and answer in English. Start with final answer, then provide detailed steps.'
                                    : '请识别图片/文档中的题目并用中文作答。先给出最终答案，再给出详细步骤。除化学术语外请使用中文。'
                            });
                        }

                        for (const img of images) {
                            content.push({
                                type: 'image_url',
                                image_url: {
                                    url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
                                    detail: 'high'
                                },
                            });
                        }

                        const historyMessages: OpenAIMessage[] = [];

                        for (const turn of sanitizedHistory) {
                            const userContent: OpenAIContentPart[] = [
                                { type: 'text', text: turn.userText }
                            ];

                            for (const image of turn.userImages ?? []) {
                                userContent.push({
                                    type: 'image_url',
                                    image_url: {
                                        url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`,
                                        detail: 'high',
                                    },
                                });
                            }

                            historyMessages.push({
                                role: 'user',
                                content: userContent,
                            });

                            const assistantText = turn.modelAnswers?.[modelId];
                            if (assistantText && assistantText.trim()) {
                                historyMessages.push({
                                    role: 'assistant',
                                    content: assistantText,
                                });
                            }
                        }

                        const messages: OpenAIMessage[] = [
                            {
                                role: 'system' as const,
                                content: systemPrompt
                            },
                            ...historyMessages,
                            { role: 'user' as const, content },
                        ];

                        let reasoningSummaryStarted = false;
                        let reasoningSummaryDone = false;

                        for await (const event of streamOpenAIResponse(messages, modelId, openAIEffort)) {
                            if (event.type === 'answer_delta' && event.content) {
                                await writer.write(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: 'chunk',
                                        modelId,
                                        content: event.content
                                    })}\n\n`)
                                );
                                continue;
                            }

                            if (event.type === 'reasoning_summary_delta' && event.content) {
                                if (!reasoningSummaryStarted) {
                                    reasoningSummaryStarted = true;
                                    await writer.write(
                                        encoder.encode(`data: ${JSON.stringify({
                                            type: 'reasoning_summary_start',
                                            modelId
                                        })}\n\n`)
                                    );
                                }

                                await writer.write(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: 'reasoning_summary_chunk',
                                        modelId,
                                        content: event.content
                                    })}\n\n`)
                                );
                                continue;
                            }

                            if (event.type === 'reasoning_summary_done' && reasoningSummaryStarted && !reasoningSummaryDone) {
                                reasoningSummaryDone = true;
                                await writer.write(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: 'reasoning_summary_done',
                                        modelId
                                    })}\n\n`)
                                );
                            }
                        }

                        if (reasoningSummaryStarted && !reasoningSummaryDone) {
                            await writer.write(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: 'reasoning_summary_done',
                                    modelId
                                })}\n\n`)
                            );
                        }
                    } else if (modelConfig.provider === 'gemini') {
                        const geminiEffort = modelConfig.effort === 'max' ? 'high' : modelConfig.effort;
                        // Build Gemini content with per-model history.
                        const questionPrefix = language === 'English' ? 'Question:' : '用户题目：';
                        const currentTurnParts: GeminiContentPart[] = [];

                        for (const pdf of pdfs) {
                            currentTurnParts.push(toGeminiPdfPart(pdf));
                        }

                        if (question.trim()) {
                            currentTurnParts.push({
                                text: `${questionPrefix}${question}`
                            });
                        } else if (images.length > 0 || pdfs.length > 0) {
                            currentTurnParts.push({
                                text: language === 'English'
                                    ? 'Read the problem from the image/document and answer in English. Start with final answer, then provide detailed steps.'
                                    : '请识别图片/文档中的题目并用中文作答。先给出最终答案，再给出详细步骤。除化学术语外请使用中文。'
                            });
                        }

                        for (const img of images) {
                            const inlineData = toGeminiInlineData(img);
                            currentTurnParts.push({
                                inlineData: {
                                    mimeType: inlineData.mimeType,
                                    data: inlineData.data,
                                },
                            });
                        }

                        const geminiContents: GeminiConversationContent[] = [];

                        for (const turn of sanitizedHistory) {
                            const userParts: GeminiContentPart[] = [
                                { text: `${questionPrefix}${turn.userText}` },
                            ];

                            for (const image of turn.userImages ?? []) {
                                const inlineData = toGeminiInlineData(image);
                                userParts.push({
                                    inlineData: {
                                        mimeType: inlineData.mimeType,
                                        data: inlineData.data,
                                    },
                                });
                            }

                            geminiContents.push({
                                role: 'user',
                                parts: userParts,
                            });

                            const assistantText = turn.modelAnswers?.[modelId];
                            if (assistantText && assistantText.trim()) {
                                geminiContents.push({
                                    role: 'model',
                                    parts: [{ text: assistantText }],
                                });
                            }
                        }

                        if (currentTurnParts.length > 0) {
                            geminiContents.push({
                                role: 'user',
                                parts: currentTurnParts,
                            });
                        }

                        let reasoningSummaryStarted = false;
                        let reasoningSummaryDone = false;

                        for await (const event of streamGeminiResponse(geminiContents, geminiEffort, systemPrompt)) {
                            if (event.type === 'answer_delta' && event.content) {
                                await writer.write(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: 'chunk',
                                        modelId,
                                        content: event.content
                                    })}\n\n`)
                                );
                                continue;
                            }

                            if (event.type === 'reasoning_summary_delta' && event.content) {
                                if (!reasoningSummaryStarted) {
                                    reasoningSummaryStarted = true;
                                    await writer.write(
                                        encoder.encode(`data: ${JSON.stringify({
                                            type: 'reasoning_summary_start',
                                            modelId
                                        })}\n\n`)
                                    );
                                }

                                await writer.write(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: 'reasoning_summary_chunk',
                                        modelId,
                                        content: event.content
                                    })}\n\n`)
                                );
                                continue;
                            }

                            if (event.type === 'reasoning_summary_done' && reasoningSummaryStarted && !reasoningSummaryDone) {
                                reasoningSummaryDone = true;
                                await writer.write(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: 'reasoning_summary_done',
                                        modelId
                                    })}\n\n`)
                                );
                            }
                        }

                        if (reasoningSummaryStarted && !reasoningSummaryDone) {
                            await writer.write(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: 'reasoning_summary_done',
                                    modelId
                                })}\n\n`)
                            );
                        }
                    } else if (modelConfig.provider === 'claude') {
                        const currentContent: ClaudeContentPart[] = [];

                        for (const pdf of pdfs) {
                            currentContent.push(toClaudePdfPart(pdf));
                        }

                        if (question.trim()) {
                            currentContent.push({ type: 'text', text: question });
                        } else if (images.length > 0 || pdfs.length > 0) {
                            currentContent.push({
                                type: 'text',
                                text: language === 'English'
                                    ? 'Read the problem from the image/document and answer in English. Start with final answer, then provide detailed steps.'
                                    : '请识别图片/文档中的题目并用中文作答。先给出最终答案，再给出详细步骤。除化学术语外请使用中文。'
                            });
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
                                claudeMessages.push({
                                    role: 'user',
                                    content: userContent,
                                });
                            }

                            const assistantText = turn.modelAnswers?.[modelId];
                            if (assistantText && assistantText.trim()) {
                                claudeMessages.push({
                                    role: 'assistant',
                                    content: assistantText,
                                });
                            }
                        }

                        if (currentContent.length > 0) {
                            claudeMessages.push({
                                role: 'user',
                                content: currentContent,
                            });
                        }

                        let reasoningSummaryStarted = false;
                        let reasoningSummaryDone = false;

                        for await (const event of streamClaudeResponse(
                            claudeMessages,
                            modelId,
                            modelConfig.effort,
                            systemPrompt
                        )) {
                            if (event.type === 'answer_delta' && event.content) {
                                await writer.write(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: 'chunk',
                                        modelId,
                                        content: event.content
                                    })}\n\n`)
                                );
                                continue;
                            }

                            if (event.type === 'reasoning_summary_delta' && event.content) {
                                if (!reasoningSummaryStarted) {
                                    reasoningSummaryStarted = true;
                                    await writer.write(
                                        encoder.encode(`data: ${JSON.stringify({
                                            type: 'reasoning_summary_start',
                                            modelId
                                        })}\n\n`)
                                    );
                                }

                                await writer.write(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: 'reasoning_summary_chunk',
                                        modelId,
                                        content: event.content
                                    })}\n\n`)
                                );
                                continue;
                            }

                            if (event.type === 'reasoning_summary_done' && reasoningSummaryStarted && !reasoningSummaryDone) {
                                reasoningSummaryDone = true;
                                await writer.write(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: 'reasoning_summary_done',
                                        modelId
                                    })}\n\n`)
                                );
                            }
                        }

                        if (reasoningSummaryStarted && !reasoningSummaryDone) {
                            await writer.write(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: 'reasoning_summary_done',
                                    modelId
                                })}\n\n`)
                            );
                        }
                    }

                    // Send done event
                    await writer.write(
                        encoder.encode(`data: ${JSON.stringify({
                            type: 'done',
                            modelId
                        })}\n\n`)
                    );
                } catch (error) {
                    console.error(`Error with model ${modelId}:`, error);
                    await writer.write(
                        encoder.encode(`data: ${JSON.stringify({
                            type: 'error',
                            modelId,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        })}\n\n`)
                    );
                }
            });

            await Promise.all(modelPromises);
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`));
            await writer.close();
        };

        // Start processing in the background
        processModels();

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
