'use client';

import React, { useState, useCallback, useRef, DragEvent, useEffect } from 'react';
import { SessionProvider, useSession, UploadedFile, ModelAnswer } from '@/context/SessionContext';
import SessionSidebar from '@/components/SessionSidebar';
import SettingsModal from '@/components/SettingsModal';
import AnswerPanel from '@/components/AnswerPanel';
import ReasoningTierSelector from '@/components/ReasoningTierSelector';
import LiquidGlass from '@/components/LiquidGlass/LiquidGlass';
import { AVAILABLE_MODELS, REASONING_TIERS, TierId } from '@/lib/models';
import styles from './page.module.css';

interface UploadApiFile {
  type: 'image' | 'pdf' | 'text';
  content: string;
  name: string;
}

interface UploadApiResponse {
  files: UploadApiFile[];
}

interface ConversationTurnPayload {
  userText: string;
  modelAnswers: Record<string, string>;
  userImages?: string[];
}

const FALLBACK_MODELS = REASONING_TIERS.fast;
const VALID_MODEL_IDS = new Set(AVAILABLE_MODELS.map(model => model.id));
const MAX_HISTORY_TURNS = 8;
const MAX_CHARS_PER_TURN = 12000;
const AUTO_DARK_START_HOUR = 19;
const AUTO_DARK_END_HOUR = 7;

type ThemeMode = 'dark' | 'light' | 'auto';

function resolveTimeBasedTheme(now: Date = new Date()): 'dark' | 'light' {
  const hour = now.getHours();
  return (hour >= AUTO_DARK_START_HOUR || hour < AUTO_DARK_END_HOUR) ? 'dark' : 'light';
}

function applyThemeToDocument(theme: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', theme);
}

function clipHistoryText(value: string): string {
  return value.length > MAX_CHARS_PER_TURN ? value.slice(0, MAX_CHARS_PER_TURN) : value;
}

function buildQuestionText(questionText: string, questionFiles: UploadedFile[]): string {
  const segments = [questionText];

  for (const file of questionFiles) {
    if (file.type === 'pdf' || file.type === 'text') {
      segments.push(file.content);
    }
  }

  return segments.filter(Boolean).join('\n\n');
}

function sanitizeModelIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];

  const sanitized = ids.filter((id): id is string => (
    typeof id === 'string' && VALID_MODEL_IDS.has(id)
  ));

  return Array.from(new Set(sanitized));
}

