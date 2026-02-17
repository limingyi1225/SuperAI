'use client';

import React from 'react';
import styles from './ModelSelector.module.css';

import { AVAILABLE_MODELS } from '@/lib/models';

interface ModelSelectorProps {
    selectedModels: string[];
    onSelectionChange: (models: string[]) => void;
    disabled?: boolean;
}

export default function ModelSelector({ selectedModels, onSelectionChange, disabled }: ModelSelectorProps) {
    const toggleModel = (modelId: string) => {
        if (disabled) return;

        if (selectedModels.includes(modelId)) {
            onSelectionChange(selectedModels.filter(id => id !== modelId));
        } else {
            onSelectionChange([...selectedModels, modelId]);
        }
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Select Models</h3>
            <div className={styles.models}>
                {AVAILABLE_MODELS.map(model => (
                    <label
                        key={model.id}
                        className={`${styles.modelCard} ${selectedModels.includes(model.id) ? styles.selected : ''} ${disabled ? styles.disabled : ''}`}
                    >
                        <input
                            type="checkbox"
                            checked={selectedModels.includes(model.id)}
                            onChange={() => toggleModel(model.id)}
                            className={styles.checkbox}
                            disabled={disabled}
                        />
                        <div className={styles.modelInfo}>
                            <span className={styles.modelName}>{model.name}</span>
                            <span className={styles.modelDesc}>{model.description}</span>
                        </div>
                        <div className={styles.checkmark}>
                            {selectedModels.includes(model.id) && (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <path d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}
