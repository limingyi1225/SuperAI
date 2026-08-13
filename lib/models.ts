export interface ModelConfig {
    id: string;
    name: string;
    provider: 'openai' | 'gemini' | 'claude' | 'xai';
    effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
    description: string;
}

export interface ResolvedRequestedModel {
    requestedId: string;
    canonicalId: string;
    config?: ModelConfig;
}

// Model IDs that shipped in earlier versions, kept so sessions persisted in
// localStorage still match their own history (answers are stored keyed by the
// model ID that produced them — see getAssistantTextForModel in api/ask/route.ts).
// Only IDs that were actually live in a released build belong here.
const MODEL_ID_ALIASES: Record<string, string> = {
    // OpenAI: retired Pro/Max selections migrate to GPT 5.6 Sol Pro mode.
    'gpt-5.5': 'gpt-5.6-sol',
    'gpt-5.5-pro': 'gpt-5.6-sol-pro',
    'gpt-5.6-sol-max': 'gpt-5.6-sol-pro',
    // Gemini
    'gemini-3.5-flash': 'gemini-3.6-flash',
    // Claude: the Sonnet/Opus 4.x ladder became Opus 5 / Fable 5.
    'claude-sonnet-4-6': 'claude-opus-5',
    'claude-opus-4-7': 'claude-opus-5',
    'claude-opus-4-7-high': 'claude-opus-5',
    'claude-opus-4-7-low': 'claude-opus-5',
    'claude-opus-4-6': 'claude-opus-5',
    'claude-opus-4-6-high': 'claude-opus-5',
    'claude-opus-4-6-low': 'claude-opus-5',
    // xAI: the 4.3/4.5 selections migrate to Grok 4.6.
    'grok-4.3-latest': 'grok-4.6',
    'grok-4.5': 'grok-4.6',
};

export const AVAILABLE_MODELS: ModelConfig[] = [
    {
        id: 'gemini-3.6-flash',
        name: 'Gemini 3.6 Flash (High)',
        provider: 'gemini',
        effort: 'high',
        description: 'Google Gemini 3.6 Flash with high thinking level',
    },
    {
        id: 'gpt-5.6-sol',
        name: 'GPT 5.6 Sol (Extra High)',
        provider: 'openai',
        effort: 'xhigh',
        description: 'OpenAI GPT 5.6 Sol with extra high reasoning effort',
    },
    {
        id: 'gpt-5.6-sol-pro',
        name: 'GPT 5.6 Sol (Pro)',
        provider: 'openai',
        effort: 'xhigh',
        description: 'OpenAI GPT 5.6 Sol in Pro mode with extra high reasoning effort',
    },
    {
        id: 'claude-opus-5',
        name: 'Claude Opus 5 (Extra High)',
        provider: 'claude',
        effort: 'xhigh',
        description: 'Anthropic Claude Opus 5 with extra high effort',
    },
    {
        id: 'claude-fable-5',
        name: 'Claude Fable 5 (Extra High)',
        provider: 'claude',
        effort: 'xhigh',
        description: 'Anthropic Claude Fable 5 with extra high effort',
    },
    {
        id: 'grok-4.6',
        name: 'Grok 4.6 (High)',
        provider: 'xai',
        effort: 'high',
        description: 'xAI Grok 4.6 with high reasoning effort and web search',
    },
];

export type TierId = 'deep' | 'custom';

export const REASONING_TIERS: { deep: string[] } = {
    deep: ['gemini-3.6-flash', 'gpt-5.6-sol', 'claude-opus-5', 'grok-4.6'],
};

export const TIER_LABELS: Record<TierId, string> = {
    deep: 'Deep',
    custom: 'Custom',
};

export function getModelById(id: string): ModelConfig | undefined {
    return AVAILABLE_MODELS.find(m => m.id === id);
}

export function normalizeModelId(id: string): string {
    const trimmed = id.trim();
    return MODEL_ID_ALIASES[trimmed] || trimmed;
}

export function resolveRequestedModels(ids: string[]): ResolvedRequestedModel[] {
    const seenCanonicalIds = new Set<string>();
    const resolved: ResolvedRequestedModel[] = [];

    for (const requestedId of ids) {
        const canonicalId = normalizeModelId(requestedId);
        if (seenCanonicalIds.has(canonicalId)) continue;
        seenCanonicalIds.add(canonicalId);

        resolved.push({
            requestedId,
            canonicalId,
            config: getModelById(canonicalId),
        });
    }

    return resolved;
}
