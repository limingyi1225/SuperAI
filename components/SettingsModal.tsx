'use client';

import React, { useState } from 'react';
import { AVAILABLE_MODELS } from '@/lib/models';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialDefaults: string[];
    onSave: (newDefaults: string[]) => void;
    currentTheme: 'light' | 'dark';
    onToggleTheme: () => void;
}

export default function SettingsModal({ isOpen, onClose, initialDefaults, onSave, currentTheme, onToggleTheme }: SettingsModalProps) {
    const [selected, setSelected] = useState<string[]>(initialDefaults);

    const toggleModel = (modelId: string) => {
        if (selected.includes(modelId)) {
            // Prevent deselecting all models
            if (selected.length > 1) {
                setSelected(selected.filter(id => id !== modelId));
            }
        } else {
            setSelected([...selected, modelId]);
        }
    };

    const handleSave = () => {
        onSave(selected);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Settings</h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.scrollContent}>
                    {/* Appearance Section */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Appearance</h3>
                        <div className={styles.themeToggleWrapper}>
                            <button
                                className={`${styles.themeOption} ${currentTheme === 'light' ? styles.active : ''}`}
                                onClick={() => currentTheme === 'dark' && onToggleTheme()}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <circle cx="12" cy="12" r="5" />
                                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                                </svg>
                                Light
                            </button>
                            <button
                                className={`${styles.themeOption} ${currentTheme === 'dark' ? styles.active : ''}`}
                                onClick={() => currentTheme === 'light' && onToggleTheme()}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                                Dark
                            </button>
                        </div>
                    </div>

                    <div className={styles.divider}></div>

                    {/* Default Models Section */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Custom Tier</h3>
                        <p className={styles.modelDesc} style={{ margin: '4px 0 12px 0' }}>
                            Models used when Custom tier is selected.
                        </p>

                        <div className={styles.modelList}>
                            {AVAILABLE_MODELS.map(model => (
                                <label
                                    key={model.id}
                                    className={`${styles.modelItem} ${selected.includes(model.id) ? styles.modelItemSelected : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        className={styles.checkbox}
                                        checked={selected.includes(model.id)}
                                        onChange={() => toggleModel(model.id)}
                                    />
                                    <div className={styles.modelInfo}>
                                        <span className={styles.modelName}>{model.name}</span>
                                        <span className={styles.modelDesc}>{model.description}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.actions}>
                    <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    <button className={styles.saveBtn} onClick={handleSave}>Save Changes</button>
                </div>
            </div>
        </div>
    );
}
