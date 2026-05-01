export interface ModelConfig {
    id: string;
    name: string;
    provider: 'openai' | 'gemini' | 'claude' | 'xai';
    effort: 'low' | 'medium' | 'high' | 'max';
    description: string;
}

export interface ResolvedRequestedModel {
    requestedId: string;
    canonicalId: string;
    config?: ModelConfig;
}

const MODEL_ID_ALIASES: Record<string, string> = {
    'claude-opus-4-6': 'claude-opus-4-7',
    'claude-opus-4-6-high': 'claude-opus-4-7-high',
    'claude-opus-4-6-low': 'claude-opus-4-7-low',
};

export const AVAILABLE_MODELS: ModelConfig[] = [
    {
        id: 'gemini-3.1-pro',
        name: 'Gemini 3.1 Pro (High)',
        provider: 'gemini',
        effort: 'high',
        description: 'Google Gemini 3.1 Pro with high reasoning effort',
    },
    {
        id: 'gemini-3.1-pro-medium',
        name: 'Gemini 3.1 Pro (Medium)',
        provider: 'gemini',
        effort: 'medium',
        description: 'Google Gemini 3.1 Pro with medium reasoning effort',
    },
    {
        id: 'gpt-5.5',
        name: 'GPT 5.5',
        provider: 'openai',
        effort: 'high',
        description: 'OpenAI GPT 5.5 with high reasoning effort',
    },
    {
        id: 'gpt-5.5-pro',
        name: 'GPT 5.5 (Pro)',
        provider: 'openai',
        effort: 'medium',
        description: 'OpenAI GPT 5.5 Pro tier',
    },
    {
        id: 'claude-opus-4-7-low',
        name: 'Claude Opus 4.7 (Low)',
        provider: 'claude',
        effort: 'low',
        description: 'Anthropic Claude Opus 4.7 with low thinking',
    },
    {
        id: 'claude-opus-4-7-high',
        name: 'Claude Opus 4.7 (Medium)',
        provider: 'claude',
        effort: 'medium',
        description: 'Anthropic Claude Opus 4.7 with medium thinking',
    },
    {
        id: 'claude-opus-4-7',
        name: 'Claude Opus 4.7 (High)',
        provider: 'claude',
        effort: 'high',
        description: 'Anthropic Claude Opus 4.7 with high thinking',
    },
    {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6 (High)',
        provider: 'claude',
        effort: 'high',
        description: 'Anthropic Claude Sonnet 4.6 with high thinking',
    },
    {
        id: 'grok-4.3-latest',
        name: 'Grok 4.3',
        provider: 'xai',
        effort: 'high',
        description: 'xAI Grok 4.3 with automatic reasoning and web search',
    },
];

export type TierId = 'deep' | 'custom';

export const REASONING_TIERS: { deep: string[] } = {
    deep: ['gemini-3.1-pro', 'gpt-5.5', 'claude-opus-4-7', 'grok-4.3-latest'],
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
