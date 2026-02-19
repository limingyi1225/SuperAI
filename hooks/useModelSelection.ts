'use client';

import { useState, useCallback } from 'react';
import { REASONING_TIERS, TierId } from '@/lib/models';
import { FALLBACK_MODELS, sanitizeModelIds, resolveInitialModels } from '@/lib/hookUtils';

export interface UseModelSelectionReturn {
  selectedModels: string[];
  activeTier: TierId;
  customModels: string[];
  defaultModels: string[];
  handleTierChange: (tier: TierId) => void;
  handleCustomModelsChange: (models: string[]) => void;
  applyNewDefaults: (newDefaults: string[]) => void;
}

/** Read localStorage safely (returns null during SSR) */
function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

function resolveInitialTier(): TierId {
  const saved = readStorage('activeTier');
  return saved && ['fast', 'deep', 'custom'].includes(saved) ? saved as TierId : 'fast';
}

function resolveInitialCustom(): string[] {
  return resolveInitialModels(readStorage('customModels') ?? '');
}

export function useModelSelection(): UseModelSelectionReturn {
  const [activeTier, setActiveTier] = useState<TierId>(resolveInitialTier);
  const [customModels, setCustomModels] = useState<string[]>(resolveInitialCustom);

  // Derive selected models dynamically to guarantee they never desync from activeTier
  const selectedModels = activeTier === 'custom' ? customModels : REASONING_TIERS[activeTier];

  const handleTierChange = useCallback((tier: TierId) => {
    setActiveTier(tier);
    localStorage.setItem('activeTier', tier);
  }, []);

  const handleCustomModelsChange = useCallback((models: string[]) => {
    setCustomModels(models);
    localStorage.setItem('customModels', JSON.stringify(models));
  }, []);

  const applyNewDefaults = useCallback((newDefaults: string[]) => {
    const sanitized = sanitizeModelIds(newDefaults);
    const resolved = sanitized.length > 0 ? sanitized : FALLBACK_MODELS;
    setCustomModels(resolved);
    localStorage.setItem('customModels', JSON.stringify(resolved));
  }, []);

  return {
    selectedModels,
    activeTier,
    customModels,
    defaultModels: customModels, // Settings modal consumes this and customModels equivalently
    handleTierChange,
    handleCustomModelsChange,
    applyNewDefaults,
  };
}
