export type ProviderId = 'openai' | 'gemini' | 'claude';

export interface ProviderSliderOption {
    modelId: string;
    label: string;
}

export interface ProviderSliderConfig {
    provider: ProviderId;
    vendorLabel: string;
    defaultModelId: string;
    steps: ProviderSliderOption[];
}

export const SLIDER_PROVIDER_ORDER: ProviderId[] = ['openai', 'gemini', 'claude'];

export const PROVIDER_MODEL_SLIDERS: Record<ProviderId, ProviderSliderConfig> = {
    openai: {
        provider: 'openai',
        vendorLabel: 'GPT',
        defaultModelId: 'gpt-5.2',
        steps: [
            { modelId: 'gpt-5.2', label: 'Medium' },
            { modelId: 'gpt-5.2-high', label: 'High' },
            { modelId: 'gpt-5.2-pro', label: 'Pro' },
        ],
    },
    gemini: {
        provider: 'gemini',
        vendorLabel: 'Gemini',
        defaultModelId: 'gemini-3-pro',
        steps: [
            { modelId: 'gemini-3-pro', label: 'On' },
        ],
    },
    claude: {
        provider: 'claude',
        vendorLabel: 'Claude',
        defaultModelId: 'claude-sonnet-4-6',
        steps: [
            { modelId: 'claude-sonnet-4-6', label: 'Sonnet' },
            { modelId: 'claude-opus-4-6', label: 'Opus' },
        ],
    },
};

function isProviderModelId(provider: ProviderId, modelId: string): boolean {
    return PROVIDER_MODEL_SLIDERS[provider].steps.some(step => step.modelId === modelId);
}

export function normalizeProviderModelSelection(modelIds: string[]): string[] {
    const picked: Partial<Record<ProviderId, string>> = {};

    for (const modelId of modelIds) {
        for (const provider of SLIDER_PROVIDER_ORDER) {
            if (picked[provider]) continue;
            if (isProviderModelId(provider, modelId)) {
                picked[provider] = modelId;
            }
        }
    }

    return SLIDER_PROVIDER_ORDER
        .map(provider => picked[provider])
        .filter((modelId): modelId is string => Boolean(modelId));
}

export function getProviderModelSelectionMap(modelIds: string[]): Partial<Record<ProviderId, string>> {
    const normalized = normalizeProviderModelSelection(modelIds);
    const map: Partial<Record<ProviderId, string>> = {};

    for (const modelId of normalized) {
        for (const provider of SLIDER_PROVIDER_ORDER) {
            if (map[provider]) continue;
            if (isProviderModelId(provider, modelId)) {
                map[provider] = modelId;
                break;
            }
        }
    }

    return map;
}

export function ensureAtLeastOneProviderModelSelection(modelIds: string[]): string[] {
    const normalized = normalizeProviderModelSelection(modelIds);
    if (normalized.length > 0) return normalized;
    return [PROVIDER_MODEL_SLIDERS.openai.defaultModelId];
}

export function setProviderModelSelection(
    modelIds: string[],
    provider: ProviderId,
    nextModelId: string
): string[] {
    return setProviderModelOrOff(modelIds, provider, nextModelId);
}

export function toggleProviderSelection(modelIds: string[], provider: ProviderId): string[] {
    const normalized = ensureAtLeastOneProviderModelSelection(modelIds);
    const nextMap = getProviderModelSelectionMap(normalized);
    const isActive = Boolean(nextMap[provider]);
    const activeCount = SLIDER_PROVIDER_ORDER.filter(key => Boolean(nextMap[key])).length;

    if (isActive && activeCount <= 1) {
        // Keep at least one selected model overall.
        return normalized;
    }

    if (isActive) {
        delete nextMap[provider];
    } else {
        nextMap[provider] = PROVIDER_MODEL_SLIDERS[provider].defaultModelId;
    }

    return SLIDER_PROVIDER_ORDER
        .map(key => nextMap[key])
        .filter((modelId): modelId is string => Boolean(modelId));
}

export function setProviderModelOrOff(
    modelIds: string[],
    provider: ProviderId,
    nextModelId: string | null
): string[] {
    const normalized = ensureAtLeastOneProviderModelSelection(modelIds);
    const nextMap = getProviderModelSelectionMap(normalized);
    const activeCount = SLIDER_PROVIDER_ORDER.filter(key => Boolean(nextMap[key])).length;

    if (nextModelId === null) {
        if (!nextMap[provider]) return normalized;
        if (activeCount <= 1) return normalized;
        delete nextMap[provider];
    } else {
        if (!isProviderModelId(provider, nextModelId)) {
            return normalized;
        }
        nextMap[provider] = nextModelId;
    }

    return SLIDER_PROVIDER_ORDER
        .map(key => nextMap[key])
        .filter((modelId): modelId is string => Boolean(modelId));
}
