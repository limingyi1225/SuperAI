import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({
    apiKey: process.env.GOOGLE_AI_API_KEY || '',
});

export interface GeminiContentPart {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

export interface GeminiConversationContent {
    role: 'user' | 'model';
    parts: GeminiContentPart[];
}

export interface GeminiStreamEvent {
    type: 'answer_delta' | 'reasoning_summary_delta' | 'reasoning_summary_done';
    content?: string;
}

type GeminiTool =
    | { googleSearch: Record<string, never> }
    | { codeExecution: Record<string, never> };

interface GeminiResponsePart {
    text?: string;
    thought?: boolean;
    executableCode?: {
        code?: string;
        language?: string;
    };
    codeExecutionResult?: {
        outcome?: string;
        output?: string;
    };
}

interface GeminiResponseChunk {
    text?: string;
    candidates?: Array<{
        content?: {
            parts?: GeminiResponsePart[];
        };
    }>;
}

function getDeltaAndNextText(incoming: string, previous: string): { delta: string; next: string } {
    if (!incoming) return { delta: '', next: previous };
    if (!previous) return { delta: incoming, next: incoming };

    if (incoming.startsWith(previous)) {
        return { delta: incoming.slice(previous.length), next: incoming };
    }

    if (previous.endsWith(incoming) || previous.includes(incoming)) {
        return { delta: '', next: previous };
    }

    return { delta: incoming, next: previous + incoming };
}

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined) return defaultValue;

    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
}

function buildGeminiTools(options?: { forceSearchOnly?: boolean; disableAll?: boolean }): GeminiTool[] {
    if (options?.disableAll || parseBooleanEnv('GEMINI_FORCE_DISABLE_TOOLS', false)) return [];

    const tools: GeminiTool[] = [];
    const searchEnabled = parseBooleanEnv('GEMINI_ENABLE_GOOGLE_SEARCH', true);
    const codeExecutionEnabled = parseBooleanEnv('GEMINI_ENABLE_CODE_EXECUTION', true);

    if (searchEnabled) {
        tools.push({ googleSearch: {} });
    }

    if (!options?.forceSearchOnly && codeExecutionEnabled) {
        tools.push({ codeExecution: {} });
    }

    return tools;
}

function hasCodeExecutionTool(tools: GeminiTool[]): boolean {
    return tools.some(tool => 'codeExecution' in tool);
}

function areToolSetsEquivalent(a: GeminiTool[], b: GeminiTool[]): boolean {
    const signature = (tools: GeminiTool[]) => (
        tools.map(tool => Object.keys(tool).sort().join(',')).sort().join('|')
    );
    return signature(a) === signature(b);
}

function isToolCompatibilityError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    const hasToolHint = /(tool|tools|google_search|googlesearch|code_execution|codeexecution)/.test(message);
    const hasCompatibilityHint = /(unsupported|not supported|invalid|unknown|unrecognized|not available|not allowed)/.test(message);
    return hasToolHint && hasCompatibilityHint;
}

function normalizeToolPartText(part: GeminiResponsePart): string {
    if (typeof part.text === 'string' && part.text) {
        return part.text;
    }

    // Skip code execution content — don't include code and its output in the answer
    return '';
}

function buildAttemptToolSets(): GeminiTool[][] {
    const primaryTools = buildGeminiTools();
    const attemptSets: GeminiTool[][] = [primaryTools];

    if (hasCodeExecutionTool(primaryTools)) {
        const searchOnlyTools = buildGeminiTools({ forceSearchOnly: true });
        if (!areToolSetsEquivalent(primaryTools, searchOnlyTools)) {
            attemptSets.push(searchOnlyTools);
        }
    }

    if (primaryTools.length > 0) {
        const noTools: GeminiTool[] = [];
        if (!attemptSets.some(set => areToolSetsEquivalent(set, noTools))) {
            attemptSets.push(noTools);
        }
    }

    return attemptSets;
}

export async function* streamGeminiResponse(
    contents: GeminiConversationContent[],
    effort: 'low' | 'medium' | 'high' = 'high',
    systemInstruction?: string
): AsyncGenerator<GeminiStreamEvent> {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    let emittedAnySummary = false;
    let previousAnswerText = '';
    let previousThoughtText = '';
    let streamCompleted = false;

    const attemptToolSets = buildAttemptToolSets();

    for (let attemptIndex = 0; attemptIndex < attemptToolSets.length; attemptIndex++) {
        const tools = attemptToolSets[attemptIndex];
        const hasNextAttempt = attemptIndex < attemptToolSets.length - 1;
        let emittedAnyContentThisAttempt = false;

        const generateConfig: {
            model: string;
            contents: GeminiConversationContent[];
            config: {
                systemInstruction?: string;
                thinkingConfig?: {
                    includeThoughts?: boolean;
                    thinkingBudget?: number;
                };
                tools?: GeminiTool[];
            };
        } = {
            model: modelName,
            contents,
            config: {},
        };

        // Add system instruction if provided
        if (systemInstruction) {
            generateConfig.config.systemInstruction = systemInstruction;
        }

        generateConfig.config.thinkingConfig = {
            includeThoughts: true,
        };

        if (tools.length > 0) {
            generateConfig.config.tools = tools;
        }

        // Keep existing budget behavior for thinking-capable models.
        if (modelName.includes('flash-thinking') || modelName.includes('2.5')) {
            generateConfig.config.thinkingConfig.thinkingBudget = effort === 'high' ? 8192 : effort === 'medium' ? 4096 : 1024;
        }

        try {
            const response = await genAI.models.generateContentStream(generateConfig);

            for await (const chunk of response) {
                const typedChunk = chunk as GeminiResponseChunk;
                const streamParts = typedChunk.candidates?.[0]?.content?.parts || [];
                let emittedFromParts = false;

                for (const part of streamParts) {
                    const partText = normalizeToolPartText(part);
                    if (!partText) continue;

                    emittedFromParts = true;
                    emittedAnyContentThisAttempt = true;

                    if (part.thought === true) {
                        const { delta, next } = getDeltaAndNextText(partText, previousThoughtText);
                        previousThoughtText = next;
                        if (delta) {
                            emittedAnySummary = true;
                            yield { type: 'reasoning_summary_delta', content: delta };
                        }
                    } else {
                        const { delta, next } = getDeltaAndNextText(partText, previousAnswerText);
                        previousAnswerText = next;
                        if (delta) {
                            yield { type: 'answer_delta', content: delta };
                        }
                    }
                }

                // Fallback path when SDK does not expose candidate parts in this chunk.
                if (!emittedFromParts && typedChunk.text) {
                    emittedAnyContentThisAttempt = true;
                    const { delta, next } = getDeltaAndNextText(typedChunk.text, previousAnswerText);
                    previousAnswerText = next;
                    if (delta) {
                        yield { type: 'answer_delta', content: delta };
                    }
                }
            }

            streamCompleted = true;
            break;
        } catch (error) {
            const shouldRetryWithoutSomeTools = hasNextAttempt && !emittedAnyContentThisAttempt && isToolCompatibilityError(error);
            if (!shouldRetryWithoutSomeTools) {
                throw error;
            }
        }
    }

    if (!streamCompleted) return;

    if (emittedAnySummary) {
        yield { type: 'reasoning_summary_done' };
    }
}

export default genAI;
