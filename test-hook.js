const { createElement, useState, useCallback, useEffect } = require('react');
const { renderToString } = require('react-dom/server');

// simulate exact environment
const REASONING_TIERS = {
    fast: ['gemini-3.1-pro', 'gpt-5.2', 'claude-sonnet-4-6'],
    deep: ['deep1']
};

let fallback = REASONING_TIERS.fast;

function resolveInitialTier(storage) {
  const saved = storage['activeTier'];
  return saved && ['fast', 'deep', 'custom'].includes(saved) ? saved : 'fast';
}

function resolveInitialCustom(storage) {
  const raw = storage['customModels'] || '';
  if (!raw) return fallback;
  return JSON.parse(raw);
}

function useModelSelectionMock(storage) {
  const [activeTier, setActiveTier] = useState(() => resolveInitialTier(storage));
  const [customModels, setCustomModels] = useState(() => resolveInitialCustom(storage));
  const [selectedModels, setSelectedModels] = useState(() => {
    const tier = resolveInitialTier(storage);
    return tier === 'custom' ? resolveInitialCustom(storage) : REASONING_TIERS[tier];
  });

  return { activeTier, selectedModels };
}

function TestComp({ storage }) {
  const { activeTier, selectedModels } = useModelSelectionMock(storage);
  return createElement('div', null, `Tier: ${activeTier} Models: ${selectedModels.length}`);
}

const htmlServer = renderToString(createElement(TestComp, { storage: {} })); 

const htmlClient = renderToString(createElement(TestComp, { storage: { activeTier: 'fast', customModels: '["a", "b", "c", "d", "e"]' } }));

console.log("Server HTML:", htmlServer);
console.log("Client HTML:", htmlClient);
