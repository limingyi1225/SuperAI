'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { ModelAnswer } from '@/context/SessionContext';
import styles from './AnswerPanel.module.css';

/**
 * Normalize LaTeX delimiters into remark-math friendly forms:
 *   \[...\]  →  $$...$$   (display math)
 *   \(...\)  →  $...$     (inline math)
 *   $$...$$  →  block math with dedicated lines
 * Code blocks (``` and `) are preserved and not touched.
 */
function preprocessLaTeX(text: string): string {
    // Split by code fences and inline code so we only process prose segments.
    const segments = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
    return segments
        .map((segment, index) => {
            // Odd-indexed segments are preserved blocks — leave them alone
            if (index % 2 === 1) return segment;

            // Convert \[...\] → $$...$$ (display math)
            let result = segment.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, inner) => `$$${inner}$$`);
            // Convert \(...\) → $...$ (inline math)
            result = result.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, inner) => `$${inner}$`);

            // Force $$...$$ to block form even when model outputs it inline,
            // e.g. "设 $$I=...$$ 下一步..." -> reliably rendered display math.
            result = result.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (_, inner) => {
                const content = String(inner).trim();
                if (!content) return '$$ $$';
                return `\n\n$$\n${content}\n$$\n\n`;
            });

            return result;
        })
        .join('');
}

interface AnswerPanelProps {
    answers: ModelAnswer[];
    onRetry?: () => void;
}

function AnswerCard({ answer }: { answer: ModelAnswer }) {
    const [isReasoningOpen, setIsReasoningOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const hasReasoning = Boolean(answer.reasoningSummary);
    const isStreaming = answer.status === 'streaming';

    const handleCopy = () => {
        if (!answer.content) return;
        navigator.clipboard.writeText(answer.content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    // Determine if reasoning is still actively streaming
    // (has content but answer is still streaming and content hasn't started yet or is small)
    const isReasoningStreaming = isStreaming && hasReasoning && answer.content.length < 10;

    return (
        <div className={styles.answerCard}>
            {/* Reasoning Summary */}
            {hasReasoning && (
                <div className={styles.reasoningSection}>
                    <button
                        type="button"
                        className={styles.reasoningToggle}
                        onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                        aria-expanded={isReasoningOpen}
                    >
                        <span className={styles.reasoningToggleHeader}>
                            <span className={`${styles.reasoningIcon} ${isReasoningOpen ? styles.expanded : ''}`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </span>
                            <span className={styles.reasoningLabel}>
                                {isReasoningStreaming ? (
                                    <span className={styles.reasoningStreaming}>
                                        Thinking
                                        <span className={styles.shimmerDots}>
                                            <span /><span /><span />
                                        </span>
                                    </span>
                                ) : (
                                    'Reasoning'
                                )}
                            </span>
                        </span>
                    </button>

                    {!isReasoningOpen && hasReasoning && (
                        <div className={styles.reasoningPeek}>
                            <div className={styles.reasoningPeekMarkdown}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[rehypeKatex, rehypeHighlight]}
                                >
                                    {preprocessLaTeX(answer.reasoningSummary || '')}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}

                    <div className={`${styles.reasoningContent} ${isReasoningOpen ? styles.open : ''}`}>
                        <div className={styles.reasoningInner}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex, rehypeHighlight]}
                            >
                                {preprocessLaTeX(answer.reasoningSummary || '')}
                            </ReactMarkdown>
                            {isReasoningStreaming && <span className={styles.streamingCursor} />}
                        </div>
                    </div>
                </div>
            )}

            {/* Main answer content */}
            {answer.status === 'pending' ? (
                <div className={styles.skeleton}>
                    <div className={styles.skeletonLine} />
                    <div className={styles.skeletonLine} />
                    <div className={styles.skeletonLine} />
                </div>
            ) : answer.status === 'error' ? (
                <div className={styles.errorContent}>
                    <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    <span>{answer.error || 'An error occurred'}</span>
                </div>
            ) : (
                <div className={styles.answerContent}>
                    {answer.content && !isStreaming && (
                        <button
                            className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
                            onClick={handleCopy}
                            title="Copy answer"
                        >
                            {copied ? (
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 8l3 3 7-7" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="5" y="5" width="8" height="9" rx="1.5" />
                                    <path d="M11 5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h1" />
                                </svg>
                            )}
                        </button>
                    )}
                    {answer.content ? (
                        <>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex, rehypeHighlight]}
                            >
                                {preprocessLaTeX(answer.content)}
                            </ReactMarkdown>
                            {isStreaming && <span className={styles.streamingCursor} />}
                        </>
                    ) : isStreaming ? (
                        <div className={styles.skeleton}>
                            <div className={styles.skeletonLine} />
                            <div className={styles.skeletonLine} />
                            <div className={styles.skeletonLine} />
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

function AnswerPanel({ answers, onRetry }: AnswerPanelProps) {
    const [activeTab, setActiveTab] = useState(0);
    const allDone = answers.length > 0 && answers.every(a => a.status === 'done' || a.status === 'error');
    const hasError = answers.some(a => a.status === 'error');
    const isSingleModel = answers.length <= 1;
    const clampedActiveTab = answers.length > 0
        ? Math.min(activeTab, answers.length - 1)
        : 0;
    const activeAnswer = answers[clampedActiveTab];

    return (
        <div className={styles.answerPanel}>
            {/* Tab bar — only show when multiple models */}
            {!isSingleModel && (
                <div className={styles.tabBar}>
                    {answers.map((answer, idx) => (
                        <button
                            key={answer.modelId}
                            type="button"
                            className={`${styles.tab} ${idx === clampedActiveTab ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab(idx)}
                        >
                            <span className={`${styles.tabDot} ${styles[answer.status]}`} />
                            <span className={styles.tabLabel}>{answer.modelName}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Single model header (show model name inline) */}
            {isSingleModel && activeAnswer && (
                <div className={styles.cardHeader}>
                    <div className={styles.modelInfo}>
                        <span className={`${styles.statusDot} ${styles[activeAnswer.status]}`} />
                        <span className={styles.modelName}>{activeAnswer.modelName}</span>
                    </div>
                </div>
            )}

            {/* Active answer card */}
            {activeAnswer && <AnswerCard answer={activeAnswer} />}

            {allDone && hasError && onRetry && (
                <button type="button" className={styles.retryBtn} onClick={onRetry}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    Retry
                </button>
            )}
        </div>
    );
}

export default React.memo(AnswerPanel);
