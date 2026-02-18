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

export function useModelSelection(): UseModelSelectionReturn {
  const [selectedModels, setSelectedModels] = useState<string[]>(FALLBACK_MODELS);
  const [activeTier, setActiveTier] = useState<TierId>('fast');
  const [customModels, setCustomModels] = useState<string[]>(FALLBACK_MODELS);
  const [defaultModels, setDefaultModels] = useState<string[]>(FALLBACK_MODELS);

  // Hydrate tier and custom models from localStorage on mount
  useEffect(() => {
    const savedTier = localStorage.getItem('activeTier') as TierId | null;
    const tier = savedTier && ['fast', 'deep', 'custom'].includes(savedTier) ? savedTier : 'fast';

    const savedCustom = localStorage.getItem('customModels');
    const resolvedCustom = resolveInitialModels(savedCustom ?? '');

    setCustomModels(resolvedCustom);
    setDefaultModels(resolvedCustom);
    setActiveTier(tier);

    if (tier === 'custom') {
      setSelectedModels(resolvedCustom);
    } else {
      setSelectedModels(REASONING_TIERS[tier]);
    }
  }, []);

  const handleTierChange = useCallback((tier: TierId) => {
    setActiveTier(tier);
    localStorage.setItem('activeTier', tier);
    if (tier === 'custom') {
      setSelectedModels(customModels);
    } else {
      setSelectedModels(REASONING_TIERS[tier]);
    }
  }, [customModels]);

  const handleCustomModelsChange = useCallback((models: string[]) => {
    setCustomModels(models);
    setSelectedModels(models);
    setDefaultModels(models);
    localStorage.setItem('customModels', JSON.stringify(models));
  }, []);

  const applyNewDefaults = useCallback((newDefaults: string[]) => {
    const sanitized = sanitizeModelIds(newDefaults);
    const resolved = sanitized.length > 0 ? sanitized : FALLBACK_MODELS;
    setDefaultModels(resolved);
    setCustomModels(resolved);
    localStorage.setItem('customModels', JSON.stringify(resolved));
    if (activeTier === 'custom') {
      setSelectedModels(resolved);
    }
  }, [activeTier]);

  return {
    selectedModels,
    activeTier,
    customModels,
    defaultModels,
    handleTierChange,
    handleCustomModelsChange,
    applyNewDefaults,
  };
}
