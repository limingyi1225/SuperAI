'use client';

import React, { createContext, useContext, useState, useMemo, ReactNode, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AssistantMode, isAssistantMode } from '@/lib/assistantMode';

export interface UploadedFile {
    id: string;
    type: 'image' | 'pdf' | 'text';
    content: string;
    name: string;
    preview?: string;
}

export interface ModelAnswer {
    modelId: string;
    modelName: string;
    content: string;
    reasoningSummary?: string;
    status: 'pending' | 'streaming' | 'done' | 'error';
    error?: string;
}

export interface Question {
    id: string;
    text: string;
    files: UploadedFile[];
    answers: ModelAnswer[];
    timestamp: Date;
}

export interface Session {
    id: string;
    name: string;
    questions: Question[];
    createdAt: Date;
    isGeneratingTitle?: boolean;
    mode?: AssistantMode;
}

/**
 * Actions are stable across renders (closed over refs). Components that only
 * need actions will not re-render when sessions data changes.
 */
interface SessionActions {
    createSession: () => string;
    selectSession: (id: string) => void;
    deleteSession: (id: string) => void;
    addQuestion: (question: Omit<Question, 'id' | 'timestamp'>, sessionId?: string) => string;
    updateAnswer: (questionId: string, modelId: string, update: Partial<ModelAnswer>, sessionId?: string) => void;
    renameSession: (sessionId: string, newName: string) => void;
    setSessionGeneratingTitle: (sessionId: string, isGenerating: boolean) => void;
    setSessionMode: (sessionId: string, mode: AssistantMode) => void;
}

interface SessionData {
    sessions: Session[];
    currentSessionId: string | null;
    currentSession: Session | null;
}

type SessionContextType = SessionData & SessionActions;

const SessionDataContext = createContext<SessionData | null>(null);
const SessionActionsContext = createContext<SessionActions | null>(null);

const SESSIONS_KEY = 'isbaby_sessions';
const CURRENT_SESSION_KEY = 'isbaby_currentSessionId';
const DEFAULT_MODE_KEY = 'isbaby_defaultMode';

function readDefaultMode(): AssistantMode {
    if (typeof window === 'undefined') return 'solver';
    const raw = localStorage.getItem(DEFAULT_MODE_KEY);
    return isAssistantMode(raw) ? raw : 'solver';
}

export function readDefaultAssistantMode(): AssistantMode {
    return readDefaultMode();
}

export function writeDefaultAssistantMode(mode: AssistantMode): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DEFAULT_MODE_KEY, mode);
}

function dateReviver(_key: string, value: unknown): unknown {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return new Date(value);
    }
    return value;
}

function normalizeSessions(sessions: Session[]): Session[] {
    return sessions.map(s => ({
        ...s,
        isGeneratingTitle: false,
        // Pre-mode sessions get the legacy default ('solver') so behavior is unchanged.
        mode: isAssistantMode(s.mode) ? s.mode : 'solver',
        questions: s.questions.map(q => ({
            ...q,
            answers: q.answers.map(a => ({
                ...a,
                status: (a.status === 'streaming' || a.status === 'pending') ? 'done' : a.status,
            })),
        })),
    }));
}

function loadFromStorage(): { sessions: Session[]; currentSessionId: string | null } {
    try {
        const raw = localStorage.getItem(SESSIONS_KEY);
        const currentId = localStorage.getItem(CURRENT_SESSION_KEY);
        if (!raw) return { sessions: [], currentSessionId: null };
        const parsed = JSON.parse(raw, dateReviver) as Session[];
        const sessions = normalizeSessions(parsed);
        return { sessions, currentSessionId: currentId };
    } catch {
        return { sessions: [], currentSessionId: null };
    }
}

