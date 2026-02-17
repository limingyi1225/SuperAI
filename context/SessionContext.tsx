'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

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
}

interface SessionContextType {
    sessions: Session[];
    currentSessionId: string | null;
    currentSession: Session | null;
    createSession: () => string;
    selectSession: (id: string) => void;
    deleteSession: (id: string) => void;
    addQuestion: (question: Omit<Question, 'id' | 'timestamp'>, sessionId?: string) => string;
    updateAnswer: (questionId: string, modelId: string, update: Partial<ModelAnswer>, sessionId?: string) => void;
    appendToAnswer: (questionId: string, modelId: string, content: string, sessionId?: string) => void;
    appendToReasoningSummary: (questionId: string, modelId: string, content: string, sessionId?: string) => void;
    renameSession: (sessionId: string, newName: string) => void;
    setSessionGeneratingTitle: (sessionId: string, isGenerating: boolean) => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

const SESSIONS_KEY = 'isbaby_sessions';
const CURRENT_SESSION_KEY = 'isbaby_currentSessionId';

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
    const isHydrated = useRef(false);

    // Hydrate from localStorage on mount
    useEffect(() => {
        const { sessions: saved, currentSessionId: savedId } = loadFromStorage();
        if (saved.length > 0) {
            setSessions(saved);
            setCurrentSessionId(savedId);
        }
        isHydrated.current = true;
    }, []);

    // Persist sessions to localStorage on change (skip initial hydration write)
    useEffect(() => {
        if (!isHydrated.current) return;
        try {
            const toSave = sessions.map(s => ({ ...s, isGeneratingTitle: false }));
            localStorage.setItem(SESSIONS_KEY, JSON.stringify(toSave));
        } catch {
            // localStorage full or unavailable, silently ignore
        }
    }, [sessions]);

    // Persist currentSessionId
    useEffect(() => {
        if (!isHydrated.current) return;
        if (currentSessionId) {
            localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId);
        } else {
            localStorage.removeItem(CURRENT_SESSION_KEY);
        }
    }, [currentSessionId]);

    const currentSession = sessions.find(s => s.id === currentSessionId) || null;

    const createSession = useCallback(() => {
        const newSession: Session = {
            id: uuidv4(),
            name: `Session ${sessions.length + 1}`,
            questions: [],
            createdAt: new Date(),
        };
        setSessions(prev => [...prev, newSession]);
        setCurrentSessionId(newSession.id);
        return newSession.id;
    }, [sessions.length]);

    const selectSession = useCallback((id: string) => {
        setCurrentSessionId(id);
    }, []);

    const deleteSession = useCallback((sessionId: string) => {
        setSessions(prev => {
            const remaining = prev.filter(s => s.id !== sessionId);
            setCurrentSessionId(cur => {
                if (cur !== sessionId) return cur;
                return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
            });
            return remaining;
        });
    }, []);

    const addQuestion = useCallback((question: Omit<Question, 'id' | 'timestamp'>, targetSessionId?: string) => {
        const questionId = uuidv4();
        const newQuestion: Question = {
            ...question,
            id: questionId,
            timestamp: new Date(),
        };

        const sessionToUpdate = targetSessionId || currentSessionId;

        setSessions(prev => prev.map(session => {
            if (session.id === sessionToUpdate) {
                return {
                    ...session,
                    questions: [...session.questions, newQuestion],
                };
            }
            return session;
        }));

        return questionId;
    }, [currentSessionId]);

    const updateAnswer = useCallback((questionId: string, modelId: string, update: Partial<ModelAnswer>, sessionId?: string) => {
        setSessions(prev => prev.map(session => {
            if (session.id === (sessionId || currentSessionId)) {
                return {
                    ...session,
                    questions: session.questions.map(q => {
                        if (q.id === questionId) {
                            return {
                                ...q,
                                answers: q.answers.map(a =>
                                    a.modelId === modelId ? { ...a, ...update } : a
                                ),
                            };
                        }
                        return q;
                    }),
                };
            }
            return session;
        }));
    }, [currentSessionId]);

    const appendToAnswer = useCallback((questionId: string, modelId: string, content: string, sessionId?: string) => {
        setSessions(prev => prev.map(session => {
            if (session.id === (sessionId || currentSessionId)) {
                return {
                    ...session,
                    questions: session.questions.map(q => {
                        if (q.id === questionId) {
                            return {
                                ...q,
                                answers: q.answers.map(a =>
                                    a.modelId === modelId ? { ...a, content: a.content + content } : a
                                ),
                            };
                        }
                        return q;
                    }),
                };
            }
            return session;
        }));
    }, [currentSessionId]);

    const appendToReasoningSummary = useCallback((questionId: string, modelId: string, content: string, sessionId?: string) => {
        setSessions(prev => prev.map(session => {
            if (session.id === (sessionId || currentSessionId)) {
                return {
                    ...session,
                    questions: session.questions.map(q => {
                        if (q.id === questionId) {
                            return {
                                ...q,
                                answers: q.answers.map(a =>
                                    a.modelId === modelId
                                        ? { ...a, reasoningSummary: (a.reasoningSummary || '') + content }
                                        : a
                                ),
                            };
                        }
                        return q;
                    }),
                };
            }
            return session;
        }));
    }, [currentSessionId]);

    const renameSession = useCallback((sessionId: string, newName: string) => {
        setSessions(prev => prev.map(session =>
            session.id === sessionId ? { ...session, name: newName } : session
        ));
    }, []);

    const setSessionGeneratingTitle = useCallback((sessionId: string, isGenerating: boolean) => {
        setSessions(prev => prev.map(session =>
            session.id === sessionId ? { ...session, isGeneratingTitle: isGenerating } : session
        ));
    }, []);

    return (
        <SessionContext.Provider value={{
            sessions,
            currentSessionId,
            currentSession,
            createSession,
            selectSession,
            deleteSession,
            addQuestion,
            updateAnswer,
            appendToAnswer,
            appendToReasoningSummary,
            renameSession,
            setSessionGeneratingTitle,
        }}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
