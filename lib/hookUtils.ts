/**
 * Pure utility functions extracted from hooks for testability.
 * No React dependencies, no @/ imports — safe to import in Node test runner.
 */

import { AVAILABLE_MODELS, REASONING_TIERS } from './models.ts';

export const FALLBACK_MODELS = REASONING_TIERS.fast;
const VALID_MODEL_IDS = new Set(AVAILABLE_MODELS.map(model => model.id));

// ----- useModelSelection utils -----

export function sanitizeModelIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];

  const sanitized = ids.filter((id): id is string => (
    typeof id === 'string' && VALID_MODEL_IDS.has(id)
  ));

  return Array.from(new Set(sanitized));
}

export function resolveInitialModels(rawJson: string): string[] {
  if (!rawJson) return FALLBACK_MODELS;
  try {
    const parsed = JSON.parse(rawJson);
    const sanitized = sanitizeModelIds(parsed);
    return sanitized.length > 0 ? sanitized : FALLBACK_MODELS;
  } catch {
    return FALLBACK_MODELS;
  }
}

// ----- useQuestionSubmit utils -----

export const MAX_HISTORY_TURNS = 8;
export const MAX_CHARS_PER_TURN = 12000;

export function clipHistoryText(value: string): string {
  return value.length > MAX_CHARS_PER_TURN ? value.slice(0, MAX_CHARS_PER_TURN) : value;
}

interface UploadedFileLike {
  id: string;
  type: 'image' | 'pdf' | 'text';
  content: string;
  name: string;
  preview?: string;
}

export function buildQuestionText(questionText: string, questionFiles: UploadedFileLike[]): string {
  const segments = [questionText];

  for (const file of questionFiles) {
    if (file.type === 'pdf' || file.type === 'text') {
      segments.push(file.content);
    }
  }

  return segments.filter(Boolean).join('\n\n');
}

// ----- useFileUpload utils -----

interface UploadApiFileLike {
  type: 'image' | 'pdf' | 'text';
  content: string;
  name: string;
}

export function mapApiFilesToUploadedFiles(
  apiFiles: UploadApiFileLike[],
  timestamp: number
): UploadedFileLike[] {
  return apiFiles.map((f, i) => ({
    id: `${timestamp}-${i}`,
    type: f.type,
    content: f.content,
    name: f.name,
    preview: f.type === 'image' ? f.content : undefined,
  }));
}

// ----- useDragDrop utils -----

export interface ComputeDragStateResult {
  counter: number;
  isDragging: boolean;
}

export function computeDragState(
  currentCounter: number,
  delta: 1 | -1,
  hasFiles: boolean
): ComputeDragStateResult {
  const counter = currentCounter + delta;
  if (delta === 1) {
    return { counter, isDragging: hasFiles };
  }
  return { counter, isDragging: counter > 0 };
}

// ----- useTheme utils -----

export const AUTO_DARK_START_HOUR = 19;
export const AUTO_DARK_END_HOUR = 7;

export function resolveTimeBasedTheme(now: Date = new Date()): 'dark' | 'light' {
  const hour = now.getHours();
  return (hour >= AUTO_DARK_START_HOUR || hour < AUTO_DARK_END_HOUR) ? 'dark' : 'light';
}

// ----- useToast utils -----

export const TOAST_DISPLAY_MS = 3700;
export const TOAST_EXIT_MS = 300;
