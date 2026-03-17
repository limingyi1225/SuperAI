export interface ModelConfig {
    id: string;
    name: string;
    provider: 'openai' | 'gemini' | 'claude' | 'grok';
    effort: 'low' | 'medium' | 'high' | 'max';
    description: string;
}

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
        name: 'Claude Opus 4.6 (High)',
        provider: 'claude',
        effort: 'high',
        description: 'Anthropic Claude Opus 4.6 with high thinking',
    },
    {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6 (High)',
        provider: 'claude',
        effort: 'high',
        description: 'Anthropic Claude Sonnet 4.6 with high thinking',
    },
    {
        id: 'grok-4.20-4',
        name: 'Grok 4.20 (4 Agents)',
        provider: 'grok',
        effort: 'low',
        description: 'xAI Grok 4.20 with 4 reasoning agents',
    },
    {
        id: 'grok-4.20-16',
        name: 'Grok 4.20 (16 Agents)',
        provider: 'grok',
        effort: 'high',
        description: 'xAI Grok 4.20 with 16 reasoning agents',
    },
];

export type TierId = 'fast' | 'deep' | 'custom';

export const REASONING_TIERS: Record<Exclude<TierId, 'custom'>, string[]> = {
    fast: ['gemini-3.1-pro', 'gpt-5.4', 'claude-sonnet-4-6'],
    deep: ['gemini-3.1-pro', 'gpt-5.4-high', 'claude-opus-4-6'],
};

export const TIER_LABELS: Record<TierId, string> = {
    fast: 'Fast',
    deep: 'Deep',
    custom: 'Custom',
};

export function getModelById(id: string): ModelConfig | undefined {
    return AVAILABLE_MODELS.find(m => m.id === id);
}
