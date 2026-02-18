'use client';

import { useState, useCallback, useRef, useEffect, RefObject } from 'react';
import { UploadedFile, ModelAnswer, Session, Question } from '@/context/SessionContext';
import { AVAILABLE_MODELS } from '@/lib/models';
import {
  MAX_HISTORY_TURNS,
  MAX_CHARS_PER_TURN,
  clipHistoryText,
  buildQuestionText,
} from '@/lib/hookUtils';

export { MAX_HISTORY_TURNS, MAX_CHARS_PER_TURN, clipHistoryText, buildQuestionText };

interface ConversationTurnPayload {
  userText: string;
  modelAnswers: Record<string, string>;
  userImages?: string[];
}

export interface QuestionSubmitOptions {
  selectedModels: string[];
  responseLanguage: 'Chinese' | 'English';
  getText: () => string;
  clearText: () => void;
  resetTextareaHeight: () => void;
  messagesAreaRef: RefObject<HTMLDivElement | null>;
  files: UploadedFile[];
  clearFiles: () => void;
  currentSessionId: string | null;
  currentSession: Session | null;
  createSession: () => string;
  addQuestion: (question: Omit<Question, 'id' | 'timestamp'>, sessionId?: string) => string;
  updateAnswer: (questionId: string, modelId: string, update: Partial<ModelAnswer>, sessionId?: string) => void;
  renameSession: (sessionId: string, newName: string) => void;
  setSessionGeneratingTitle: (sessionId: string, isGenerating: boolean) => void;
}

export interface UseQuestionSubmitReturn {
  currentQuestionId: string | null;
  answers: ModelAnswer[];
  generatingSessionIds: string[];
  isCurrentSessionGenerating: boolean;
  handleSubmit: () => Promise<void>;
  handleStop: () => void;
  handleRetry: (questionText: string, questionFiles: UploadedFile[]) => void;
  resetForNewSession: () => void;
}

