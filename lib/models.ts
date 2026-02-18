export interface ModelConfig {
    id: string;
    name: string;
    provider: 'openai' | 'gemini' | 'claude';
    effort: 'low' | 'medium' | 'high' | 'max';
    description: string;
}

export const AVAILABLE_MODELS: ModelConfig[] = [
    {
        id: 'gemini-3-pro',
        name: 'Gemini 3 Pro',
        provider: 'gemini',
        effort: 'high',
        description: 'Google Gemini 3 Pro',
    },
    {
        id: 'gpt-5.2',
        name: 'GPT 5.2 (Medium)',
        provider: 'openai',
        effort: 'medium',
        description: 'OpenAI GPT 5.2 with medium reasoning effort',
    },
    {
        id: 'gpt-5.2-high',
        name: 'GPT 5.2 (High)',
        provider: 'openai',
        effort: 'high',
        description: 'OpenAI GPT 5.2 with high reasoning effort',
    },
    {
        id: 'gpt-5.2-pro',
        name: 'GPT 5.2 (Pro)',
        provider: 'openai',
        effort: 'medium',
        description: 'OpenAI GPT 5.2 Pro tier (routes to dedicated Pro model)',
    },
    {
        id: 'claude-opus-4-6-low',
        name: 'Claude Opus 4.6 (Low)',
        provider: 'claude',
        effort: 'low',
        description: 'Anthropic Claude Opus 4.6 with low thinking',
    },
    {
        id: 'claude-opus-4-6-high',
        name: 'Claude Opus 4.6 (Medium)',
        provider: 'claude',
        effort: 'medium',
        description: 'Anthropic Claude Opus 4.6 with medium thinking',
    },
    {
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6 (Max)',
        provider: 'claude',
        effort: 'max',
        description: 'Anthropic Claude Opus 4.6 with max thinking',
    },
    {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6 (Max)',
        provider: 'claude',
        effort: 'max',
        description: 'Anthropic Claude Sonnet 4.6 with max thinking',
    },
];

export type TierId = 'fast' | 'deep' | 'custom';

export const REASONING_TIERS: Record<Exclude<TierId, 'custom'>, string[]> = {
    fast: ['gemini-3-pro', 'gpt-5.2', 'claude-sonnet-4-6'],
    deep: ['gemini-3-pro', 'gpt-5.2-high', 'claude-opus-4-6'],
};

export const TIER_LABELS: Record<TierId, string> = {
    fast: 'Fast',
    deep: 'Deep',
    custom: 'Custom',
};

export function getModelById(id: string): ModelConfig | undefined {
    return AVAILABLE_MODELS.find(m => m.id === id);
}
