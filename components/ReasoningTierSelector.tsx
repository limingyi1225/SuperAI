'use client';

import React, { useRef, useEffect, useState } from 'react';
import { TierId, TIER_LABELS, AVAILABLE_MODELS, REASONING_TIERS } from '@/lib/models';
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

function CheckIcon() {
    return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.checkIcon}>
            <path d="M3.5 8.5l3 3 6-6.5" />
        </svg>
    );
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

export default function ReasoningTierSelector({
    activeTier,
    onTierChange,
    customModels,
    onCustomModelsChange,
    disabled,
}: ReasoningTierSelectorProps) {
    const activeIndex = TIERS.indexOf(activeTier);
    const [panelOpen, setPanelOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Open panel when custom is selected, close when switching away
    const handleTierClick = (tier: TierId) => {
        if (disabled) return;
        onTierChange(tier);
        if (tier === 'custom') {
            setPanelOpen(true);
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

    const toggleModel = (modelId: string) => {
        const next = customModels.includes(modelId)
            ? customModels.filter(id => id !== modelId)
            : [...customModels, modelId];
        // Don't allow deselecting everything
        if (next.length === 0) return;
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
                    {AVAILABLE_MODELS.map((model) => {
                        const selected = customModels.includes(model.id);
                        return (
                            <button
                                key={model.id}
                                className={`${styles.modelItem} ${selected ? styles.modelSelected : ''}`}
                                onClick={() => toggleModel(model.id)}
                            >
                                <div className={`${styles.modelCheck} ${selected ? styles.checked : ''}`}>
                                    {selected && <CheckIcon />}
                                </div>
                                <div className={styles.modelInfo}>
                                    <span className={styles.modelName}>{model.name}</span>
                                    <span className={styles.modelDesc}>{model.description}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