export function useQuestionSubmit(opts: QuestionSubmitOptions): UseQuestionSubmitReturn {
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ModelAnswer[]>([]);
  const [generatingSessionIds, setGeneratingSessionIds] = useState<string[]>([]);

  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  // Keep opts stable in a ref so submitQuestion can have an empty dep array
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Cleanup all abort controllers on unmount
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach(ctrl => ctrl.abort());
    };
  }, []);

  const submitQuestion = useCallback(async (submittedText: string, submittedFiles: UploadedFile[]) => {
    const {
      selectedModels, responseLanguage, currentSessionId, currentSession,
      createSession, addQuestion, updateAnswer, renameSession, setSessionGeneratingTitle,
    } = optsRef.current;

    if ((!submittedText.trim() && submittedFiles.length === 0) || selectedModels.length === 0) return;

    const startTime = Date.now();
    const notifiedModels = new Set<string>();

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession();
    }

    const execSessionId = sessionId;

    const controller = new AbortController();
    abortControllersRef.current.set(execSessionId, controller);

    setGeneratingSessionIds(prev => [...prev, execSessionId]);

    const historyQuestions = currentSession?.questions ?? [];

    const history: ConversationTurnPayload[] = historyQuestions
      .slice(-MAX_HISTORY_TURNS)
      .map((q) => {
        const userText = clipHistoryText(buildQuestionText(q.text, q.files));
        const modelAnswers: Record<string, string> = {};
        const userImages = q.files
          .filter(file => file.type === 'image')
          .map(file => file.content)
          .filter(Boolean);

        for (const answer of q.answers) {
          if (answer.status !== 'done') continue;
          const answerText = clipHistoryText(answer.content || '');
          if (!answerText.trim()) continue;
          modelAnswers[answer.modelId] = answerText;
        }

        return {
          userText,
          modelAnswers,
          ...(userImages.length > 0 ? { userImages } : {}),
        };
      })
      .filter(turn => turn.userText.trim().length > 0 || (turn.userImages && turn.userImages.length > 0));

    const initialAnswers: ModelAnswer[] = selectedModels.map(modelId => ({
      modelId,
      modelName: AVAILABLE_MODELS.find(model => model.id === modelId)?.name || modelId,
      content: '',
      reasoningSummary: '',
      status: 'pending',
    }));

    const questionId = addQuestion({
      text: submittedText,
      files: submittedFiles,
      answers: initialAnswers,
    }, execSessionId);

    setCurrentQuestionId(questionId);
    setAnswers(initialAnswers);

    const isFirstInteraction = !currentSession || currentSession.questions.length === 0;
    const answerByModel: Record<string, string> = {};
    const reasoningByModel: Record<string, string> = {};
    const modelStatus: Record<string, ModelAnswer['status']> = Object.fromEntries(
      selectedModels.map(modelId => [modelId, 'pending' as const])
    );
    let hasRequestedTitle = false;

    const requestTitleFromAnswer = (answerText: string) => {
      if (!isFirstInteraction || hasRequestedTitle || !execSessionId) return;
      const sourceText = answerText.trim();
      if (!sourceText) return;

      hasRequestedTitle = true;
      setSessionGeneratingTitle(execSessionId, true);

      fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: sourceText.slice(0, 1200) }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.title && execSessionId) {
            renameSession(execSessionId, data.title);
          }
        })
        .catch(console.error)
        .finally(() => {
          if (execSessionId) setSessionGeneratingTitle(execSessionId, false);
        });
    };

    try {
      const images = submittedFiles.filter(f => f.type === 'image').map(f => f.content);
      const fullText = buildQuestionText(submittedText, submittedFiles);

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: fullText,
          images,
          models: selectedModels,
          language: responseLanguage,
          history,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'start') {
                modelStatus[data.modelId] = 'streaming';
                setAnswers(prev => prev.map(a =>
                  a.modelId === data.modelId ? { ...a, status: 'streaming', modelName: data.modelName } : a
                ));
                updateAnswer(questionId, data.modelId, { status: 'streaming', modelName: data.modelName }, execSessionId);
              } else if (data.type === 'reasoning_summary_start') {
                setAnswers(prev => prev.map(a =>
                  a.modelId === data.modelId ? { ...a, reasoningSummary: '' } : a
                ));
                updateAnswer(questionId, data.modelId, { reasoningSummary: '' }, execSessionId);
              } else if (data.type === 'reasoning_summary_chunk' && data.content) {
                setAnswers(prev => prev.map(a =>
                  a.modelId === data.modelId
                    ? { ...a, reasoningSummary: (a.reasoningSummary || '') + data.content }
                    : a
                ));
                reasoningByModel[data.modelId] = (reasoningByModel[data.modelId] || '') + data.content;
              } else if (data.type === 'reasoning_summary_done') {
                // Marker event for UI state sync, no-op for now.
              } else if (data.type === 'chunk') {
                // Notification check for slow responses (>10s)
                if (!notifiedModels.has(data.modelId)) {
                  const elapsed = Date.now() - startTime;
                  if (elapsed > 10000) {
                    const modelName = AVAILABLE_MODELS.find(m => m.id === data.modelId)?.name || data.modelId;
                    if ('Notification' in window && Notification.permission === 'granted') {
                      new Notification('IsabbY', { body: `New answer from ${modelName}` });
                    }
                    notifiedModels.add(data.modelId);
                  }
                }

                setAnswers(prev => prev.map(a =>
                  a.modelId === data.modelId ? { ...a, content: a.content + data.content } : a
                ));
                answerByModel[data.modelId] = (answerByModel[data.modelId] || '') + data.content;
              } else if (data.type === 'done') {
                modelStatus[data.modelId] = 'done';
                setAnswers(prev => prev.map(a =>
                  a.modelId === data.modelId ? { ...a, status: 'done' } : a
                ));
                updateAnswer(questionId, data.modelId, {
                  status: 'done',
                  content: answerByModel[data.modelId] || '',
                  reasoningSummary: reasoningByModel[data.modelId] || '',
                }, execSessionId);
                requestTitleFromAnswer(answerByModel[data.modelId] || '');
              } else if (data.type === 'error') {
                modelStatus[data.modelId] = 'error';
                setAnswers(prev => prev.map(a =>
                  a.modelId === data.modelId ? { ...a, status: 'error', error: data.error } : a
                ));
                updateAnswer(questionId, data.modelId, {
                  status: 'error',
                  error: data.error,
                  content: answerByModel[data.modelId] || '',
                  reasoningSummary: reasoningByModel[data.modelId] || '',
                }, execSessionId);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setAnswers(prev => prev.map(a =>
          a.status === 'streaming' || a.status === 'pending'
            ? { ...a, status: 'done' }
            : a
        ));
        for (const modelId of selectedModels) {
          if (modelStatus[modelId] === 'done' || modelStatus[modelId] === 'error') continue;
          modelStatus[modelId] = 'done';
          updateAnswer(questionId, modelId, {
            status: 'done',
            content: answerByModel[modelId] || '',
            reasoningSummary: reasoningByModel[modelId] || '',
          }, execSessionId);
        }
      } else {
        console.error('Submit error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setAnswers(prev => prev.map(a => ({
          ...(a.status === 'done' || a.status === 'error'
            ? a
            : { ...a, status: 'error', error: errorMessage }),
        })));
        for (const modelId of selectedModels) {
          if (modelStatus[modelId] === 'done' || modelStatus[modelId] === 'error') continue;
          modelStatus[modelId] = 'error';
          updateAnswer(questionId, modelId, {
            status: 'error',
            error: errorMessage,
            content: answerByModel[modelId] || '',
            reasoningSummary: reasoningByModel[modelId] || '',
          }, execSessionId);
        }
      }
    } finally {
      abortControllersRef.current.delete(execSessionId);
      setGeneratingSessionIds(prev => prev.filter(id => id !== execSessionId));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const { getText, clearText, resetTextareaHeight, files, clearFiles, messagesAreaRef, selectedModels } = optsRef.current;
    const text = getText();

    if ((!text.trim() && files.length === 0) || selectedModels.length === 0) return;

    const submittedText = text;
    const submittedFiles = [...files];

    clearText();
    clearFiles();
    resetTextareaHeight();

    if (document.getElementById('fileInput')) {
      (document.getElementById('fileInput') as HTMLInputElement).value = '';
    }

    requestAnimationFrame(() => {
      const el = messagesAreaRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });

    await submitQuestion(submittedText, submittedFiles);
  }, [submitQuestion]);

  const handleStop = useCallback(() => {
    const { currentSessionId } = optsRef.current;
    if (currentSessionId) {
      abortControllersRef.current.get(currentSessionId)?.abort();
    }
  }, []);

  const handleRetry = useCallback((questionText: string, questionFiles: UploadedFile[]) => {
    submitQuestion(questionText, questionFiles);
  }, [submitQuestion]);

  const resetForNewSession = useCallback(() => {
    setAnswers([]);
    setCurrentQuestionId(null);
  }, []);

  const { currentSessionId } = opts;
  const isCurrentSessionGenerating = currentSessionId
    ? generatingSessionIds.includes(currentSessionId)
    : false;

  return {
    currentQuestionId,
    answers,
    generatingSessionIds,
    isCurrentSessionGenerating,
    handleSubmit,
    handleStop,
    handleRetry,
    resetForNewSession,
  };
}
