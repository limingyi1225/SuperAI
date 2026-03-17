'use client';

import { useState, useCallback, useEffect } from 'react';
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

export function useModelSelection(): UseModelSelectionReturn {
  const [activeTier, setActiveTier] = useState<TierId>('deep');
  const [customModels, setCustomModels] = useState<string[]>(FALLBACK_MODELS);

  // Derive selected models dynamically to guarantee they never desync from activeTier
  const selectedModels = activeTier === 'custom' ? customModels : REASONING_TIERS[activeTier];

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const savedTier = readStorage('activeTier');
    if (savedTier && ['deep', 'custom'].includes(savedTier)) {
      setActiveTier(savedTier as TierId);
    }

    const raw = readStorage('customModels');
    if (raw) {
      const resolved = resolveInitialModels(raw);
      setCustomModels(resolved);
      const normalizedJson = JSON.stringify(resolved);
      if (normalizedJson !== raw) {
        localStorage.setItem('customModels', normalizedJson);
      }
    }
  }, []);

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