function MainContent() {
  const { currentSession, currentSessionId, createSession, addQuestion, updateAnswer, renameSession, setSessionGeneratingTitle } = useSession();

  const [text, setText] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>(FALLBACK_MODELS);
  const [activeTier, setActiveTier] = useState<TierId>('fast');
  const [customModels, setCustomModels] = useState<string[]>(FALLBACK_MODELS);
  // Track which sessions are currently generating responses
  const [generatingSessionIds, setGeneratingSessionIds] = useState<string[]>([]);

  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ModelAnswer[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [responseLanguage, setResponseLanguage] = useState<'Chinese' | 'English'>('Chinese');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  type ToastKind = 'success' | 'error' | 'info';
  const [toast, setToast] = useState<{ message: string; kind: ToastKind; dismissing?: boolean } | null>(null);

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [defaultModels, setDefaultModels] = useState<string[]>(FALLBACK_MODELS); // Default defaults
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [, setTheme] = useState<'dark' | 'light'>('dark');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounter = useRef(0);
  const abortControllerRef = useRef<AbortController>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);


  // Tier change handler
  const handleTierChange = useCallback((tier: TierId) => {
    setActiveTier(tier);
    localStorage.setItem('activeTier', tier);
    if (tier === 'custom') {
      setCustomModels(prev => { setSelectedModels(prev); return prev; });
    } else {
      setSelectedModels(REASONING_TIERS[tier]);
    }
  }, []);

  // Custom model change handler (stable ref for React.memo)
  const handleCustomModelsChange = useCallback((models: string[]) => {
    setCustomModels(models);
    setSelectedModels(models);
    setDefaultModels(models);
    localStorage.setItem('customModels', JSON.stringify(models));
  }, []);

  // Load tier, custom models, and theme from localStorage
  useEffect(() => {
    // Tier
    const savedTier = localStorage.getItem('activeTier') as TierId | null;
    const tier = savedTier && ['fast', 'deep', 'custom'].includes(savedTier) ? savedTier : 'fast';

    // Custom models
    const savedCustom = localStorage.getItem('customModels');
    let resolvedCustom = FALLBACK_MODELS;
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        const sanitized = sanitizeModelIds(parsed);
        if (sanitized.length > 0) resolvedCustom = sanitized;
      } catch (e) {
        console.error('Failed to parse custom models', e);
      }
    }
    setCustomModels(resolvedCustom);
    setDefaultModels(resolvedCustom);
    setActiveTier(tier);

    if (tier === 'custom') {
      setSelectedModels(resolvedCustom);
    } else {
      setSelectedModels(REASONING_TIERS[tier]);
    }

    // Language
    const savedLang = localStorage.getItem('responseLanguage') as 'Chinese' | 'English' | null;
    if (savedLang === 'Chinese' || savedLang === 'English') {
      setResponseLanguage(savedLang);
    }

    // Theme mode: light / dark / auto (time based)
    const savedThemeMode = localStorage.getItem('themeMode');
    const legacyTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;

    const initialThemeMode: ThemeMode = (
      savedThemeMode === 'light' || savedThemeMode === 'dark' || savedThemeMode === 'auto'
        ? savedThemeMode
        : (legacyTheme ?? 'auto')
    );

    const initialTheme = initialThemeMode === 'auto' ? resolveTimeBasedTheme() : initialThemeMode;
    setThemeMode(initialThemeMode);
    setTheme(initialTheme);
    applyThemeToDocument(initialTheme);
  }, []);

  const handleThemeModeChange = (nextMode: ThemeMode) => {
    setThemeMode(nextMode);
    localStorage.setItem('themeMode', nextMode);

    const nextTheme = nextMode === 'auto' ? resolveTimeBasedTheme() : nextMode;
    setTheme(nextTheme);
    applyThemeToDocument(nextTheme);

    // Keep backward compatibility for previous key.
    if (nextMode === 'auto') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', nextMode);
    }
  };

  // In auto mode, re-evaluate every minute in case local hour crosses threshold.
  useEffect(() => {
    if (themeMode !== 'auto') return;

    const intervalId = window.setInterval(() => {
      const nextTheme = resolveTimeBasedTheme();
      setTheme(prev => {
        if (prev === nextTheme) return prev;
        applyThemeToDocument(nextTheme);
        return nextTheme;
      });
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [themeMode]);

  const handleSaveSettings = (newDefaults: string[]) => {
    const sanitizedDefaults = sanitizeModelIds(newDefaults);
    const resolvedDefaults = sanitizedDefaults.length > 0 ? sanitizedDefaults : FALLBACK_MODELS;
    setDefaultModels(resolvedDefaults);
    setCustomModels(resolvedDefaults);
    localStorage.setItem('customModels', JSON.stringify(resolvedDefaults));
    // If currently on custom tier, apply immediately
    if (activeTier === 'custom') {
      setSelectedModels(resolvedDefaults);
    }
    showToast('Custom tier saved', 'success');
  };

  // Textarea auto-height adjustment
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }, []);

  const resetTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
  }, []);

  // Reset local state when switching sessions
  useEffect(() => {
    setText('');
    setFiles([]);
    setAnswers([]);
    setCurrentQuestionId(null);
    resetTextareaHeight();
  }, [currentSessionId, resetTextareaHeight]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  // Show toast helper
  const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
    setToast({ message, kind });
  }, []);

  // Auto-dismiss toast with exit animation
  useEffect(() => {
    if (!toast || toast.dismissing) return;
    const timeout = setTimeout(() => {
      setToast(prev => prev ? { ...prev, dismissing: true } : null);
    }, 3700);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!toast?.dismissing) return;
    const timeout = setTimeout(() => setToast(null), 300);
    return () => clearTimeout(timeout);
  }, [toast?.dismissing]);

  // Check if current session is generating
  const isCurrentSessionGenerating = currentSessionId ? generatingSessionIds.includes(currentSessionId) : false;

  // Global drag handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      await processFiles(droppedFiles);
    }
  };

  const processFiles = async (fileList: File[]) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      fileList.forEach(file => formData.append('files', file));

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data: UploadApiResponse = await response.json();
      const newFiles: UploadedFile[] = data.files.map((f, i: number) => ({
        id: `${Date.now()}-${i}`,
        type: f.type,
        content: f.content,
        name: f.name,
        preview: f.type === 'image' ? f.content : undefined,
      }));

      setFiles(prev => [...prev, ...newFiles]);
      showToast(`${newFiles.length > 1 ? newFiles.length + ' files' : '1 file'} uploaded`, 'success');
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      await processFiles(imageFiles);
    }
  };

  // Core submission logic extracted for reuse (retry support)
  const submitQuestion = useCallback(async (submittedText: string, submittedFiles: UploadedFile[]) => {
    if ((!submittedText.trim() && submittedFiles.length === 0) || selectedModels.length === 0) return;

    // Track start time for notifications
    const startTime = Date.now();
    const notifiedModels = new Set<string>();

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession();
    }

    // Track execution session ID stable for closure
    const execSessionId = sessionId;

    // Create new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Mark this session as generating
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

              // Helper to update answers safely
              const safeUpdateAnswers = (updateFn: (prev: ModelAnswer[]) => ModelAnswer[]) => {
                setAnswers(updateFn);
              };

              if (data.type === 'start') {
                modelStatus[data.modelId] = 'streaming';
                safeUpdateAnswers(prev => prev.map(a =>
                  a.modelId === data.modelId ? { ...a, status: 'streaming', modelName: data.modelName } : a
                ));
                updateAnswer(questionId, data.modelId, { status: 'streaming', modelName: data.modelName }, execSessionId);
              } else if (data.type === 'reasoning_summary_start') {
                safeUpdateAnswers(prev => prev.map(a =>
                  a.modelId === data.modelId ? { ...a, reasoningSummary: '' } : a
                ));
                updateAnswer(questionId, data.modelId, { reasoningSummary: '' }, execSessionId);
              } else if (data.type === 'reasoning_summary_chunk' && data.content) {
                safeUpdateAnswers(prev => prev.map(a =>
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

                safeUpdateAnswers(prev => prev.map(a =>
                  a.modelId === data.modelId ? { ...a, content: a.content + data.content } : a
                ));
                answerByModel[data.modelId] = (answerByModel[data.modelId] || '') + data.content;
              } else if (data.type === 'done') {
                modelStatus[data.modelId] = 'done';
                safeUpdateAnswers(prev => prev.map(a =>
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
                safeUpdateAnswers(prev => prev.map(a =>
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
      // Handle abort gracefully - mark streaming/pending answers as done
      if (error instanceof DOMException && error.name === 'AbortError') {
        setAnswers(prev => prev.map(a =>
          a.status === 'streaming' || a.status === 'pending'
            ? { ...a, status: 'done' }
            : a
        ));
        // Also update session context with partial outputs collected so far.
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
      abortControllerRef.current = null;
      // Remove this session from generating list
      setGeneratingSessionIds(prev => prev.filter(id => id !== execSessionId));
    }
  }, [selectedModels, currentSessionId, currentSession, createSession, addQuestion, updateAnswer, renameSession, responseLanguage, setSessionGeneratingTitle]);

  const handleSubmit = useCallback(async () => {
    if ((!text.trim() && files.length === 0) || selectedModels.length === 0) return;

    // Capture current input before clearing
    const submittedText = text;
    const submittedFiles = [...files];

    // Clear input immediately for better UX
    setText('');
    setFiles([]);
    resetTextareaHeight();
    if (document.getElementById('fileInput')) {
      (document.getElementById('fileInput') as HTMLInputElement).value = '';
    }

    // Scroll to bottom so user sees the new question
    requestAnimationFrame(() => {
      const el = messagesAreaRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });

    await submitQuestion(submittedText, submittedFiles);
  }, [text, files, selectedModels, submitQuestion, resetTextareaHeight]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Retry handler: re-submit original question text and files
  const handleRetry = useCallback((questionText: string, questionFiles: UploadedFile[]) => {
    submitQuestion(questionText, questionFiles);
  }, [submitQuestion]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for IME composition (e.g. for CJK inputs)
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Prevent double submission
      if (isCurrentSessionGenerating) return;
      handleSubmit();
    }
  };

  const hasContent = text.trim() !== '' || files.length > 0;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div
      className={styles.layout}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Toast notification */}
      {toast && (
        <LiquidGlass className={styles.toast} data-kind={toast.kind} data-dismissing={toast.dismissing ? 'true' : undefined} role="status" aria-live="polite" radius={9999} blur={3} depth={8} fallbackBlur={10}>
          {toast.message}
        </LiquidGlass>
      )}

      {/* Mobile menu button */}
      <button className={styles.mobileMenuBtn} onClick={() => setIsSidebarOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      {/* Sidebar overlay for mobile */}
      {isSidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar wrapper */}
      {/* Sidebar wrapper */}
      <div className={`${styles.sidebarWrapper} ${isSidebarOpen ? styles.open : ''}`}>
        <SessionSidebar onSessionSelect={() => setIsSidebarOpen(false)} onOpenSettings={() => setIsSettingsOpen(true)} />
      </div>

      {/* Global drag overlay */}
      {isDragging && (
        <div className={styles.dragOverlay}>
          <div className={styles.dragContent}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span>Drop files anywhere</span>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className={styles.imagePreviewOverlay}
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img
            src={previewImage}
            alt="Full size preview"
            style={{
              maxWidth: '95vw',
              maxHeight: '95vh',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
          />
        </div>
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          initialDefaults={defaultModels}
          onSave={handleSaveSettings}
          currentThemeMode={themeMode}
          onThemeChange={handleThemeModeChange}
        />
      )}

      <main className={styles.main}>
        {/* Messages Area */}
        <div className={styles.messagesArea} ref={messagesAreaRef}>
          {!currentSession?.questions.length && answers.length === 0 ? (
            <div className={styles.welcome}>
              <h1 className={styles.welcomeTitle}>
                <span className={styles.gradient}>IsabbY</span>
              </h1>
              <p className={styles.welcomeSubtitle}>Upload questions, select AI models, get detailed solutions</p>
            </div>
          ) : (
            <div className={styles.messages}>
              {/* Show all questions from session history */}
              {currentSession?.questions.map((q) => (
                <div key={q.id} className={styles.historyItem}>
                  <div className={styles.questionBubble}>
                    {/* Show attached files with previews */}
                    {q.files.length > 0 && (
                      <div className={styles.questionFiles}>
                        {q.files.map(file => (
                          <div key={file.id} className={styles.questionFile}>
                            {file.type === 'image' && file.preview ? (
                              <img
                                src={file.preview}
                                alt={file.name}
                                className={styles.questionFileImage}
                                onClick={() => setPreviewImage(file.preview!)}
                                style={{ cursor: 'pointer' }}
                              />
                            ) : (
                              <div className={styles.questionFileDoc}>
                                <span className={styles.fileIcon}>{file.type === 'pdf' ? '📄' : '📝'}</span>
                                <span className={styles.fileName}>{file.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Show text content if any */}
                    {q.text && <p className={styles.questionText}>{q.text}</p>}
                  </div>
                  {/* If this is current streaming question, show live answers; otherwise show saved answers */}
                  {q.id === currentQuestionId && answers.length > 0 ? (
                    <AnswerPanel
                      answers={answers}
                      onRetry={() => handleRetry(q.text, q.files)}
                    />
                  ) : (
                    <AnswerPanel
                      answers={q.answers}
                      onRetry={() => handleRetry(q.text, q.files)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Input Area */}
        <div className={styles.inputArea}>
          <LiquidGlass className={styles.inputContainer} radius={50} blur={2} depth={10} chromaticAberration={5} fallbackBlur={20}>
            {/* Attached files preview */}
            {files.length > 0 && (
              <div className={styles.attachedFiles}>
                {files.map(file => (
                  <div key={file.id} className={styles.attachedFile}>
                    {file.preview ? (
                      <img src={file.preview} alt={file.name} className={styles.fileThumb} />
                    ) : (
                      <span className={styles.fileIcon}>{file.type === 'pdf' ? '📄' : '📝'}</span>
                    )}
                    <span className={styles.fileName}>{file.name}</span>
                    <button className={styles.removeFile} onClick={() => removeFile(file.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Reasoning Tier Selector */}
            <ReasoningTierSelector
              activeTier={activeTier}
              onTierChange={handleTierChange}
              customModels={customModels}
              onCustomModelsChange={handleCustomModelsChange}
              disabled={isCurrentSessionGenerating}
            />

            {/* Input row */}
            <div className={styles.inputRow}>
              <button
                className={styles.attachBtn}
                onClick={() => !isUploading && document.getElementById('fileInput')?.click()}
                disabled={isCurrentSessionGenerating || isUploading}
                title={isUploading ? 'Uploading...' : 'Attach files'}
              >
                {isUploading ? (
                  <div className={styles.spinner} />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
              <input
                type="file"
                id="fileInput"
                multiple
                accept="image/*,.pdf,.txt"
                className={styles.hiddenInput}
                onChange={async (e) => {
                  if (e.target.files) {
                    await processFiles(Array.from(e.target.files));
                  }
                }}
              />

              <textarea
                ref={textareaRef}
                className={styles.textarea}
                placeholder="Ask anything"
                value={text}
                onChange={e => {
                  setText(e.target.value);
                  adjustTextareaHeight();
                }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                disabled={isCurrentSessionGenerating}
                rows={1}
              />

              {/* Language Selector */}
              <button
                className={styles.modelBtn}
                onClick={() => setResponseLanguage(prev => {
                  const next = prev === 'Chinese' ? 'English' : 'Chinese';
                  localStorage.setItem('responseLanguage', next);
                  return next;
                })}
                disabled={isCurrentSessionGenerating}
                title={`Current language: ${responseLanguage}`}
                style={{ fontSize: '0.85rem', width: 'auto', padding: '0 8px', gap: '4px', fontWeight: 500 }}
              >
                {responseLanguage === 'Chinese' ? '中' : 'En'}
              </button>

              {isCurrentSessionGenerating ? (
                <button
                  className={styles.stopBtn}
                  onClick={handleStop}
                  title="Stop generating"
                >
                  <div className={styles.stopIcon} />
                </button>
              ) : (
                <button
                  className={`${styles.sendBtn} ${hasContent ? styles.active : ''}`}
                  onClick={handleSubmit}
                  disabled={!hasContent || selectedModels.length === 0}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              )}
            </div>
          </LiquidGlass>
          <p className={styles.inputHint}>Enter 发送 · Shift+Enter 换行 · 支持拖放图片 / PDF</p>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <MainContent />
    </SessionProvider>
  );
}
