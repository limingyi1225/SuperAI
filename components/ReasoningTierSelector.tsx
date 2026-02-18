'use client';

import React, { useRef, useEffect, useState } from 'react';
import { TierId, TIER_LABELS, REASONING_TIERS, AVAILABLE_MODELS } from '@/lib/models';
import {
    ProviderId,
    PROVIDER_MODEL_SLIDERS,
    SLIDER_PROVIDER_ORDER,
    ensureAtLeastOneProviderModelSelection,
    getProviderModelSelectionMap,
    setProviderModelOrOff,
} from '@/lib/customModelSliders';
import styles from './ReasoningTierSelector.module.css';

interface ReasoningTierSelectorProps {
    activeTier: TierId;
    onTierChange: (tier: TierId) => void;
    customModels: string[];
    onCustomModelsChange: (models: string[]) => void;
    disabled?: boolean;
}

const TIERS: TierId[] = ['fast', 'deep', 'custom'];

function TierIcon({ tier }: { tier: TierId }) {
    if (tier === 'fast') {
        return (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 1.5L4 9h4l-1 5.5L12 7H8l1-5.5z" />
            </svg>
        );
    }
    if (tier === 'deep') {
        return (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 1.7 1 3.2 2.5 4v1.5h4V10c1.5-.8 2.5-2.3 2.5-4 0-2.5-2-4.5-4.5-4.5z" />
                <path d="M6 13h4M6.5 14.5h3" />
            </svg>
        );
    }
    // custom — sliders icon
    return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 4h3M9 4h5M2 8h7M13 8h1M2 12h1M7 12h7" />
            <circle cx="7" cy="4" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="12" r="1.5" />
        </svg>
    );
}

function isSameSelection(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((modelId, index) => modelId === b[index]);
}

function TierTooltip({ tier }: { tier: TierId }) {
    if (tier === 'custom') return null;

    // Get models for this tier
    const modelIds = REASONING_TIERS[tier as keyof typeof REASONING_TIERS];
    const models = modelIds.map(id => AVAILABLE_MODELS.find(m => m.id === id)).filter(Boolean);

    return (
        <div className={styles.tooltip}>
            <div className={styles.tooltipTitle}>Included Models</div>
            <div className={styles.tooltipList}>
                {models.map(model => (
                    <div key={model?.id} className={styles.tooltipItem}>
                        {model?.name}
                    </div>
                ))}
            </div>
        </div>
    );
}

function ReasoningTierSelector({
    activeTier,
    onTierChange,
    customModels,
    onCustomModelsChange,
    disabled,
}: ReasoningTierSelectorProps) {
    const activeIndex = TIERS.indexOf(activeTier);
    const [panelOpen, setPanelOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const providerSelection = getProviderModelSelectionMap(customModels);

    // Toggle panel when custom is clicked; close when switching away
    const handleTierClick = (tier: TierId) => {
        if (disabled) return;
        onTierChange(tier);
        if (tier === 'custom') {
            // Toggle: if already on custom, flip panel open/closed
            if (activeTier === 'custom') {
                setPanelOpen(prev => !prev);
            } else {
                setPanelOpen(true);
            }
            const normalizedSelection = ensureAtLeastOneProviderModelSelection(customModels);
            if (!isSameSelection(customModels, normalizedSelection)) {
                onCustomModelsChange(normalizedSelection);
            }
        } else {
            setPanelOpen(false);
        }
    };

    // Close panel when clicking outside
    useEffect(() => {
        if (!panelOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setPanelOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [panelOpen]);

    const handleProviderSelectionChange = (provider: ProviderId, modelId: string | null) => {
        const next = setProviderModelOrOff(customModels, provider, modelId);
        onCustomModelsChange(next);
    };

    return (
        <div className={`${styles.container} ${disabled ? styles.disabled : ''}`} ref={panelRef}>
            <div className={styles.track}>
                {/* Sliding indicator */}
                <div
                    className={styles.indicator}
                    style={{
                        transform: `translateX(${activeIndex * 100}%)`,
                        width: `calc((100% - 6px) / ${TIERS.length})`,
                    }}
                />

                {TIERS.map((tier) => (
                    <button
                        key={tier}
                        className={`${styles.option} ${activeTier === tier ? styles.active : ''}`}
                        onClick={() => handleTierClick(tier)}
                        disabled={disabled}
                    >
                        <span className={styles.icon}>
                            <TierIcon tier={tier} />
                        </span>
                        <span className={styles.label}>{TIER_LABELS[tier]}</span>

                        {/* Disable tier tooltips while custom panel is open to avoid hover jank */}
                        {!panelOpen && <TierTooltip tier={tier} />}
                    </button>
                ))}
            </div>

            {/* Inline custom model picker */}
            {panelOpen && activeTier === 'custom' && (
                <div className={styles.customPanel}>
                    <div className={styles.customPanelHeader}>
                        <span className={styles.customPanelTitle}>Custom Models</span>
                        <span className={styles.customPanelHint}>Choose 1-3 models</span>
                    </div>

                    <div className={styles.providerList}>
                        {SLIDER_PROVIDER_ORDER.map((provider) => {
                            const slider = PROVIDER_MODEL_SLIDERS[provider];
                            const selectedModelId = providerSelection[provider] || null;
                            const selectedStep = selectedModelId
                                ? slider.steps.find(step => step.modelId === selectedModelId)
                                : null;
                            const options = [
                                { modelId: null, label: 'Off' },
                                ...slider.steps.map(step => ({
                                    modelId: step.modelId,
                                    label: step.label === 'Medium' ? 'Med' : step.label,
                                })),
                            ];
                            const activeOptionIndex = options.findIndex(o => o.modelId === selectedModelId);

                            return (
                                <div
                                    key={provider}
                                    className={`${styles.providerCard} ${!selectedStep ? styles.providerCardInactive : ''}`}
                                >
                                    <div className={styles.providerHeader}>
                                        <span className={styles.providerName}>{slider.vendorLabel}</span>
                                        <span className={styles.providerValue}>{selectedStep?.label || 'Off'}</span>
                                    </div>

                                    <div
                                        className={styles.segmentedControl}
                                        role="radiogroup"
                                        aria-label={`${slider.vendorLabel} level`}
                                    >
                                        {/* Sliding pill indicator */}
                                        <div
                                            className={styles.segmentIndicator}
                                            style={{
                                                width: `calc(100% / ${options.length})`,
                                                transform: `translateX(${activeOptionIndex * 100}%)`,
                                            }}
                                        />
                                        {options.map((option) => {
                                            const isSelected = option.modelId === selectedModelId;
                                            return (
                                                <button
                                                    key={option.modelId ?? `${provider}-off`}
                                                    type="button"
                                                    className={`${styles.segmentButton} ${isSelected ? styles.segmentButtonActive : ''}`}
                                                    onClick={() => handleProviderSelectionChange(provider, option.modelId)}
                                                    role="radio"
                                                    aria-checked={isSelected}
                                                    aria-label={`${slider.vendorLabel} ${option.label}`}
                                                >
                                                    <span className={styles.segmentLabel}>{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default React.memo(ReasoningTierSelector);