export function SessionProvider({ children }: { children: ReactNode }) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [storageHydrated, setStorageHydrated] = useState(false);
    const persistTimerRef = useRef<number | null>(null);

    // Refs mirror state so action callbacks can be stable.
    const sessionsRef = useRef(sessions);
    const currentSessionIdRef = useRef(currentSessionId);
    useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
    useEffect(() => { currentSessionIdRef.current = currentSessionId; }, [currentSessionId]);

    useEffect(() => {
        const { sessions: saved, currentSessionId: savedId } = loadFromStorage();
        const hydrateTimer = window.setTimeout(() => {
            setSessions(saved);
            setCurrentSessionId(savedId);
            setStorageHydrated(true);
        }, 0);
        return () => {
            window.clearTimeout(hydrateTimer);
        };
    }, []);

    // Persist sessions to localStorage on change (skip initial hydration write).
    useEffect(() => {
        if (!storageHydrated) return;
        if (persistTimerRef.current !== null) {
            window.clearTimeout(persistTimerRef.current);
        }
        // Strip large binary content (base64 images/PDFs) before persisting to avoid
        // blowing the 5-10 MB localStorage budget. Only metadata is kept so history
        // can show what files were attached without storing the raw data.
        const toSave = sessions.map(s => ({
            ...s,
            isGeneratingTitle: false,
            questions: s.questions.map(q => ({
                ...q,
                files: q.files.map(f =>
                    f.type === 'image' || f.type === 'pdf'
                        ? { id: f.id, type: f.type, name: f.name, content: '', preview: undefined }
                        : f
                ),
            })),
        }));
        persistTimerRef.current = window.setTimeout(() => {
            try {
                localStorage.setItem(SESSIONS_KEY, JSON.stringify(toSave));
            } catch {
                // localStorage full or unavailable — silently ignore.
            }
        }, 800);
        return () => {
            if (persistTimerRef.current !== null) {
                window.clearTimeout(persistTimerRef.current);
                persistTimerRef.current = null;
            }
        };
    }, [sessions, storageHydrated]);

    useEffect(() => {
        if (!storageHydrated) return;
        if (currentSessionId) {
            localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId);
        } else {
            localStorage.removeItem(CURRENT_SESSION_KEY);
        }
    }, [currentSessionId, storageHydrated]);

    const currentSession = useMemo(
        () => sessions.find(s => s.id === currentSessionId) || null,
        [sessions, currentSessionId]
    );

    // Stable actions — computed once, never change. Close over refs for reads.
    const actions = useMemo<SessionActions>(() => ({
        createSession: () => {
            const newSession: Session = {
                id: uuidv4(),
                name: `Session ${sessionsRef.current.length + 1}`,
                questions: [],
                createdAt: new Date(),
                mode: readDefaultMode(),
            };
            setSessions(prev => [...prev, newSession]);
            setCurrentSessionId(newSession.id);
            return newSession.id;
        },
        selectSession: (id: string) => setCurrentSessionId(id),
        deleteSession: (sessionId: string) => {
            setSessions(prev => {
                const remaining = prev.filter(s => s.id !== sessionId);
                setCurrentSessionId(cur => {
                    if (cur !== sessionId) return cur;
                    return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
                });
                return remaining;
            });
        },
        addQuestion: (question, targetSessionId) => {
            const questionId = uuidv4();
            const newQuestion: Question = {
                ...question,
                id: questionId,
                timestamp: new Date(),
            };
            const sessionToUpdate = targetSessionId || currentSessionIdRef.current;
            setSessions(prev => prev.map(session =>
                session.id === sessionToUpdate
                    ? { ...session, questions: [...session.questions, newQuestion] }
                    : session
            ));
            return questionId;
        },
        updateAnswer: (questionId, modelId, update, sessionId) => {
            const sessionToUpdate = sessionId || currentSessionIdRef.current;
            setSessions(prev => prev.map(session => {
                if (session.id !== sessionToUpdate) return session;
                return {
                    ...session,
                    questions: session.questions.map(q => {
                        if (q.id !== questionId) return q;
                        return {
                            ...q,
                            answers: q.answers.map(a =>
                                a.modelId === modelId ? { ...a, ...update } : a
                            ),
                        };
                    }),
                };
            }));
        },
        renameSession: (sessionId, newName) => {
            setSessions(prev => prev.map(session =>
                session.id === sessionId ? { ...session, name: newName } : session
            ));
        },
        setSessionGeneratingTitle: (sessionId, isGenerating) => {
            setSessions(prev => prev.map(session =>
                session.id === sessionId ? { ...session, isGeneratingTitle: isGenerating } : session
            ));
        },
        setSessionMode: (sessionId, mode) => {
            setSessions(prev => prev.map(session =>
                session.id === sessionId ? { ...session, mode } : session
            ));
        },
    }), []);

    const data = useMemo<SessionData>(
        () => ({ sessions, currentSessionId, currentSession }),
        [sessions, currentSessionId, currentSession]
    );

    return (
        <SessionActionsContext.Provider value={actions}>
            <SessionDataContext.Provider value={data}>
                {children}
            </SessionDataContext.Provider>
        </SessionActionsContext.Provider>
    );
}

export function useSessionActions(): SessionActions {
    const ctx = useContext(SessionActionsContext);
    if (!ctx) throw new Error('useSessionActions must be used within a SessionProvider');
    return ctx;
}

export function useSessionData(): SessionData {
    const ctx = useContext(SessionDataContext);
    if (!ctx) throw new Error('useSessionData must be used within a SessionProvider');
    return ctx;
}

/** Backwards-compatible combined hook — unchanged public API. */
export function useSession(): SessionContextType {
    return { ...useSessionData(), ...useSessionActions() };
}
