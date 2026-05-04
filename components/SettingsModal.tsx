'use client';

import React from 'react';
import styles from './SettingsModal.module.css';
import type { AssistantMode } from '@/lib/assistantMode';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentThemeMode: 'light' | 'dark' | 'auto';
    onThemeChange: (themeMode: 'light' | 'dark' | 'auto') => void;
    currentAssistantMode: AssistantMode;
    onAssistantModeChange: (mode: AssistantMode) => void;
}

export default function SettingsModal({
    isOpen,
    onClose,
    currentThemeMode,
    onThemeChange,
    currentAssistantMode,
    onAssistantModeChange,
}: SettingsModalProps) {
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
                    {/* Appearance */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Appearance</h3>
                        <div className={styles.themeToggleWrapper}>
                            <button
                                className={`${styles.themeOption} ${currentThemeMode === 'light' ? styles.active : ''}`}
                                onClick={() => onThemeChange('light')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <circle cx="12" cy="12" r="5" />
                                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                                </svg>
                                Light
                            </button>
                            <button
                                className={`${styles.themeOption} ${currentThemeMode === 'dark' ? styles.active : ''}`}
                                onClick={() => onThemeChange('dark')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                                Dark
                            </button>
                            <button
                                className={`${styles.themeOption} ${currentThemeMode === 'auto' ? styles.active : ''}`}
                                onClick={() => onThemeChange('auto')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M12 7v6l4 2" />
                                </svg>
                                Auto
                            </button>
                        </div>
                    </div>

                    {/* Assistant Mode */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Assistant Mode</h3>
                        <div className={styles.themeToggleWrapper}>
                            <button
                                className={`${styles.themeOption} ${currentAssistantMode === 'solver' ? styles.active : ''}`}
                                onClick={() => onAssistantModeChange('solver')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M9 11l3 3L22 4" />
                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                </svg>
                                Solver
                            </button>
                            <button
                                className={`${styles.themeOption} ${currentAssistantMode === 'general' ? styles.active : ''}`}
                                onClick={() => onAssistantModeChange('general')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                General
                            </button>
                        </div>
                        <p className={styles.modeHint}>
                            {currentAssistantMode === 'solver'
                                ? 'Tutor persona — final answer first, then step-by-step reasoning.'
                                : 'Each model uses its own native persona.'}
                        </p>
                    </div>
                </div>

                <div className={styles.actions}>
                    <button className={styles.closeActionBtn} onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}
