'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import LiquidGlass from '@/components/LiquidGlass/LiquidGlass';
import styles from './SessionSidebar.module.css';

interface SessionSidebarProps {
    onSessionSelect?: () => void;
    onOpenSettings?: () => void;
}

export default function SessionSidebar({ onSessionSelect, onOpenSettings }: SessionSidebarProps) {
    const { sessions, currentSessionId, createSession, selectSession, deleteSession, renameSession } = useSession();
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameText, setRenameText] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);

    const startRename = (e: React.MouseEvent, sessionId: string, currentName: string) => {
        e.stopPropagation();
        setRenamingId(sessionId);
        setRenameText(currentName);
    };

    const commitRename = () => {
        if (renamingId && renameText.trim()) {
            renameSession(renamingId, renameText.trim());
        }
        setRenamingId(null);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') setRenamingId(null);
    };

    const handleDelete = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        deleteSession(sessionId);
    };

    return (
        <LiquidGlass
            className={styles.sidebar}
            radius={0}
            blur={3}
            depth={6}
            chromaticAberration={2}
            strength={80}
            fallbackBlur={16}
        >
            <div className={styles.header}>
                <h2 className={styles.title}>Sessions</h2>
                <LiquidGlass className={styles.newBtnGlass} radius={999} blur={2} depth={4} chromaticAberration={1} strength={60} fallbackBlur={10}>
                    <button className={styles.newBtn} onClick={createSession}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        New
                    </button>
                </LiquidGlass>
            </div>

            <div className={styles.sessionList}>
                {sessions.length === 0 ? (
                    <div className={styles.empty}>
                        <p>No sessions yet</p>
                        <p className={styles.hint}>Click &quot;New&quot; to start</p>
                    </div>
                ) : (
                    [...sessions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(session => (
                        <div
                            key={session.id}
                            className={`${styles.sessionItem} ${session.id === currentSessionId ? styles.active : ''}`}
                            onClick={() => { selectSession(session.id); onSessionSelect?.(); }}
                        >
                            <div className={styles.sessionInfo}>
                                {session.isGeneratingTitle ? (
                                    <div className={styles.loadingSkeleton}>
                                        <div className={styles.skeletonLine}></div>
                                    </div>
                                ) : renamingId === session.id ? (
                                    <input
                                        ref={renameInputRef}
                                        className={styles.renameInput}
                                        value={renameText}
                                        onChange={e => setRenameText(e.target.value)}
                                        onKeyDown={handleRenameKeyDown}
                                        onBlur={commitRename}
                                        onClick={e => e.stopPropagation()}
                                    />
                                ) : (
                                    <span className={styles.sessionName}>{session.name}</span>
                                )}
                            </div>

                            {renamingId !== session.id && !session.isGeneratingTitle && (
                                <div className={styles.sessionActions}>
                                    <button
                                        className={styles.sessionActionBtn}
                                        onClick={e => startRename(e, session.id, session.name)}
                                        title="Rename"
                                    >
                                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" />
                                        </svg>
                                    </button>
                                    <button
                                        className={`${styles.sessionActionBtn} ${styles.deleteBtn}`}
                                        onClick={e => handleDelete(e, session.id)}
                                        title="Delete"
                                    >
                                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 4h10M6 4V3h4v1M5 4l.5 8h5l.5-8" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Footer: Settings */}
            <div className={styles.footer}>
                <button className={styles.settingsBtn} onClick={onOpenSettings} title="Settings">
                    <span className={styles.settingsIconWrap} aria-hidden="true">
                        <svg className={styles.settingsIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 7h9" />
                            <path d="M4 17h15" />
                            <circle cx="16" cy="7" r="3" />
                            <circle cx="10" cy="17" r="3" />
                        </svg>
                    </span>
                    <span className={styles.settingsLabel}>Settings</span>
                </button>
            </div>
        </LiquidGlass>
    );
}

