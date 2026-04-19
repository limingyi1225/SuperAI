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
    'gpt-5.2': 'gpt-5.4',
    'gpt-5.2-low': 'gpt-5.4',
    'gpt-5.2-high': 'gpt-5.4-high',
    'gpt-5.2-pro': 'gpt-5.4-pro',
    'grok-4.20-multi-agent-experimental-beta-0304': 'grok-4.20-multi-agent-beta-latest',
    'grok-4.20-multi-agent-experimental-beta-0304-deep': 'grok-4.20-multi-agent-beta-latest-deep',
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
        id: 'gpt-5.4',
        name: 'GPT 5.4 (Medium)',
        provider: 'openai',
        effort: 'medium',
        description: 'OpenAI GPT 5.4 with medium reasoning effort',
    },
    {
        id: 'gpt-5.4-high',
        name: 'GPT 5.4 (High)',
        provider: 'openai',
        effort: 'high',
        description: 'OpenAI GPT 5.4 with high reasoning effort',
    },
    {
        id: 'gpt-5.4-pro',
        name: 'GPT 5.4 (Pro)',
        provider: 'openai',
        effort: 'medium',
        description: 'OpenAI GPT 5.4 Pro tier (routes to dedicated Pro model)',
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
        id: 'grok-4.20-multi-agent-beta-latest',
        name: 'Grok 4.20 Multi-Agent (Fast)',
        provider: 'xai',
        effort: 'medium',
        description: 'xAI Grok 4.20 multi-agent with medium reasoning effort and web search',
    },
    {
        id: 'grok-4.20-multi-agent-beta-latest-deep',
        name: 'Grok 4.20 Multi-Agent (Deep)',
        provider: 'xai',
        effort: 'high',
        description: 'xAI Grok 4.20 multi-agent with high reasoning effort and web search',
    },
];

export type TierId = 'fast' | 'deep' | 'custom';

export const REASONING_TIERS: Record<Exclude<TierId, 'custom'>, string[]> = {
    fast: ['gemini-3.1-pro', 'gpt-5.4', 'claude-sonnet-4-6'],
    deep: ['gemini-3.1-pro', 'gpt-5.4-high', 'claude-opus-4-7'],
};

export const TIER_LABELS: Record<TierId, string> = {
    fast: 'Fast',
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
