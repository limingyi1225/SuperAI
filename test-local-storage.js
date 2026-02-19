let storage = {
  activeTier: 'fast',
  customModels: '["gpt-5.2", "gpt-5.2-high", "gpt-5.2-pro", "gemini-3.1-pro", "claude-sonnet-4-6"]'
};

const REASONING_TIERS = {
    fast: ['gemini-3.1-pro', 'gpt-5.2', 'claude-sonnet-4-6'],
    deep: ['gemini-3.1-pro', 'gpt-5.2-high', 'claude-opus-4-6'],
};

const FALLBACK_MODELS = REASONING_TIERS.fast;

function sanitizeModelIds(ids) {
  return ids;
}

function resolveInitialModels(rawJson) {
  if (!rawJson) return FALLBACK_MODELS;
  try {
    const parsed = JSON.parse(rawJson);
    const sanitized = sanitizeModelIds(parsed);
    return sanitized.length > 0 ? sanitized : FALLBACK_MODELS;
  } catch {
    return FALLBACK_MODELS;
  }
}

function resolveInitialTier() {
  const saved = storage['activeTier'];
  return saved && ['fast', 'deep', 'custom'].includes(saved) ? saved : 'fast';
}

function resolveInitialCustom() {
  return resolveInitialModels(storage['customModels'] || '');
}

// React useState simulation
const activeTier = resolveInitialTier();
const customModels = resolveInitialCustom();
const defaultModels = resolveInitialCustom();
const selectedModels = activeTier === 'custom' ? resolveInitialCustom() : REASONING_TIERS[activeTier];

console.log('activeTier:', activeTier);
console.log('selectedModels:', selectedModels);

// Now simulate user saving settings while on FAST tier
const applyNewDefaults = (newDefaults) => {
    storage['customModels'] = JSON.stringify(newDefaults);
    // update state references - simulate setting custom models
    // Does it update selectedModels?
    if (activeTier === 'custom') {
      console.log('Would update selectedModels');
    }
};

applyNewDefaults(["mod1", "mod2", "mod3", "mod4", "mod5"]);

console.log('After setting 5 models, selectedModels is still:', selectedModels);
