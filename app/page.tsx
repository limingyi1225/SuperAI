'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SessionProvider, useSession } from '@/context/SessionContext';
import SessionSidebar from '@/components/SessionSidebar';
import SettingsModal from '@/components/SettingsModal';
import AnswerPanel from '@/components/AnswerPanel';
import ReasoningTierSelector from '@/components/ReasoningTierSelector';
import LiquidGlass from '@/components/LiquidGlass/LiquidGlass';
import styles from './page.module.css';

import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useDragDrop } from '@/hooks/useDragDrop';
import { useModelSelection } from '@/hooks/useModelSelection';
import { useQuestionSubmit } from '@/hooks/useQuestionSubmit';

function MainContent() {
  const {
    currentSession, currentSessionId, createSession, addQuestion,
    updateAnswer, renameSession, setSessionGeneratingTitle,
  } = useSession();

  // Local UI state
  const [text, setText] = useState('');
  const [responseLanguage, setResponseLanguage] = useState<'Chinese' | 'English'>('Chinese');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  // Stable text accessor — avoids adding `text` to submitQuestion deps
  const textRef = useRef(text);
  textRef.current = text;

  // Custom hooks (in dependency order)
  const { themeMode, handleThemeModeChange } = useTheme();
  const { toast, showToast } = useToast();
  const { files, isUploading, processFiles, removeFile, handlePaste, clearFiles } = useFileUpload(showToast);
  const { isDragging, dragHandlers } = useDragDrop(processFiles);
  const {
    selectedModels, activeTier, customModels, defaultModels,
    handleTierChange, handleCustomModelsChange, applyNewDefaults,
  } = useModelSelection();

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

  const {
    currentQuestionId, answers, isCurrentSessionGenerating,
    handleSubmit, handleStop, handleRetry, resetForNewSession,
  } = useQuestionSubmit({
    selectedModels,
    responseLanguage,
    getText: () => textRef.current,
    clearText: () => setText(''),
    resetTextareaHeight,
    messagesAreaRef,
    files,
    clearFiles,
    currentSessionId,
    currentSession,
    createSession,
    addQuestion,
    updateAnswer,
    renameSession,
    setSessionGeneratingTitle,
  });

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  // Hydrate response language from localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem('responseLanguage') as 'Chinese' | 'English' | null;
    if (savedLang === 'Chinese' || savedLang === 'English') {
      setResponseLanguage(savedLang);
    }
  }, []);

  // Reset local state when switching sessions
  useEffect(() => {
    setText('');
    clearFiles();
    resetForNewSession();
    resetTextareaHeight();
  }, [currentSessionId, clearFiles, resetForNewSession, resetTextareaHeight]);

  // Escape key to close image preview modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewImage) {
        setPreviewImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  const handleSaveSettings = (newDefaults: string[]) => {
    applyNewDefaults(newDefaults);
    showToast('Custom tier saved', 'success');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isCurrentSessionGenerating) return;
      handleSubmit();
    }
  };

  const hasContent = text.trim() !== '' || files.length > 0;

  return (
    <div
      className={styles.layout}
      {...dragHandlers}
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
