const assert = require('assert');

// Simulate React useState local behavior for hydration
let isClient = false;

let storage = {
  activeTier: 'fast',
  customModels: '["a", "b", "c", "d", "e"]'
};

function readStorage(k) {
  if (!isClient) return null;
  return storage[k] || null;
}

const REASONING_TIERS = {
  fast: ['gemini-3.1-pro', 'gpt-5.2', 'claude-sonnet-4-6'],
  deep: ['deep1', 'deep2', 'deep3']
};

function resolveInitialTier() {
  const saved = readStorage('activeTier');
  return saved && ['fast', 'deep', 'custom'].includes(saved) ? saved : 'fast';
}

function resolveInitialCustom() {
  const raw = readStorage('customModels') || '';
  if (!raw) return REASONING_TIERS.fast;
  try {
    return JSON.parse(raw);
  } catch(e) { return REASONING_TIERS.fast; }
}

// Emulate Server Render
let serverState = {};
serverState.activeTier = resolveInitialTier();
serverState.customModels = resolveInitialCustom();
serverState.selectedModels = serverState.activeTier === 'custom' ? serverState.customModels : REASONING_TIERS[serverState.activeTier];

console.log("Server state:", serverState);

// Emulate Client Hydration
isClient = true;
let clientState = {};
clientState.activeTier = resolveInitialTier();
clientState.customModels = resolveInitialCustom();
clientState.selectedModels = clientState.activeTier === 'custom' ? clientState.customModels : REASONING_TIERS[clientState.activeTier];

console.log("Client initial evaluation:", clientState);

